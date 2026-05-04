import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import type { TechResearchConfig, TechResearchJob } from "@/types/tech-research";
import type { AgentState } from "@/types/research";
import { techJobStore } from "../store/job-store";
import { techSseEmitter } from "../store/sse-emitter";
import { runRequirementAnalyzer } from "./requirement-analyzer";
import { runSolutionScanner } from "./solution-scanner";
import { runTechnologyEvaluator } from "./technology-evaluator";
import { runTradeoffAnalyst } from "./tradeoff-analyst";
import { runArchitectureSynthesizer } from "./architecture-synthesizer";
import { generateEmbeddings } from "@/lib/ai-clients";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── KB context fetch (reused pattern from research module) ────────────────────

async function fetchKBContext(requirement: string, userId: string): Promise<string> {
  try {
    const [[embedding]] = await Promise.all([generateEmbeddings(requirement)]);
    const { data: chunks } = await supabaseAdmin.rpc("match_embeddings", {
      query_embedding: embedding,
      match_threshold: 0.45,
      match_count: 6,
    });
    if (!chunks || chunks.length === 0) return "";

    const kbIds = [...new Set((chunks as { kb_id: string }[]).map((c) => c.kb_id))];
    const { data: entries } = await supabaseAdmin
      .from("knowledgebase")
      .select("title, summary_text, category")
      .in("id", kbIds)
      .eq("user_id", userId);

    if (!entries || entries.length === 0) return "";

    return (entries as { title: string; summary_text: string; category: string }[])
      .map((e) => `[KB: ${e.title} — ${e.category}]\n${e.summary_text}`)
      .join("\n\n")
      .slice(0, 4000);
  } catch {
    return "";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emit(jobId: string, event: string, data: object) {
  techSseEmitter.emit(jobId, event, data);
}

const EVALUATOR_COUNT: Record<string, number> = {
  tier1: 4,
  tier2: 6,
  tier3: 8,
};

function buildEvaluatorAgents(count: number): AgentState[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `evaluator-${String.fromCharCode(97 + i)}`,
    name: `Evaluator ${String.fromCharCode(65 + i)}`,
    role: "Evaluating candidate",
    status: "idle" as const,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startTechResearchJob(
  config: TechResearchConfig,
  userId: string
): Promise<string> {
  const maxConcurrent = Number(process.env.MAX_CONCURRENT_RESEARCH_JOBS ?? 5);
  const running = await techJobStore.countRunning();
  if (running >= maxConcurrent) {
    throw new Error(
      `Server busy — ${maxConcurrent} jobs are already running. Please try again shortly.`
    );
  }

  const jobId = nanoid(10);
  const evalCount = EVALUATOR_COUNT[config.depth] ?? 6;

  const job: TechResearchJob = {
    id: jobId,
    user_id: userId,
    status: "queued",
    config,
    agents: [
      {
        id: "req-analyzer",
        name: "Requirement Analyzer",
        role: "Parsing requirement",
        status: "idle",
      },
      {
        id: "solution-scanner",
        name: "Solution Scanner",
        role: "Mapping solution landscape",
        status: "idle",
      },
      ...buildEvaluatorAgents(evalCount),
      {
        id: "tradeoff-analyst",
        name: "Trade-off Analyst",
        role: "Building comparison matrix",
        status: "idle",
      },
      {
        id: "arch-synthesizer",
        name: "Architecture Synthesizer",
        role: "Writing blueprint",
        status: "idle",
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await techJobStore.set(jobId, job);

  // Fire and forget — response returns jobId immediately
  runJob(jobId, config, userId).catch(async (err) => {
    const message =
      err instanceof Error && err.message
        ? err.message
        : !(err instanceof Error)
          ? (String(err) || "Job failed unexpectedly")
          : "Job failed unexpectedly"; // Error with empty message
    console.error(`[tech-research] job ${jobId} failed:`, message);
    try {
      await techJobStore.update(jobId, { status: "error", error: message });
    } catch (updateErr) {
      console.error(`[tech-research] could not persist error state for job ${jobId}:`, updateErr);
    }
    emit(jobId, "error", { message });
  });

  return jobId;
}

// ── Internal execution ────────────────────────────────────────────────────────

async function runJob(
  jobId: string,
  config: TechResearchConfig,
  userId: string
) {
  await techJobStore.update(jobId, { status: "running" });
  emit(jobId, "status", { status: "running" });

  // ── Phase 1: Requirement Analyzer ─────────────────────────────────────────
  await techJobStore.updateAgent(jobId, "req-analyzer", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "req-analyzer", status: "running" });

  const requirementAnalysis = await runRequirementAnalyzer(config);

  await techJobStore.update(jobId, { requirement_analysis: requirementAnalysis });
  await techJobStore.updateAgent(jobId, "req-analyzer", {
    status: "done",
    note: `${requirementAnalysis.functional.length} functional requirements parsed`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "req-analyzer",
    status: "done",
    note: `${requirementAnalysis.functional.length} requirements`,
  });

  // ── Phase 2: Solution Scanner ─────────────────────────────────────────────
  await techJobStore.updateAgent(jobId, "solution-scanner", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "solution-scanner", status: "running" });

  const solutionLandscape = await runSolutionScanner(requirementAnalysis, config);

  await techJobStore.update(jobId, { solution_landscape: solutionLandscape });
  await techJobStore.updateAgent(jobId, "solution-scanner", {
    status: "done",
    note: `${solutionLandscape.candidates.length} candidates found`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "solution-scanner",
    status: "done",
    note: `${solutionLandscape.candidates.length} candidates`,
  });

  // ── Phase 3: Parallel technology evaluators ───────────────────────────────
  const evalCount = EVALUATOR_COUNT[config.depth] ?? 6;
  const candidatesToEval = solutionLandscape.candidates.slice(0, evalCount);
  const evalIds = candidatesToEval.map((_, i) => `evaluator-${String.fromCharCode(97 + i)}`);

  // Update evaluator agent roles to actual candidate names
  for (let i = 0; i < candidatesToEval.length; i++) {
    const candidate = candidatesToEval[i];
    const id = evalIds[i];
    if (candidate && id) {
      await techJobStore.updateAgent(jobId, id, {
        role: candidate.name.slice(0, 60),
        status: "running",
        started_at: new Date().toISOString(),
      });
      emit(jobId, "agent_update", { agentId: id, status: "running", note: candidate.name });
    }
  }

  const evalResults = await Promise.allSettled(
    candidatesToEval.map((candidate) =>
      runTechnologyEvaluator(candidate, config)
    )
  );

  const evaluations = await Promise.all(
    evalResults.map(async (result, i) => {
      const id = evalIds[i]!;
      const candidate = candidatesToEval[i]!;
      if (result.status === "fulfilled") {
        await techJobStore.updateAgent(jobId, id, {
          status: "done",
          note: `Score: ${result.value.weighted_total}`,
          completed_at: new Date().toISOString(),
        });
        emit(jobId, "agent_update", {
          agentId: id,
          status: "done",
          note: `${result.value.candidate_name}: ${result.value.weighted_total}`,
        });
        return result.value;
      } else {
        await techJobStore.updateAgent(jobId, id, {
          status: "error",
          note: String((result.reason as Error)?.message ?? "Evaluation failed"),
        });
        emit(jobId, "agent_update", { agentId: id, status: "error" });
        // Return a minimal placeholder so we don't drop the candidate entirely
        return {
          candidate_name: candidate.name,
          metrics: {},
          scores: [],
          weighted_total: 0,
          pros: [],
          cons: ["Evaluation failed — insufficient data"],
          stack_compatibility_note: "Unknown",
          known_gotchas: [],
          migration_complexity: "medium" as const,
          community_health: "unknown" as const,
          security_cves: "Unknown",
          sources: [],
        };
      }
    })
  );

  await techJobStore.update(jobId, { evaluations });
  emit(jobId, "evaluations_ready", { count: evaluations.length });

  // ── Phase 4: Trade-off Analyst ────────────────────────────────────────────
  await techJobStore.updateAgent(jobId, "tradeoff-analyst", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "tradeoff-analyst", status: "running" });

  const tradeoffMatrix = await runTradeoffAnalyst(evaluations, config);

  await techJobStore.update(jobId, { tradeoff_matrix: tradeoffMatrix });
  await techJobStore.updateAgent(jobId, "tradeoff-analyst", {
    status: "done",
    note: `Winner: ${tradeoffMatrix.winner} (${tradeoffMatrix.confidence} confidence)`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "tradeoff-analyst",
    status: "done",
    note: `Winner: ${tradeoffMatrix.winner}`,
  });

  // ── Optional KB context ────────────────────────────────────────────────────
  let kbContext = "";
  if (config.searchMyKB) {
    kbContext = await fetchKBContext(config.requirement, userId);
    if (kbContext) {
      emit(jobId, "kb_context", { found: true, chars: kbContext.length });
    }
  }

  // ── Phase 5: Architecture Synthesizer ─────────────────────────────────────
  await techJobStore.updateAgent(jobId, "arch-synthesizer", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "arch-synthesizer", status: "running" });

  const { blueprint, report } = await runArchitectureSynthesizer(
    requirementAnalysis,
    solutionLandscape,
    tradeoffMatrix,
    evaluations,
    config,
    kbContext
  );

  await techJobStore.updateAgent(jobId, "arch-synthesizer", {
    status: "done",
    note: `${blueprint.phases.length} implementation phases`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "arch-synthesizer",
    status: "done",
    note: `${blueprint.phases.length} phases`,
  });

  await techJobStore.update(jobId, { report, status: "done" });
  emit(jobId, "complete", { report });
}
