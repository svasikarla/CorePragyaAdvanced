import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { ResearchConfig, SubTopic } from "@/types/research";
import { ORCHESTRATOR_SYSTEM } from "./prompts";

export interface OrchestratorOutput {
  sub_topics: SubTopic[];
  domain_context: string;
}

const DEPTH_CONFIG: Record<string, { count: number; label: string }> = {
  tier1: { count: 3, label: "Quick overview — 3 sub-topics, breadth over depth" },
  tier2: { count: 4, label: "Standard research — 4 sub-topics balancing breadth and depth" },
  tier3: { count: 5, label: "Deep dive — 5 sub-topics, maximum coverage and rigour" },
};

export async function runOrchestrator(
  config: ResearchConfig
): Promise<OrchestratorOutput> {
  const depthCfg = DEPTH_CONFIG[config.depth] ?? DEPTH_CONFIG.tier2;
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const prompt = `Research topic: "${config.topic}"

Depth: ${depthCfg.label}
Sub-topics required: exactly ${depthCfg.count}
Audience: ${config.audience}
Today's date: ${today} — use this to judge recency requirements and prioritise recent sources where relevant

Domain hints (use to sharpen queries): ${getDomainHints(config.topic)}

Decompose the topic into exactly ${depthCfg.count} sub-questions following the angle diversity rules in your instructions.
Each sub-question must explore a distinct facet — no overlap.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: ORCHESTRATOR_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.15,
  });

  const output = parseJSON<OrchestratorOutput>(raw);

  // Enforce the depth count — trim extras or flag shortage
  if (output.sub_topics.length > depthCfg.count) {
    output.sub_topics = output.sub_topics.slice(0, depthCfg.count);
  }

  return output;
}

function getDomainHints(topic: string): string {
  const lower = topic.toLowerCase();
  const hints: string[] = [];

  if (lower.includes("oracle") || lower.includes("c2m") || lower.includes("cc&b"))
    hints.push("Oracle utilities domain — prioritise oracle.com, utility analyst reports, Gartner");
  if (lower.includes("nl2sql") || lower.includes("text-to-sql") || lower.includes("text to sql"))
    hints.push("NL2SQL / Text-to-SQL domain — prioritise arxiv.org, GitHub repos, AI lab blogs (Google, Meta, Microsoft)");
  if (lower.includes("mcp") || lower.includes("model context protocol"))
    hints.push("MCP ecosystem — prioritise modelcontextprotocol.io, Anthropic blog, developer forums");
  if (lower.includes("discom") || lower.includes("india") || lower.includes("utility sector"))
    hints.push("Indian energy / utility sector — prioritise government sources (mnre.gov.in, cea.nic.in), IEEMA, Power Line magazine");
  if (lower.includes("ai") || lower.includes("llm") || lower.includes("generative"))
    hints.push("AI/ML domain — prioritise arxiv.org, vendor research blogs, McKinsey Global Institute, Stanford HAI");
  if (lower.includes("market") || lower.includes("industry") || lower.includes("revenue"))
    hints.push("Market research — prioritise IDC, Gartner, Forrester, Grand View Research, Bloomberg");
  if (lower.includes("regulation") || lower.includes("compliance") || lower.includes("policy"))
    hints.push("Regulatory domain — prioritise official government/regulatory body publications, law firm analysis");

  return hints.length > 0 ? hints.join("; ") : "General technology and business — prioritise credible industry analysts, peer-reviewed sources, official vendor documentation";
}
