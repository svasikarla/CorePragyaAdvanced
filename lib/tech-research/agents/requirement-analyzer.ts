import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { TechResearchConfig, RequirementAnalysis } from "@/types/tech-research";
import { REQUIREMENT_ANALYZER_SYSTEM } from "./prompts";

export async function runRequirementAnalyzer(
  config: TechResearchConfig
): Promise<RequirementAnalysis> {
  const userMessage = `REQUIREMENT STATEMENT:
${config.requirement}

CURRENT TECH STACK:
${config.current_stack || "Not specified"}

STATED CONSTRAINTS:
${config.constraints || "None stated"}

FOCUS AREA: ${config.focus_area}
DEPTH TIER: ${config.depth}

Decompose this requirement into a structured analysis. For tier1 produce 2–3 functional requirements; tier2: 3–5; tier3: 5–7.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: REQUIREMENT_ANALYZER_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 3000,
    temperature: 0.1,
  });

  return parseJSON<RequirementAnalysis>(raw);
}
