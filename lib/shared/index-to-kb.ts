import { createClient } from "@supabase/supabase-js";
import { generateEmbeddings } from "@/lib/ai-clients";

// ── Closed-loop knowledge: write an agent-generated artifact back into the KB ───
//
// Inserts/updates one `knowledgebase` row (keyed by provenance for idempotency),
// then re-chunks and re-embeds it into the `embeddings` table using the SAME
// schema the `match_embeddings` RPC reads (kb_id, chunk_text, chunk_index, vector),
// so the output becomes retrievable by RAG search and visible in the graph.

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface IndexArtifactParams {
  userId: string;
  originFeature: "research" | "tech_research" | "mvp_docs" | "content";
  originJobId: string;
  originArtifactKey: string; // 'report' | a docType | a platform — unique within a job
  sourceType: string;        // matches origin_feature; allowed by the source_type CHECK
  sourceRef: string;         // deep link back to the job, e.g. /research/history/<id>
  title: string;
  category: string;
  summaryText: string;
  summaryJson: Record<string, unknown>;
  rawText: string;
}

// Paragraph-aware chunker (~targetSize chars), with a hard split for very long blocks.
export function chunkText(text: string, targetSize = 1000): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && (cur.length + 2 + p.length) > targetSize) {
      chunks.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${p}` : p;
    while (cur.length > targetSize * 1.5) {
      chunks.push(cur.slice(0, targetSize));
      cur = cur.slice(targetSize);
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text.slice(0, targetSize) || "(empty)"];
}

export async function indexArtifactToKB(
  params: IndexArtifactParams
): Promise<{ kbId: string; chunks: number }> {
  const db = admin();

  const row = {
    user_id: params.userId,
    source_type: params.sourceType,
    source_ref: params.sourceRef,
    raw_text: params.rawText,
    summary_text: params.summaryText,
    summary_json: params.summaryJson,
    category: params.category,
    title: params.title,
    origin_feature: params.originFeature,
    origin_job_id: params.originJobId,
    origin_artifact_key: params.originArtifactKey,
  };

  // ── Idempotency: update in place if this (user, job, artifact) was indexed before
  const { data: existing } = await db
    .from("knowledgebase")
    .select("id")
    .eq("user_id", params.userId)
    .eq("origin_job_id", params.originJobId)
    .eq("origin_artifact_key", params.originArtifactKey)
    .maybeSingle();

  let kbId: string;
  if (existing?.id) {
    kbId = existing.id;
    const { error } = await db.from("knowledgebase").update(row).eq("id", kbId);
    if (error) throw new Error(`KB update failed: ${error.message}`);
  } else {
    const { data: inserted, error } = await db
      .from("knowledgebase")
      .insert(row)
      .select("id")
      .single();
    if (error || !inserted) throw new Error(`KB insert failed: ${error?.message ?? "no row"}`);
    kbId = inserted.id;
  }

  // Clear existing embeddings for this entry before re-embedding — this removes
  // both stale chunks from a prior index AND the placeholder row that the
  // knowledgebase insert trigger auto-creates (chunk_index 1, vector NULL) —
  // so only our freshly-embedded chunks remain.
  await db.from("embeddings").delete().eq("kb_id", kbId);

  // ── Chunk + embed (batched) into the match_embeddings-compatible schema
  const chunks = chunkText(params.rawText);
  const vectors: number[][] = [];
  const BATCH = 90;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const part = await generateEmbeddings(chunks.slice(i, i + BATCH));
    vectors.push(...part);
  }

  const embeddingRows = chunks.map((chunk_text, chunk_index) => ({
    kb_id: kbId,
    chunk_text,
    chunk_index,
    vector: vectors[chunk_index],
  }));

  for (let i = 0; i < embeddingRows.length; i += 100) {
    const { error } = await db.from("embeddings").insert(embeddingRows.slice(i, i + 100));
    if (error) throw new Error(`embeddings insert failed: ${error.message}`);
  }

  return { kbId, chunks: chunks.length };
}
