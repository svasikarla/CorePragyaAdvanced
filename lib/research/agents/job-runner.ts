import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import type { ResearchConfig, ResearchJob, AgentState, SubTopicFindings, Contradiction } from "@/types/research";
import { jobStore } from "@/lib/research/store/job-store";
import { sseEmitter } from "@/lib/research/store/sse-emitter";
import { runOrchestrator } from "./orchestrator";
import { runSearcher } from "./searcher";
import { runSynthesizer } from "./synthesizer";
import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import { generateEmbeddings } from "@/lib/ai-clients";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchKBContext(topic: string, userId: string): Promise<string> {
  try {
    const [[embedding]] = await Promise.all([generateEmbeddings(topic)]);
    const { data: chunks } = await supabaseAdmin.rpc("match_embeddings", {
      query_embedding: embedding,
      match_threshold: 0.45,
      match_count: 8,
    });
    if (!chunks || chunks.length === 0) return "";

    const kbIds = [...new Set((chunks as any[]).map((c: any) => c.kb_id))];
    const { data: entries } = await supabaseAdmin
      .from("knowledgebase")
      .select("title, summary_text, category")
      .in("id", kbIds)
      .eq("user_id", userId);

    if (!entries || entries.length === 0) return "";

    return entries
      .map((e: any) => `[KB: ${e.title} — ${e.category}]\n${e.summary_text}`)
      .join("\n\n")
      .slice(0, 6000);
  } catch {
    return "";
  }
}

// ── Cross-analysis ────────────────────────────────────────────────────────────

interface CrossAnalysisResult {
  cross_cutting_insights: string[];
  contradictions: Contradiction[];
}

async function computeCrossAnalysis(
  findings: SubTopicFindings[],
  config: ResearchConfig
): Promise<CrossAnalysisResult> {
  if (findings.length < 2) {
    return { cross_cutting_insights: [], contradictions: [] };
  }

  // Build a compact evidence digest for cross-analysis
  const digest = findings
    .map((f) => {
      const assertions = f.key_assertions.slice(0, 5).map((a) => `  • ${a.claim}`).join("\n");
      const dataPoints = f.data_points.slice(0, 3).map((d) => `  ○ ${d.fact}`).join("\n");
      return `[${f.sub_topic}]\n${assertions}\n${dataPoints}`;
    })
    .join("\n\n");

  const prompt = `You are a research analyst. Below are evidence summaries from ${findings.length} parallel research threads on the topic.

${digest}

Your tasks:
1. Identify 2-4 CROSS-CUTTING INSIGHTS — observations that only emerge when comparing across multiple threads, not from any single one. Must be specific, not generic.
2. Identify CONTRADICTIONS — cases where two threads make conflicting factual claims. For each contradiction: state the claim, which threads conflict, and which source is more credible.

Respond ONLY with valid JSON:
{
  "cross_cutting_insights": ["specific insight connecting thread A and B", "..."],
  "contradictions": [
    {
      "claim": "the disputed claim",
      "source_a": "sub-topic A name",
      "source_b": "sub-topic B name",
      "resolution": "newer_wins|primary_wins|unresolved",
      "note": "which is more credible and why"
    }
  ]
}`;

  try {
    const raw = await callLLM({
      provider: config.provider,
      model: config.model,
      system: "You are a precise research analyst identifying cross-topic patterns and contradictions. Respond only with valid JSON.",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.2,
    });
    return parseJSON<CrossAnalysisResult>(raw);
  } catch {
    // Non-fatal — fall back to thin-coverage note
    const thinTopics = findings.filter((f) => f.coverage === "thin").map((f) => f.sub_topic);
    return {
      cross_cutting_insights: thinTopics.length > 0
        ? [`Coverage is thin for: ${thinTopics.join(", ")} — treat those sections with appropriate caveats.`]
        : [],
      contradictions: [],
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emit(jobId: string, event: string, data: object) {
  sseEmitter.emit(jobId, event, data);
}

const DEPTH_SEARCHER_COUNT: Record<string, number> = {
  tier1: 3,
  tier2: 4,
  tier3: 5,
};

function buildSearcherAgents(config: ResearchConfig): AgentState[] {
  const count = DEPTH_SEARCHER_COUNT[config.depth] ?? 4;
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
      ...buildSearcherAgents(config),
      { id: "cross-analysis", name: "Cross-Analyser", role: "Finding connections", status: "idle" },
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

  // ── Cross-analysis (LLM-powered) ───────────────────────────────────────────
  const allGaps = findings.flatMap((f) => f.gaps);
  const allSources = findings.flatMap((f) => f.sources);

  await jobStore.updateAgent(jobId, "cross-analysis", { status: "running", started_at: new Date().toISOString() });
  emit(jobId, "agent_update", { agentId: "cross-analysis", status: "running" });

  const { cross_cutting_insights, contradictions } = await computeCrossAnalysis(findings, config);

  await jobStore.updateAgent(jobId, "cross-analysis", {
    status: "done",
    note: `${cross_cutting_insights.length} insights, ${contradictions.length} contradictions`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "cross-analysis", status: "done" });

  // Compute date range from sources
  const sourceDates = allSources
    .map((s) => s.date)
    .filter((d) => d && d !== "unknown")
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t));
  const dateRange = sourceDates.length > 0
    ? {
        earliest: new Date(Math.min(...sourceDates)).toISOString().split("T")[0],
        latest: new Date(Math.max(...sourceDates)).toISOString().split("T")[0],
      }
    : { earliest: "", latest: "" };

  const evidencePackage = {
    sub_topics_covered: findings.length,
    total_sources: allSources.length,
    primary_sources: allSources.filter((s) => s.type === "primary").length,
    date_range: dateRange,
    gaps_identified: allGaps,
    findings,
    cross_cutting_insights,
    contradictions,
    raw_source_list: allSources,
  };

  await jobStore.update(jobId, { evidence_package: evidencePackage });
  emit(jobId, "evidence_ready", {
    sub_topics_covered: findings.length,
    total_sources: allSources.length,
    domain_context,
  });

  // ── Optional: Personal KB context ─────────────────────────────────────────
  let kbContext = "";
  if (config.searchMyKB) {
    const job = await jobStore.get(jobId);
    if (job) {
      kbContext = await fetchKBContext(config.topic, job.user_id);
      if (kbContext) {
        emit(jobId, "kb_context", { found: true, chars: kbContext.length });
      }
    }
  }

  // ── Phase 3: Synthesizer ───────────────────────────────────────────────────
  await jobStore.updateAgent(jobId, "synthesizer", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "synthesizer", status: "running" });

  const report = await runSynthesizer(evidencePackage, config, kbContext, domain_context);

  await jobStore.updateAgent(jobId, "synthesizer", {
    status: "done",
    note: `${report.sections.length} sections written`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "synthesizer", status: "done" });

  await jobStore.update(jobId, { report, status: "done" });
  emit(jobId, "complete", { report });
}
