import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import { multiSearch, formatTechResults, getTechDomains } from "../search/tech-search";
import type {
  TechResearchConfig,
  TechCandidate,
  TechEvaluation,
  EvaluationCriteria,
} from "@/types/tech-research";
import { TECHNOLOGY_EVALUATOR_SYSTEM } from "./prompts";

export async function runTechnologyEvaluator(
  candidate: TechCandidate,
  config: TechResearchConfig
): Promise<TechEvaluation> {
  // Search for this specific candidate across tech-relevant domains
  const results = await multiSearch(candidate.primary_search_queries, {
    maxResults: 8,
    includeDomains: getTechDomains(["repos", "packages", "benchmarks", "security", "community"]),
    recencyDays: 180,
  });

  // Fallback: generic search if primary queries returned nothing
  if (results.length === 0) {
    const fallback = await multiSearch(
      [`${candidate.name} npm package review`, `${candidate.name} github stars performance`],
      { maxResults: 6 }
    );
    results.push(...fallback);
  }

  const formattedResults = formatTechResults(results);

  const userMessage = `CANDIDATE: ${candidate.name}
CATEGORY: ${candidate.category} | APPROACH: ${candidate.approach}
DESCRIPTION: ${candidate.description}

CURRENT TECH STACK: ${config.current_stack}
EVALUATION CRITERIA WEIGHTS:
${Object.entries(config.criteria)
    .map(([k, v]) => `  ${k}: ${v}/5`)
    .join("\n")}

SEARCH RESULTS:
${formattedResults || "No search results returned — use general knowledge and note evidence as unavailable."}

Evaluate this candidate. Score each criterion 1–5 with evidence from the search results.
Compute weighted_total = sum(score_i × weight_i) / sum(weights) where weights are the criteria weights above.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: TECHNOLOGY_EVALUATOR_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 3500,
    temperature: 0.1,
  });

  const evaluation = parseJSON<TechEvaluation>(raw);

  // Recompute weighted_total server-side to ensure correctness
  evaluation.weighted_total = computeWeightedTotal(evaluation, config.criteria);

  return evaluation;
}

function computeWeightedTotal(
  evaluation: TechEvaluation,
  weights: EvaluationCriteria
): number {
  const weightKeys = Object.keys(weights) as Array<keyof EvaluationCriteria>;
  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of weightKeys) {
    const score = evaluation.scores.find((s) => s.criterion === key);
    const weight = weights[key];
    if (score && score.score > 0) {
      weightedSum += score.score * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
}
