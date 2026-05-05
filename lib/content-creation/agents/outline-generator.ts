import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type {
  ContentCreationConfig,
  TopicAnalysis,
  ContentResearch,
  ContentOutline,
} from "@/types/content-creation";
import { OUTLINE_GENERATOR_SYSTEM } from "./prompts";

export async function runOutlineGenerator(
  topicAnalysis: TopicAnalysis,
  research: ContentResearch,
  config: ContentCreationConfig
): Promise<ContentOutline> {
  const userMessage = `TOPIC: ${config.topic}
PLATFORMS: ${config.targetPlatforms.join(", ")}
TONE: ${config.tone}
AUDIENCE: ${config.targetAudience || "General"}

TOPIC ANALYSIS:
${JSON.stringify(topicAnalysis, null, 2)}

RESEARCH HIGHLIGHTS:
Key Facts: ${research.key_facts.slice(0, 5).join(" | ")}
Examples: ${research.examples.slice(0, 3).join(" | ")}
Core Message Suggestion: ${topicAnalysis.unique_angles[0] ?? config.topic}

Generate platform-specific outlines for each of the target platforms listed above.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: OUTLINE_GENERATOR_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 3000,
    temperature: 0.3,
  });

  return parseJSON<ContentOutline>(raw);
}
