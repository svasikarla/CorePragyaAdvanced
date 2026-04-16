import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { ResearchConfig, SubTopic } from "@/types/research";
import { ORCHESTRATOR_SYSTEM } from "./prompts";

export interface OrchestratorOutput {
  sub_topics: SubTopic[];
  domain_context: string;
}

const DEPTH_INSTRUCTIONS: Record<string, string> = {
  tier1: "Brief overview — 3 sub-topics maximum",
  tier2: "Standard research — 3-4 sub-topics covering key angles",
  tier3: "Comprehensive deep-dive — 5 sub-topics, each thoroughly covered",
};

export async function runOrchestrator(
  config: ResearchConfig
): Promise<OrchestratorOutput> {
  const prompt = `Research topic: "${config.topic}"
Depth: ${DEPTH_INSTRUCTIONS[config.depth]}
Audience: ${config.audience}
Domain hints: ${getDomainHints(config.topic)}

Decompose this into specific sub-questions and search briefs.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: ORCHESTRATOR_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1500,
  });

  return parseJSON<OrchestratorOutput>(raw);
}

function getDomainHints(topic: string): string {
  const lower = topic.toLowerCase();
  const hints: string[] = [];

  if (lower.includes("oracle") || lower.includes("c2m") || lower.includes("cc&b"))
    hints.push("Oracle utilities domain — prioritise oracle.com, utility analyst reports");
  if (lower.includes("nl2sql") || lower.includes("text-to-sql") || lower.includes("text to sql"))
    hints.push("NL2SQL domain — prioritise arxiv, GitHub, AI lab blogs");
  if (lower.includes("mcp") || lower.includes("model context protocol"))
    hints.push("MCP ecosystem — prioritise modelcontextprotocol.io, Anthropic blog");
  if (lower.includes("discom") || lower.includes("india") || lower.includes("utility sector"))
    hints.push("Indian energy — prioritise government sources, IEEMA, Power Line magazine");

  return hints.length > 0 ? hints.join("; ") : "General technology and business domain";
}
