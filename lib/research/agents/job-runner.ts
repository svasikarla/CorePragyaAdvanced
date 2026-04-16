import { nanoid } from "nanoid";
import type { ResearchConfig, ResearchJob, AgentState, SubTopicFindings } from "@/types/research";
import { jobStore } from "@/lib/research/store/job-store";
import { sseEmitter } from "@/lib/research/store/sse-emitter";
import { runOrchestrator } from "./orchestrator";
import { runSearcher } from "./searcher";
import { runSynthesizer } from "./synthesizer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function emit(jobId: string, event: string, data: object) {
  sseEmitter.emit(jobId, event, data);
}

function buildSearcherAgents(count: number): AgentState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `searcher-${String.fromCharCode(97 + i)}`,
    name: `Searcher ${String.fromCharCode(65 + i)}`,
    role: `Sub-topic ${i + 1}`,
    status: "idle" as const,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startResearchJob(
  config: ResearchConfig,
  userId: string
): Promise<string> {
  const maxConcurrent = Number(process.env.MAX_CONCURRENT_RESEARCH_JOBS ?? 5);
  const running = await jobStore.countRunning();
  if (running >= maxConcurrent) {
    throw new Error(
      `Server busy — ${maxConcurrent} jobs are already running. Please try again shortly.`
    );
  }

  const jobId = nanoid(10);

  const job: ResearchJob = {
    id: jobId,
    user_id: userId,
    status: "queued",
    config,
    agents: [
      { id: "orchestrator", name: "Orchestrator", role: "Decomposing topic", status: "idle" },
      ...buildSearcherAgents(5),
      { id: "synthesizer", name: "Synthesizer", role: "Writing report", status: "idle" },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await jobStore.set(jobId, job);

  // Run async — do not await so the HTTP response returns immediately
  runJob(jobId, config).catch(async (err) => {
    await jobStore.update(jobId, { status: "error", error: String(err.message) });
    emit(jobId, "error", { message: err.message });
  });

  return jobId;
}

// ── Internal job execution ────────────────────────────────────────────────────

async function runJob(jobId: string, config: ResearchConfig) {
  await jobStore.update(jobId, { status: "running" });
  emit(jobId, "status", { status: "running" });

  // ── Phase 1: Orchestrator ──────────────────────────────────────────────────
  await jobStore.updateAgent(jobId, "orchestrator", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "orchestrator", status: "running" });

  const { sub_topics, domain_context } = await runOrchestrator(config);

  await jobStore.updateAgent(jobId, "orchestrator", {
    status: "done",
    note: `${sub_topics.length} sub-topics identified`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "orchestrator",
    status: "done",
    note: `${sub_topics.length} sub-topics`,
  });

  // Trim unused searcher agents and update roles with actual questions
  const activeSearchers = sub_topics.length;
  const allSearcherIds = ["a", "b", "c", "d", "e"].map((l) => `searcher-${l}`);

  for (let i = 0; i < sub_topics.length; i++) {
    const id = allSearcherIds[i];
    const st = sub_topics[i];
    if (id && st) {
      await jobStore.updateAgent(jobId, id, {
        role: st.question.slice(0, 60) + (st.question.length > 60 ? "…" : ""),
      });
    }
  }

  // Mark unused searchers as not needed
  for (let i = activeSearchers; i < 5; i++) {
    const id = allSearcherIds[i];
    if (id) await jobStore.updateAgent(jobId, id, { status: "idle", note: "not needed" });
  }

  // ── Phase 2: Parallel searchers ────────────────────────────────────────────
  const topicsToSearch = sub_topics.slice(0, activeSearchers);

  for (let i = 0; i < topicsToSearch.length; i++) {
    const id = allSearcherIds[i]!;
    await jobStore.updateAgent(jobId, id, {
      status: "running",
      started_at: new Date().toISOString(),
    });
    emit(jobId, "agent_update", { agentId: id, status: "running" });
  }

  const searchResults = await Promise.allSettled(
    topicsToSearch.map((st) => runSearcher(st, config))
  );

  const findingsMaybeNull = await Promise.all(
    searchResults.map(async (result, i) => {
      const id = allSearcherIds[i]!;
      if (result.status === "fulfilled") {
        await jobStore.updateAgent(jobId, id, {
          status: "done",
          note: `${result.value.key_assertions.length} assertions`,
          completed_at: new Date().toISOString(),
        });
        emit(jobId, "agent_update", { agentId: id, status: "done" });
        return result.value;
      } else {
        await jobStore.updateAgent(jobId, id, {
          status: "error",
          note: String((result.reason as Error)?.message ?? "Unknown error"),
        });
        emit(jobId, "agent_update", { agentId: id, status: "error" });
        return null;
      }
    })
  );

  const findings: SubTopicFindings[] = findingsMaybeNull.filter(
    (f): f is SubTopicFindings => f !== null
  );

  // ── Cross-analysis ─────────────────────────────────────────────────────────
  const allGaps = findings.flatMap((f) => f.gaps);
  const allSources = findings.flatMap((f) => f.sources);

  const thinTopics = findings
    .filter((f) => f.coverage === "thin")
    .map((f) => f.sub_topic);
  const crossCuttingInsights =
    thinTopics.length > 0
      ? [`Coverage is thin for: ${thinTopics.join(", ")} — treat those sections with appropriate caveats.`]
      : [];

  const evidencePackage = {
    sub_topics_covered: findings.length,
    total_sources: allSources.length,
    primary_sources: allSources.filter((s) => s.type === "primary").length,
    date_range: { earliest: "", latest: "" },
    gaps_identified: allGaps,
    findings,
    cross_cutting_insights: crossCuttingInsights,
    contradictions: [],
    raw_source_list: allSources,
  };

  await jobStore.update(jobId, { evidence_package: evidencePackage });
  emit(jobId, "evidence_ready", {
    sub_topics_covered: findings.length,
    total_sources: allSources.length,
    domain_context,
  });

  // ── Phase 3: Synthesizer ───────────────────────────────────────────────────
  await jobStore.updateAgent(jobId, "synthesizer", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "synthesizer", status: "running" });

  const report = await runSynthesizer(evidencePackage, config);

  await jobStore.updateAgent(jobId, "synthesizer", {
    status: "done",
    note: `${report.sections.length} sections written`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "synthesizer", status: "done" });

  await jobStore.update(jobId, { report, status: "done" });
  emit(jobId, "complete", { report });
}
