import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import { searchTech, formatTechResults, getTechDomains } from "../search/tech-search";
import type {
  TechResearchConfig,
  RequirementAnalysis,
  SolutionLandscape,
  TradeoffMatrix,
  TechEvaluation,
  ArchitectureBlueprint,
  TechReport,
} from "@/types/tech-research";
import type { SourceItem } from "@/types/research";
import { ARCHITECTURE_SYNTHESIZER_SYSTEM } from "./prompts";

export async function runArchitectureSynthesizer(
  analysis: RequirementAnalysis,
  solutionLandscape: SolutionLandscape,
  matrix: TradeoffMatrix,
  evaluations: TechEvaluation[],
  config: TechResearchConfig,
  kbContext: string
): Promise<{ blueprint: ArchitectureBlueprint; report: TechReport }> {
  if (evaluations.length === 0) {
    throw new Error("No candidate evaluations available — cannot synthesize architecture.");
  }

  const winner = matrix.winner;
  const winnerEval =
    evaluations.find((e) => e.candidate_name.toLowerCase() === winner.toLowerCase()) ??
    evaluations[0]!;

  // Fetch integration-specific docs for the winner
  const integrationResults = await searchTech(
    `${winner} integration ${config.current_stack.split(",")[0]?.trim()} tutorial getting started`,
    {
      maxResults: 6,
      includeDomains: getTechDomains(["docs", "repos", "community"]),
    }
  );

  const formattedIntegration = formatTechResults(integrationResults);

  // Collect all sources across evaluations
  const allSources: SourceItem[] = evaluations.flatMap((e) => e.sources ?? []);
  const dedupedSources = deduplicateSources(allSources);

  // Scale token budget with depth — deeper analysis needs more output
  const MAX_TOKENS: Record<string, number> = { tier1: 5000, tier2: 7000, tier3: 9000 };
  const maxTokens = MAX_TOKENS[config.depth] ?? 7000;

  const userMessage = `REQUIREMENT: ${config.requirement}
CURRENT TECH STACK: ${config.current_stack}
CONSTRAINTS: ${config.constraints || "None stated"}

RECOMMENDED SOLUTION: ${winner}
RATIONALE FROM TRADE-OFF ANALYSIS:
  - Weighted Score: ${matrix.rows.find((r) => r.candidate === winner)?.weighted_total ?? "N/A"}
  - Key differentiators: ${matrix.key_differentiators.slice(0, 3).join("; ")}
  - Confidence: ${matrix.confidence}

WINNER EVALUATION SUMMARY:
  - Pros: ${winnerEval.pros.slice(0, 3).join("; ")}
  - Cons: ${winnerEval.cons.slice(0, 3).join("; ")}
  - Stack compatibility: ${winnerEval.stack_compatibility_note}
  - Migration complexity: ${winnerEval.migration_complexity}

FUNCTIONAL REQUIREMENTS TO SATISFY:
${analysis.functional.slice(0, 5).map((f) => `  [${f.priority}] ${f.description}`).join("\n")}

INTEGRATION DOCS & EXAMPLES:
${formattedIntegration || "No docs retrieved — use knowledge of this technology."}

${kbContext ? `KNOWLEDGE BASE CONTEXT (user's existing patterns):\n${kbContext}\n` : ""}

IMPORTANT OUTPUT RULES:
- Keep each code snippet under 20 lines
- Use \\n (escaped) for newlines inside code strings — never literal newlines
- Limit to 2 code snippets maximum
- Keep rationale and integration_overview under 5 sentences each

Produce a concrete implementation blueprint for integrating ${winner} into the stated tech stack.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: ARCHITECTURE_SYNTHESIZER_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: maxTokens,
    temperature: 0.2,
  });

  let blueprint: ArchitectureBlueprint;
  try {
    blueprint = parseJSON<ArchitectureBlueprint>(raw);
  } catch (parseErr) {
    // Fallback: construct a minimal valid blueprint from whatever was parseable
    console.error(`[arch-synthesizer] JSON parse failed for ${winner}, using fallback blueprint:`, parseErr);
    blueprint = buildFallbackBlueprint(winner, winnerEval, analysis, config);
  }

  blueprint.recommended_solution = winner;

  // Ensure all required array fields exist (guard against partial LLM output)
  blueprint.key_interfaces = blueprint.key_interfaces ?? [];
  blueprint.configuration_notes = blueprint.configuration_notes ?? [];
  blueprint.code_snippets = blueprint.code_snippets ?? [];
  blueprint.phases = blueprint.phases ?? [];
  blueprint.risks = blueprint.risks ?? [];
  blueprint.success_metrics = blueprint.success_metrics ?? [];

  // Build compatibility warnings from cons and gotchas
  const compatibilityWarnings: string[] = [
    ...winnerEval.known_gotchas,
    ...matrix.non_obvious_tradeoffs,
  ].slice(0, 5);

  const report: TechReport = {
    requirement: config.requirement,
    config,
    verdict: `Recommend ${winner}: ${blueprint.rationale.split(".")[0]}.`,
    executive_summary: buildExecutiveSummary(winner, matrix, winnerEval, analysis),
    requirement_analysis: analysis,
    solution_landscape: solutionLandscape,
    evaluations,
    tradeoff_matrix: matrix,
    architecture_blueprint: blueprint,
    compatibility_warnings: compatibilityWarnings,
    source_index: dedupedSources,
    generated_at: new Date().toISOString(),
    model_used: config.model,
  };

  return { blueprint, report };
}

function buildFallbackBlueprint(
  winner: string,
  winnerEval: TechEvaluation,
  analysis: RequirementAnalysis,
  config: TechResearchConfig
): ArchitectureBlueprint {
  return {
    recommended_solution: winner,
    rationale: `${winner} was selected based on trade-off analysis. ${winnerEval.pros[0] ?? "See evaluation for details."}`,
    integration_overview: `Integrate ${winner} with ${config.current_stack}. Review the official documentation for setup instructions.`,
    folder_structure: `lib/\n  ${winner.toLowerCase().replace(/\s+/g, "-")}.ts`,
    key_interfaces: [],
    configuration_notes: winnerEval.known_gotchas.slice(0, 3),
    code_snippets: [],
    phases: [
      {
        phase: 1,
        title: "Initial Setup",
        duration_estimate: "1–2 days",
        tasks: [`Install ${winner}`, "Configure environment variables", "Verify connection"],
        deliverable: "Working local integration",
      },
      {
        phase: 2,
        title: "Core Implementation",
        duration_estimate: "3–5 days",
        tasks: [
          ...analysis.functional
            .filter((f) => f.priority === "must_have")
            .slice(0, 3)
            .map((f) => f.description),
        ],
        deliverable: "All must-have requirements implemented",
      },
    ],
    risks: winnerEval.cons.slice(0, 3).map((con) => ({
      risk: con,
      mitigation: "Review official documentation and community resources for guidance.",
    })),
    success_metrics: [
      "All must-have functional requirements pass acceptance tests",
      `${winner} integration is stable in production for 72 hours`,
    ],
  };
}

function buildExecutiveSummary(
  winner: string,
  matrix: TradeoffMatrix,
  winnerEval: TechEvaluation,
  analysis: RequirementAnalysis
): string {
  const score = matrix.rows.find((r) => r.candidate === winner)?.weighted_total ?? 0;
  const runner = matrix.runner_up;
  const runnerScore =
    matrix.rows.find((r) => r.candidate === runner)?.weighted_total ?? 0;

  return (
    `${winner} is the recommended solution for this requirement, scoring ${score}/5 on a weighted evaluation against ${matrix.rows.length} candidates. ` +
    `The nearest alternative, ${runner} (${runnerScore}/5), was not selected due to: ${matrix.key_differentiators[0] ?? "lower overall fit"}. ` +
    `This recommendation satisfies ${analysis.functional.filter((f) => f.priority === "must_have").length} must-have requirements. ` +
    `Key strengths: ${winnerEval.pros.slice(0, 2).join("; ")}. ` +
    `Primary risk: ${winnerEval.cons[0] ?? "none identified"} — see the architecture blueprint for mitigations.`
  );
}

function deduplicateSources(sources: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
