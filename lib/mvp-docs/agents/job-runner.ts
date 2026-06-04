import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import type { MvpDocsConfig, MvpDocsJob, DocType, MvpDocument } from "@/types/mvp-docs";
import type { AgentState } from "@/types/research";
import { DOC_LABELS } from "@/types/mvp-docs";
import { mvpDocsJobStore } from "../store/job-store";
import { mvpDocsSseEmitter } from "../store/sse-emitter";
import { runBriefAnalyzer } from "./brief-analyzer";
import { runDocumentGenerator } from "./document-generator";
import { runConsistencyChecker } from "./consistency-checker";
import { generateEmbeddings } from "@/lib/ai-clients";
import { indexMvpDocuments } from "@/lib/mvp-docs/index-documents";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── KB context fetch ──────────────────────────────────────────────────────────

async function fetchKBContext(brief: string, userId: string): Promise<string> {
  try {
    const [[embedding]] = await Promise.all([generateEmbeddings(brief)]);
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
  mvpDocsSseEmitter.emit(jobId, event, data);
}

function docAgentId(docType: DocType): string {
  return `doc-${docType}`;
}

function buildDocAgents(docTypes: DocType[]): AgentState[] {
  return docTypes.map((d) => ({
    id: docAgentId(d),
    name: DOC_LABELS[d],
    role: `Drafting ${DOC_LABELS[d]}`,
    status: "idle" as const,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startMvpDocsJob(
  config: MvpDocsConfig,
  userId: string
): Promise<string> {
  const maxConcurrent = Number(process.env.MAX_CONCURRENT_MVP_DOCS_JOBS ?? 5);
  const running = await mvpDocsJobStore.countRunning();
  if (running >= maxConcurrent) {
    throw new Error(
      `Server busy — ${maxConcurrent} jobs are already running. Please try again shortly.`
    );
  }

  const jobId = nanoid(10);

  const job: MvpDocsJob = {
    id: jobId,
    user_id: userId,
    status: "queued",
    config,
    agents: [
      { id: "brief-analyzer", name: "Brief Analyzer", role: "Building shared source of truth", status: "idle" },
      ...buildDocAgents(config.targetDocs),
      { id: "consistency-checker", name: "Consistency Checker", role: "Cross-document review", status: "idle" },
      ...(config.indexToKB
        ? [{ id: "index-kb", name: "Knowledge Indexer", role: "Saving to Knowledge Base", status: "idle" as const }]
        : []),
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await mvpDocsJobStore.set(jobId, job);

  runJob(jobId, config, userId).catch(async (err) => {
    const message =
      err instanceof Error && err.message
        ? err.message
        : String(err) || "Job failed unexpectedly";
    console.error(`[mvp-docs] job ${jobId} failed:`, message);
    try {
      await mvpDocsJobStore.update(jobId, { status: "error", error: message });
    } catch (updateErr) {
      console.error(`[mvp-docs] could not persist error for job ${jobId}:`, updateErr);
    }
    emit(jobId, "error", { message });
  });

  return jobId;
}

// ── Internal execution ────────────────────────────────────────────────────────

async function runJob(jobId: string, config: MvpDocsConfig, userId: string) {
  await mvpDocsJobStore.update(jobId, { status: "running" });
  emit(jobId, "status", { status: "running" });

  // ── Phase 1: Brief Analyzer ───────────────────────────────────────────────
  await mvpDocsJobStore.updateAgent(jobId, "brief-analyzer", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "brief-analyzer", status: "running" });

  // Optional KB context (fetched alongside analysis input)
  let kbContext = "";
  if (config.searchMyKB) {
    kbContext = await fetchKBContext(config.productBrief, userId);
    if (kbContext) emit(jobId, "kb_context", { found: true, chars: kbContext.length });
  }

  const briefAnalysis = await runBriefAnalyzer(config);

  await mvpDocsJobStore.update(jobId, { brief_analysis: briefAnalysis });
  await mvpDocsJobStore.updateAgent(jobId, "brief-analyzer", {
    status: "done",
    note: `${briefAnalysis.core_features.length} features, ${briefAnalysis.target_users.length} personas`,
    completed_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", {
    agentId: "brief-analyzer",
    status: "done",
    note: `${briefAnalysis.core_features.length} features identified`,
  });

  // ── Phase 2: Parallel document generators ─────────────────────────────────
  for (const docType of config.targetDocs) {
    const agentId = docAgentId(docType);
    await mvpDocsJobStore.updateAgent(jobId, agentId, {
      status: "running",
      started_at: new Date().toISOString(),
    });
    emit(jobId, "agent_update", { agentId, status: "running" });
  }

  const genResults = await Promise.allSettled(
    config.targetDocs.map((docType) =>
      runDocumentGenerator(docType, briefAnalysis, config, kbContext)
    )
  );

  const documents: MvpDocument[] = [];

  await Promise.all(
    genResults.map(async (result, i) => {
      const docType = config.targetDocs[i]!;
      const agentId = docAgentId(docType);

      if (result.status === "fulfilled") {
        documents.push(result.value);
        await mvpDocsJobStore.updateAgent(jobId, agentId, {
          status: "done",
          note: `${result.value.metadata.wordCount ?? "?"} words`,
          completed_at: new Date().toISOString(),
        });
        emit(jobId, "agent_update", {
          agentId,
          status: "done",
          note: `${result.value.metadata.wordCount ?? "?"} words`,
        });
      } else {
        await mvpDocsJobStore.updateAgent(jobId, agentId, {
          status: "error",
          note: String((result.reason as Error)?.message ?? "Generation failed"),
        });
        emit(jobId, "agent_update", { agentId, status: "error" });
      }
    })
  );

  // Preserve the user's selected order in the stored bundle
  documents.sort(
    (a, b) => config.targetDocs.indexOf(a.docType) - config.targetDocs.indexOf(b.docType)
  );

  await mvpDocsJobStore.update(jobId, { documents });
  emit(jobId, "documents_ready", { count: documents.length });

  // ── Phase 3: Consistency Checker ──────────────────────────────────────────
  await mvpDocsJobStore.updateAgent(jobId, "consistency-checker", {
    status: "running",
    started_at: new Date().toISOString(),
  });
  emit(jobId, "agent_update", { agentId: "consistency-checker", status: "running" });

  let consistencyReport;
  if (documents.length >= 2) {
    try {
      consistencyReport = await runConsistencyChecker(documents, config);
      await mvpDocsJobStore.update(jobId, { consistency_report: consistencyReport });
      await mvpDocsJobStore.updateAgent(jobId, "consistency-checker", {
        status: "done",
        note: `${consistencyReport.overall_consistency} consistency, ${consistencyReport.contradictions.length} issues`,
        completed_at: new Date().toISOString(),
      });
      emit(jobId, "agent_update", {
        agentId: "consistency-checker",
        status: "done",
        note: `${consistencyReport.contradictions.length} issues found`,
      });
    } catch (err) {
      // A failed consistency pass should not fail the whole bundle.
      await mvpDocsJobStore.updateAgent(jobId, "consistency-checker", {
        status: "error",
        note: String((err as Error)?.message ?? "Review failed"),
      });
      emit(jobId, "agent_update", { agentId: "consistency-checker", status: "error" });
    }
  } else {
    await mvpDocsJobStore.updateAgent(jobId, "consistency-checker", {
      status: "done",
      note: "Skipped — need 2+ documents",
      completed_at: new Date().toISOString(),
    });
    emit(jobId, "agent_update", { agentId: "consistency-checker", status: "done", note: "Skipped" });
  }

  // ── Optional: index each document back into the Knowledge Base (non-fatal) ──
  if (config.indexToKB && documents.length) {
    await mvpDocsJobStore.updateAgent(jobId, "index-kb", {
      status: "running",
      started_at: new Date().toISOString(),
    });
    emit(jobId, "agent_update", { agentId: "index-kb", status: "running" });
    try {
      const n = await indexMvpDocuments(jobId, documents, config.productName, userId);
      await mvpDocsJobStore.updateAgent(jobId, "index-kb", {
        status: "done",
        note: `Saved ${n} doc${n !== 1 ? "s" : ""} to Knowledge Base`,
        completed_at: new Date().toISOString(),
      });
      emit(jobId, "agent_update", { agentId: "index-kb", status: "done", note: `Saved ${n} to Knowledge Base` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Indexing failed";
      console.error(`[mvp-docs] index-to-KB failed for job ${jobId}:`, msg);
      await mvpDocsJobStore.updateAgent(jobId, "index-kb", { status: "error", note: msg.slice(0, 120) });
      emit(jobId, "agent_update", { agentId: "index-kb", status: "error", note: "Could not save to KB" });
    }
  }

  await mvpDocsJobStore.update(jobId, { status: "done" });
  emit(jobId, "complete", { documents, consistency_report: consistencyReport });
}
