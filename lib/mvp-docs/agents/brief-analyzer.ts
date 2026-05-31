import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { MvpDocsConfig, BriefAnalysis } from "@/types/mvp-docs";
import { BRIEF_ANALYZER_SYSTEM, buildBriefAnalyzerUser } from "./prompts";

export async function runBriefAnalyzer(config: MvpDocsConfig): Promise<BriefAnalysis> {
  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: BRIEF_ANALYZER_SYSTEM,
    messages: [{ role: "user", content: buildBriefAnalyzerUser(config) }],
    max_tokens: 2500,
    temperature: 0.2,
  });

  return parseJSON<BriefAnalysis>(raw);
}
