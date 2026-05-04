import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const { mockCallLLM } = vi.hoisted(() => ({ mockCallLLM: vi.fn() }));

vi.mock("@/lib/research/llm-adapter", () => ({
  callLLM: mockCallLLM,
  parseJSON: (text: string) => JSON.parse(text),
}));

import { runTradeoffAnalyst } from "@/lib/tech-research/agents/tradeoff-analyst";
import type { TechResearchConfig, TechEvaluation } from "@/types/tech-research";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_CONFIG: TechResearchConfig = {
  requirement: "Need real-time sync",
  current_stack: "Next.js, Supabase",
  constraints: "",
  criteria: { performance: 5, developer_experience: 3, maturity: 3, cost: 2, security: 2 },
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  depth: "tier2",
  format: "md",
  focus_area: "backend",
};

function makeEval(name: string, scores: Record<string, number>): TechEvaluation {
  return {
    candidate_name: name,
    metrics: {},
    scores: Object.entries(scores).map(([criterion, score]) => ({
      criterion: criterion as any,
      score,
      rationale: "test",
      evidence: "test — example.com",
    })),
    weighted_total: 0, // will be recomputed server-side
    pros: [`${name} pro`],
    cons: [`${name} con`],
    stack_compatibility_note: "Compatible",
    known_gotchas: [],
    migration_complexity: "low",
    community_health: "thriving",
    security_cves: "None",
    sources: [],
  };
}

function makeLLMResponse(winner: string, rows: { candidate: string; scores: Record<string, number> }[]) {
  return JSON.stringify({
    criteria_weights: BASE_CONFIG.criteria,
    rows: rows.map((r, i) => ({
      candidate: r.candidate,
      scores: r.scores,
      weighted_total: 0, // will be overridden by server recompute
      rank: i + 1,
    })),
    winner,
    runner_up: rows[1]?.candidate ?? rows[0]!.candidate,
    confidence: "high",
    key_differentiators: ["Performance gap is decisive"],
    non_obvious_tradeoffs: ["Winner has complex migration path"],
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runTradeoffAnalyst", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recomputes weighted_total correctly using criteria weights", async () => {
    // Candidate A: perf=5, dx=3, maturity=3, cost=2, security=2
    // Weights: perf=5, dx=3, maturity=3, cost=2, security=2
    // Weighted = (5×5 + 3×3 + 3×3 + 2×2 + 2×2) / (5+3+3+2+2) = (25+9+9+4+4)/15 = 51/15 = 3.4
    const candidateA = makeEval("CandidateA", {
      performance: 5,
      developer_experience: 3,
      maturity: 3,
      cost: 2,
      security: 2,
    });
    const candidateB = makeEval("CandidateB", {
      performance: 2,
      developer_experience: 4,
      maturity: 4,
      cost: 4,
      security: 4,
    });

    mockCallLLM.mockResolvedValue(
      makeLLMResponse("CandidateA", [
        { candidate: "CandidateA", scores: { performance: 5, developer_experience: 3, maturity: 3, cost: 2, security: 2 } },
        { candidate: "CandidateB", scores: { performance: 2, developer_experience: 4, maturity: 4, cost: 4, security: 4 } },
      ])
    );

    const matrix = await runTradeoffAnalyst([candidateA, candidateB], BASE_CONFIG);

    // Server-side recompute should give A a higher score (5×5 weight heavily)
    const rowA = matrix.rows.find((r) => r.candidate === "CandidateA")!;
    const rowB = matrix.rows.find((r) => r.candidate === "CandidateB")!;

    expect(rowA.weighted_total).toBeGreaterThan(rowB.weighted_total);
    expect(rowA.rank).toBe(1);
    expect(rowB.rank).toBe(2);
  });

  it("assigns winner = rank-1 candidate after server recompute", async () => {
    mockCallLLM.mockResolvedValue(
      makeLLMResponse("WrongWinner", [
        { candidate: "ActualWinner", scores: { performance: 5, developer_experience: 5, maturity: 5, cost: 5, security: 5 } },
        { candidate: "WrongWinner", scores: { performance: 1, developer_experience: 1, maturity: 1, cost: 1, security: 1 } },
      ])
    );

    const evals = [
      makeEval("ActualWinner", { performance: 5, developer_experience: 5, maturity: 5, cost: 5, security: 5 }),
      makeEval("WrongWinner", { performance: 1, developer_experience: 1, maturity: 1, cost: 1, security: 1 }),
    ];

    const matrix = await runTradeoffAnalyst(evals, BASE_CONFIG);

    // Server always recalculates — LLM's winner claim is overridden
    expect(matrix.winner).toBe("ActualWinner");
    expect(matrix.runner_up).toBe("WrongWinner");
  });

  it("rows are sorted descending by weighted_total", async () => {
    mockCallLLM.mockResolvedValue(
      makeLLMResponse("C", [
        { candidate: "A", scores: { performance: 2, developer_experience: 2, maturity: 2, cost: 2, security: 2 } },
        { candidate: "B", scores: { performance: 3, developer_experience: 3, maturity: 3, cost: 3, security: 3 } },
        { candidate: "C", scores: { performance: 5, developer_experience: 5, maturity: 5, cost: 5, security: 5 } },
      ])
    );

    const evals = ["A", "B", "C"].map((n) =>
      makeEval(n, {
        performance: n === "A" ? 2 : n === "B" ? 3 : 5,
        developer_experience: n === "A" ? 2 : n === "B" ? 3 : 5,
        maturity: n === "A" ? 2 : n === "B" ? 3 : 5,
        cost: n === "A" ? 2 : n === "B" ? 3 : 5,
        security: n === "A" ? 2 : n === "B" ? 3 : 5,
      })
    );

    const matrix = await runTradeoffAnalyst(evals, BASE_CONFIG);
    const scores = matrix.rows.map((r) => r.weighted_total);

    // Each score should be >= next
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]!);
    }
  });

  it("ranks are 1-indexed and sequential", async () => {
    mockCallLLM.mockResolvedValue(
      makeLLMResponse("X", [
        { candidate: "X", scores: { performance: 4, developer_experience: 4, maturity: 4, cost: 4, security: 4 } },
        { candidate: "Y", scores: { performance: 3, developer_experience: 3, maturity: 3, cost: 3, security: 3 } },
        { candidate: "Z", scores: { performance: 2, developer_experience: 2, maturity: 2, cost: 2, security: 2 } },
      ])
    );

    const evals = ["X", "Y", "Z"].map((n) =>
      makeEval(n, { performance: 4, developer_experience: 4, maturity: 4, cost: 4, security: 4 })
    );

    const matrix = await runTradeoffAnalyst(evals, BASE_CONFIG);
    const ranks = matrix.rows.map((r) => r.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3]);
  });

  it("preserves LLM metadata: key_differentiators and non_obvious_tradeoffs", async () => {
    mockCallLLM.mockResolvedValue(
      makeLLMResponse("Alpha", [
        { candidate: "Alpha", scores: { performance: 5, developer_experience: 5, maturity: 5, cost: 5, security: 5 } },
      ])
    );

    const matrix = await runTradeoffAnalyst([makeEval("Alpha", {
      performance: 5, developer_experience: 5, maturity: 5, cost: 5, security: 5,
    })], BASE_CONFIG);

    expect(matrix.key_differentiators).toEqual(["Performance gap is decisive"]);
    expect(matrix.non_obvious_tradeoffs).toEqual(["Winner has complex migration path"]);
  });
});
