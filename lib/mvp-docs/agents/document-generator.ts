import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { DocType, BriefAnalysis, MvpDocsConfig, MvpDocument, DocMetadata } from "@/types/mvp-docs";
import { DOC_GENERATOR_SYSTEM, buildDocGeneratorUser } from "./prompts";

interface GeneratorOutput {
  title: string;
  content: string;
  metadata: DocMetadata;
}

export async function runDocumentGenerator(
  docType: DocType,
  brief: BriefAnalysis,
  config: MvpDocsConfig,
  kbContext: string
): Promise<MvpDocument> {
  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: DOC_GENERATOR_SYSTEM,
    messages: [{ role: "user", content: buildDocGeneratorUser(docType, brief, config, kbContext) }],
    max_tokens: 5000,
    temperature: 0.4,
  });

  const parsed = parseJSON<GeneratorOutput>(raw);

  const metadata: DocMetadata = parsed.metadata ?? {};
  if (!metadata.wordCount) {
    metadata.wordCount = parsed.content.split(/\s+/).filter(Boolean).length;
  }

  return {
    docType,
    title: parsed.title,
    content: parsed.content,
    metadata,
  };
}
