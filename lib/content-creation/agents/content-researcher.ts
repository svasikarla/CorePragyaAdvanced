import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { ContentCreationConfig, TopicAnalysis, ContentResearch } from "@/types/content-creation";
import { CONTENT_RESEARCHER_SYSTEM } from "./prompts";

export async function runContentResearcher(
  topicAnalysis: TopicAnalysis,
  config: ContentCreationConfig,
  kbContext: string
): Promise<ContentResearch> {
  const userMessage = `TOPIC: ${config.topic}

TOPIC ANALYSIS:
${JSON.stringify(topicAnalysis, null, 2)}

TARGET AUDIENCE: ${config.targetAudience || "General audience"}
INCLUDE CODE: ${config.includeCode}

${kbContext ? `KNOWLEDGE BASE CONTEXT (use this to enrich facts):\n${kbContext}\n` : ""}

Research this topic thoroughly and produce the structured JSON.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: CONTENT_RESEARCHER_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 2000,
    temperature: 0.3,
  });

  return parseJSON<ContentResearch>(raw);
}
