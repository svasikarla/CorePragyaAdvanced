import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type {
  TechResearchConfig,
  TechEvaluation,
  TradeoffMatrix,
  EvaluationCriteria,
} from "@/types/tech-research";
import { TRADEOFF_ANALYST_SYSTEM } from "./prompts";

export async function runTradeoffAnalyst(
  evaluations: TechEvaluation[],
  config: TechResearchConfig
): Promise<TradeoffMatrix> {
  const evalDigest = evaluations
    .map((e) => {
      const scoreLines = e.scores
        .map((s) => `    ${s.criterion}: ${s.score}/5 — ${s.rationale}`)
        .join("\n");
      return `CANDIDATE: ${e.candidate_name}
  weighted_total: ${e.weighted_total}
  pros: ${e.pros.slice(0, 3).join("; ")}
  cons: ${e.cons.slice(0, 3).join("; ")}
  migration_complexity: ${e.migration_complexity}
  community_health: ${e.community_health}
  stack_compatibility: ${e.stack_compatibility_note}
  scores:
${scoreLines}`;
    })
    .join("\n\n");

  const userMessage = `REQUIREMENT: ${config.requirement}
CURRENT STACK: ${config.current_stack}

CRITERIA WEIGHTS:
${Object.entries(config.criteria)
    .map(([k, v]) => `  ${k}: ${v}/5`)
    .join("\n")}

CANDIDATE EVALUATIONS:
${evalDigest}

Build the trade-off matrix. Recompute weighted_total for each candidate using the provided weights.
Rank all candidates. Identify the winner and runner-up. Assess confidence based on score margins.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: TRADEOFF_ANALYST_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 3000,
    temperature: 0.1,
  });

  const matrix = parseJSON<TradeoffMatrix>(raw);

  // Server-side recompute & sort to ensure correctness
  matrix.rows = matrix.rows
    .map((row) => ({
      ...row,
      weighted_total: computeWeighted(row.scores, config.criteria),
    }))
    .sort((a, b) => b.weighted_total - a.weighted_total)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  if (matrix.rows.length > 0) {
    matrix.winner = matrix.rows[0]!.candidate;
    matrix.runner_up = matrix.rows[1]?.candidate ?? matrix.rows[0]!.candidate;
  }

  return matrix;
}

function computeWeighted(
  scores: Record<keyof EvaluationCriteria, number>,
  weights: EvaluationCriteria
): number {
  const keys = Object.keys(weights) as Array<keyof EvaluationCriteria>;
  let sum = 0;
  let totalWeight = 0;
  for (const k of keys) {
    const s = scores[k] ?? 0;
    const w = weights[k];
    if (s > 0) {
      sum += s * w;
      totalWeight += w;
    }
  }
  return totalWeight > 0 ? Math.round((sum / totalWeight) * 10) / 10 : 0;
}
