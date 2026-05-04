import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type {
  TechResearchConfig,
  RequirementAnalysis,
  SolutionLandscape,
} from "@/types/tech-research";
import { SOLUTION_SCANNER_SYSTEM } from "./prompts";

const CANDIDATE_COUNT: Record<string, number> = {
  tier1: 4,
  tier2: 6,
  tier3: 8,
};

export async function runSolutionScanner(
  analysis: RequirementAnalysis,
  config: TechResearchConfig
): Promise<SolutionLandscape> {
  const count = CANDIDATE_COUNT[config.depth] ?? 6;

  const userMessage = `REQUIREMENT SUMMARY: ${analysis.summary}

FUNCTIONAL REQUIREMENTS:
${analysis.functional.map((f) => `• [${f.priority}] ${f.description}`).join("\n")}

NON-FUNCTIONAL REQUIREMENTS:
${analysis.non_functional.map((n) => `• [${n.category}] ${n.description}${n.measurable_target ? ` (target: ${n.measurable_target})` : ""}`).join("\n")}

CONSTRAINTS:
${analysis.constraints.map((c) => `• [${c.type}] ${c.description}`).join("\n")}

CURRENT TECH STACK: ${config.current_stack}
FOCUS AREA: ${config.focus_area}

Enumerate ${count} candidate solutions. Include at least one open-source, one commercial, and one build-from-scratch option.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: SOLUTION_SCANNER_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 4000,
    temperature: 0.3,
  });

  return parseJSON<SolutionLandscape>(raw);
}
