import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type {
  ContentCreationConfig,
  ContentPiece,
} from "@/types/content-creation";
import { CONTENT_OPTIMIZER_SYSTEM } from "./prompts";

export interface OptimizationSummary {
  cross_platform_consistency: string;
  seo_score: "high" | "medium" | "low";
  engagement_tips: string[];
  platform_specific_improvements: Array<{ platform: string; improvement: string }>;
  best_performing_prediction: string;
  hashtag_master_list: string[];
}

export async function runContentOptimizer(
  contentPieces: ContentPiece[],
  config: ContentCreationConfig
): Promise<OptimizationSummary> {
  const piecesSummary = contentPieces.map((p) => ({
    platform: p.platform,
    title: p.title,
    wordCount: p.content.split(/\s+/).length,
    hashtags: p.metadata.hashtags,
    tags: p.metadata.tags,
    characterCount: p.metadata.characterCount,
  }));

  const userMessage = `TOPIC: ${config.topic}
TONE: ${config.tone}
AUDIENCE: ${config.targetAudience}

GENERATED CONTENT SUMMARY:
${JSON.stringify(piecesSummary, null, 2)}

Review these pieces for cross-platform consistency and return optimization recommendations.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: CONTENT_OPTIMIZER_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 1500,
    temperature: 0.2,
  });

  return parseJSON<OptimizationSummary>(raw);
}
