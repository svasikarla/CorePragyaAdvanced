import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import type { ContentCreationConfig, ContentCreationJob, Platform, ContentPiece } from "@/types/content-creation";
import type { AgentState } from "@/types/research";
import { contentJobStore } from "../store/job-store";
import { contentSseEmitter } from "../store/sse-emitter";
import { runTopicAnalyzer } from "./topic-analyzer";
import { runContentResearcher } from "./content-researcher";
import { runOutlineGenerator } from "./outline-generator";
import { runContentWriter } from "./content-writer";
import { runContentOptimizer } from "./content-optimizer";
import { generateEmbeddings } from "@/lib/ai-clients";
import { PLATFORM_LABELS } from "@/types/content-creation";
import { indexContentPieces } from "@/lib/content-creation/index-pieces";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── KB context fetch ──────────────────────────────────────────────────────────

async function fetchKBContext(topic: string, userId: string): Promise<string> {
  try {
    const [[embedding]] = await Promise.all([generateEmbeddings(topic)]);
    const { data: chunks } = await supabaseAdmin.rpc("match_embeddings", {
      query_embedding: embedding,
      match_threshold: 0.45,
      match_count: 5,
    });
    if (!chunks || chunks.length === 0) return "";

    const kbIds = [...new Set((chunks as { kb_id: string }[]).map((c) => c.kb_id))];
    const { data: entries } = await supabaseAdmin
      .from("knowledgebase")
      .select("title, summary_text, category")
      .in("id", kbIds)
      .eq("user_id", userId)
      .is("origin_feature", null); // echo-guard: exclude the pipeline's own prior outputs

    if (!entries || entries.length === 0) return "";

    return (entries as { title: string; summary_text: string; category: string }[])
      .map((e) => `[KB: ${e.title} — ${e.category}]\n${e.summary_text}`)
      .join("\n\n")
      .slice(0, 3000);
  } catch {
    return "";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emit(jobId: string, event: string, data: object) {
  contentSseEmitter.emit(jobId, event, data);
}

function platformAgentId(platform: Platform): string {
  return `writer-${platform}`;
}

function buildPlatformAgents(platforms: Platform[]): AgentState[] {
  return platforms.map((p) => ({
    id: platformAgentId(p),
    name: `${PLATFORM_LABELS[p]} Writer`,
    role: `Writing ${PLATFORM_LABELS[p]} content`,
    status: "idle" as const,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startContentCreationJob(
  config: ContentCreationConfig,
  userId: string
): Promise<string> {
  const maxConcurrent = Number(process.env.MAX_CONCURRENT_CONTENT_JOBS ?? 5);
  const running = await contentJobStore.countRunning();
  if (running >= maxConcurrent) {
    throw new Error(
      `Server busy — ${maxConcurrent} jobs are already running. Please try again shortly.`
    );
  }

  const jobId = nanoid(10);

  const job: ContentCreationJob = {
    id: jobId,
    user_id: userId,
    status: "queued",
    config,
    agents: [
      { id: "topic-analyzer", name: "Topic Analyzer", role: "Analyzing topic", status: "idle" },
      { id: "researcher", name: "Researcher", role: "Gathering supporting material", status: "idle" },
      { id: "outline-generator", name: "Outline Generator", role: "Structuring content", status: "idle" },
      ...buildPlatformAgents(config.targetPlatforms),
      { id: "optimizer", name: "Content Optimizer", role: "Polishing & cross-platform check", status: "idle" },
      ...(config.indexToKB
        ? [{ id: "index-kb", name: "Knowledge Indexer", role: "Saving to Knowledge Base", status: "idle" as const }]
        : []),
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await contentJobStore.set(jobId, job);

  runJob(jobId, config, userId).catch(async (err) => {
    const message =
      err instanceof Error && err.message
        ? err.message
        : String(err) || "Job failed unexpectedly";
    console.error(`[content-creation] job ${jobId} failed:`, message);
    try {
      await contentJobStore.update(jobId, { status: "error", error: message });
    } catch (updateErr) {
      console.error(`[content-creation] could not persist error for job ${jobId}:`, updateErr);
    }
    emit(jobId, "error", { message });
  });

  return jobId;
}

// ── Internal execution ────────────────────────────────────────────────────────

async function runJob(jobId: string, config: ContentCreationConfig, userId: string) {
  await contentJobStore.update(jobId, { status: "running" });
  emit(jobId, "status", { status: "running" });

  // ── Phase 1: Topic Analyzer ───────────────────────────────────────────────
  await contentJobStore.updateAgent(jobId, "topic-analyzer", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "topic-analyzer", status: "running" });

  const topicAnalysis = await runTopicAnalyzer(config);

  await contentJobStore.update(jobId, { topic_analysis: topicAnalysis });
  await contentJobStore.updateAgent(jobId, "topic-analyzer", {
    status: "done",
    note: `${topicAnalysis.key_concepts.length} concepts identified`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "topic-analyzer",
    status: "done",
    note: `${topicAnalysis.key_concepts.length} concepts`,
  });

  // ── Optional KB context ────────────────────────────────────────────────────
  let kbContext = "";
  if (config.searchMyKB) {
    kbContext = await fetchKBContext(config.topic, userId);
    if (kbContext) {
      emit(jobId, "kb_context", { found: true, chars: kbContext.length });
    }
  }

  // ── Phase 2: Researcher ───────────────────────────────────────────────────
  await contentJobStore.updateAgent(jobId, "researcher", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "researcher", status: "running" });

  const research = await runContentResearcher(topicAnalysis, config, kbContext);

  await contentJobStore.update(jobId, { research });
  await contentJobStore.updateAgent(jobId, "researcher", {
    status: "done",
    note: `${research.key_facts.length} facts gathered`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "researcher",
    status: "done",
    note: `${research.key_facts.length} facts`,
  });

  // ── Phase 3: Outline Generator ────────────────────────────────────────────
  await contentJobStore.updateAgent(jobId, "outline-generator", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "outline-generator", status: "running" });

  const outline = await runOutlineGenerator(topicAnalysis, research, config);

  await contentJobStore.update(jobId, { outline });
  await contentJobStore.updateAgent(jobId, "outline-generator", {
    status: "done",
    note: `${outline.platform_outlines.length} platform outlines`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "outline-generator",
    status: "done",
    note: `${outline.platform_outlines.length} outlines`,
  });

  // ── Phase 4: Parallel content writers ─────────────────────────────────────
  for (const platform of config.targetPlatforms) {
    const agentId = platformAgentId(platform);
    await contentJobStore.updateAgent(jobId, agentId, {
      status: "running",
      started_at: new Date().toISOString(),
    });
    emit(jobId, "agent_update", { agentId, status: "running" });
  }

  const writerResults = await Promise.allSettled(
    config.targetPlatforms.map((platform) =>
      runContentWriter(platform, topicAnalysis, research, outline, config, kbContext)
    )
  );

  const contentPieces: ContentPiece[] = [];

  await Promise.all(
    writerResults.map(async (result, i) => {
      const platform = config.targetPlatforms[i]!;
      const agentId = platformAgentId(platform);

      if (result.status === "fulfilled") {
        contentPieces.push(result.value);
        await contentJobStore.updateAgent(jobId, agentId, {
          status: "done",
          note: `${result.value.metadata.readingTimeMinutes ?? "?"} min read`,
          completed_at: new Date().toISOString(),
        });
        emit(jobId, "agent_update", {
          agentId,
          status: "done",
          note: `${result.value.metadata.readingTimeMinutes ?? "?"} min`,
        });
      } else {
        await contentJobStore.updateAgent(jobId, agentId, {
          status: "error",
          note: String((result.reason as Error)?.message ?? "Writer failed"),
        });
        emit(jobId, "agent_update", { agentId, status: "error" });
      }
    })
  );

  await contentJobStore.update(jobId, { content_pieces: contentPieces });
  emit(jobId, "content_ready", { count: contentPieces.length });

  // ── Phase 5: Content Optimizer ────────────────────────────────────────────
  await contentJobStore.updateAgent(jobId, "optimizer", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "optimizer", status: "running" });

  await runContentOptimizer(contentPieces, config);

  await contentJobStore.updateAgent(jobId, "optimizer", {
    status: "done",
    note: `${contentPieces.length} pieces optimized`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "optimizer",
    status: "done",
    note: `${contentPieces.length} pieces ready`,
  });

  // ── Optional: index content pieces back into the Knowledge Base (non-fatal) ─
  if (config.indexToKB && contentPieces.length) {
    await contentJobStore.updateAgent(jobId, "index-kb", {
      status: "running",
      started_at: new Date().toISOString(),
    });
    emit(jobId, "agent_update", { agentId: "index-kb", status: "running" });
    try {
      const n = await indexContentPieces(jobId, contentPieces, config.topic, userId);
      await contentJobStore.updateAgent(jobId, "index-kb", {
        status: "done",
        note: `Saved ${n} piece${n !== 1 ? "s" : ""} to Knowledge Base`,
        completed_at: new Date().toISOString(),
      });
      emit(jobId, "agent_update", { agentId: "index-kb", status: "done", note: `Saved ${n} to Knowledge Base` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Indexing failed";
      console.error(`[content-creation] index-to-KB failed for job ${jobId}:`, msg);
      await contentJobStore.updateAgent(jobId, "index-kb", { status: "error", note: msg.slice(0, 120) });
      emit(jobId, "agent_update", { agentId: "index-kb", status: "error", note: "Could not save to KB" });
    }
  }

  await contentJobStore.update(jobId, { status: "done" });
  emit(jobId, "complete", { content_pieces: contentPieces });
}
