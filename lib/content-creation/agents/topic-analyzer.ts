import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { ContentCreationConfig, TopicAnalysis } from "@/types/content-creation";
import { TOPIC_ANALYZER_SYSTEM } from "./prompts";

export async function runTopicAnalyzer(config: ContentCreationConfig): Promise<TopicAnalysis> {
  const userMessage = `TOPIC: ${config.topic}

ADDITIONAL CONTEXT: ${config.additionalContext || "None provided"}

TARGET PLATFORMS: ${config.targetPlatforms.join(", ")}
DESIRED TONE: ${config.tone}
TARGET AUDIENCE: ${config.targetAudience || "Not specified"}
KEYWORDS: ${config.keywords || "None specified"}
INCLUDE CODE EXAMPLES: ${config.includeCode}

Analyze this topic and produce the structured JSON.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: TOPIC_ANALYZER_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 1500,
    temperature: 0.2,
  });

  return parseJSON<TopicAnalysis>(raw);
}
