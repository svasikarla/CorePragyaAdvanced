import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { MvpDocsConfig, MvpDocument, ConsistencyReport } from "@/types/mvp-docs";
import { DOC_LABELS } from "@/types/mvp-docs";
import { CONSISTENCY_CHECKER_SYSTEM, buildConsistencyCheckerUser } from "./prompts";

export async function runConsistencyChecker(
  documents: MvpDocument[],
  config: MvpDocsConfig
): Promise<ConsistencyReport> {
  // Keep the payload bounded: pass each doc's summary + a content excerpt.
  const docs = documents.map((d) => ({
    label: DOC_LABELS[d.docType],
    summary: d.metadata.summary ?? "",
    excerpt: d.content.slice(0, 1800),
  }));

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: CONSISTENCY_CHECKER_SYSTEM,
    messages: [{ role: "user", content: buildConsistencyCheckerUser(docs) }],
    max_tokens: 2500,
    temperature: 0.2,
  });

  return parseJSON<ConsistencyReport>(raw);
}
