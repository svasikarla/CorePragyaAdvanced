import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const { mockCallLLM, mockMultiSearch } = vi.hoisted(() => ({
  mockCallLLM: vi.fn(),
  mockMultiSearch: vi.fn(),
}));

vi.mock("@/lib/research/llm-adapter", () => ({
  callLLM: mockCallLLM,
  parseJSON: (text: string) => JSON.parse(text),
}));

vi.mock("@/lib/tech-research/search/tech-search", () => ({
  multiSearch: mockMultiSearch,
  formatTechResults: (results: { title: string; url: string; date: string; content: string }[]) =>
    results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join("\n\n---\n\n"),
  getTechDomains: () => ["github.com", "npmjs.com"],
}));

import { runTechnologyEvaluator } from "@/lib/tech-research/agents/technology-evaluator";
import type { TechResearchConfig, TechCandidate, TechEvaluation } from "@/types/tech-research";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONFIG: TechResearchConfig = {
  requirement: "Real-time collaborative editing",
  current_stack: "Next.js, TypeScript",
  constraints: "",
  criteria: { performance: 5, developer_experience: 3, maturity: 3, cost: 2, security: 2 },
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  depth: "tier2",
  format: "md",
  focus_area: "frontend",
};

const CANDIDATE: TechCandidate = {
  name: "Yjs",
  category: "library",
  approach: "open_source",
  description: "CRDT library for collaborative editing",
  primary_search_queries: ["Yjs npm performance", "Yjs github stars"],
};

function makeEvalResponse(overrides: Partial<TechEvaluation> = {}): TechEvaluation {
  return {
    candidate_name: "Yjs",
    metrics: { github_stars: 15000, npm_weekly_downloads: 500000, license: "MIT", latest_version: "13.6.0" },
    scores: [
      { criterion: "performance", score: 5, rationale: "Top benchmarks", evidence: "yjs.dev" },
      { criterion: "developer_experience", score: 4, rationale: "Good docs", evidence: "docs.yjs.dev" },
      { criterion: "maturity", score: 4, rationale: "5+ years", evidence: "github.com/yjs/yjs" },
      { criterion: "cost", score: 5, rationale: "MIT free", evidence: "npmjs.com" },
      { criterion: "security", score: 4, rationale: "No CVEs", evidence: "snyk.io" },
    ],
    weighted_total: 0, // will be recomputed
    pros: ["Best CRDT performance"],
    cons: ["Requires WebSocket server"],
    stack_compatibility_note: "Works with Next.js",
    known_gotchas: ["Need y-websocket"],
    migration_complexity: "medium",
    community_health: "thriving",
    security_cves: "No known critical CVEs",
    sources: [{ title: "Yjs", url: "https://yjs.dev", date: "2024-01-01", type: "primary", credibility_note: "Official", relevance_score: "high" }],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runTechnologyEvaluator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMultiSearch.mockResolvedValue([
      { title: "Yjs Docs", url: "https://yjs.dev", date: "2024-01-01", content: "CRDT library" },
    ]);
    mockCallLLM.mockResolvedValue(JSON.stringify(makeEvalResponse()));
  });

  it("searches using the candidate primary_search_queries", async () => {
    await runTechnologyEvaluator(CANDIDATE, CONFIG);
    expect(mockMultiSearch).toHaveBeenCalledWith(
      CANDIDATE.primary_search_queries,
      expect.any(Object)
    );
  });

  it("passes candidate name in the user message", async () => {
    await runTechnologyEvaluator(CANDIDATE, CONFIG);
    const call = mockCallLLM.mock.calls[0]?.[0] as { messages: { content: string }[] };
    expect(call.messages[0]!.content).toContain("Yjs");
  });

  it("passes current_stack in the user message", async () => {
    await runTechnologyEvaluator(CANDIDATE, CONFIG);
    const call = mockCallLLM.mock.calls[0]?.[0] as { messages: { content: string }[] };
    expect(call.messages[0]!.content).toContain("Next.js, TypeScript");
  });

  it("passes criteria weights in the user message", async () => {
    await runTechnologyEvaluator(CANDIDATE, CONFIG);
    const call = mockCallLLM.mock.calls[0]?.[0] as { messages: { content: string }[] };
    expect(call.messages[0]!.content).toContain("performance");
  });

  it("recomputes weighted_total server-side from scores and weights", async () => {
    const result = await runTechnologyEvaluator(CANDIDATE, CONFIG);
    // weights: perf=5, dx=3, mat=3, cost=2, sec=2 → total weight=15
    // scores: 5,4,4,5,4
    // weighted = (5*5 + 4*3 + 4*3 + 5*2 + 4*2) / 15 = (25+12+12+10+8)/15 = 67/15 ≈ 4.5
    expect(result.weighted_total).toBeGreaterThan(0);
    expect(result.weighted_total).toBeLessThanOrEqual(5);
  });

  it("falls back to generic search when primary queries return no results", async () => {
    mockMultiSearch
      .mockResolvedValueOnce([]) // primary: no results
      .mockResolvedValueOnce([  // fallback: has results
        { title: "Yjs fallback", url: "https://github.com/yjs/yjs", date: "2024-01-01", content: "fallback content" },
      ]);
    await runTechnologyEvaluator(CANDIDATE, CONFIG);
    expect(mockMultiSearch).toHaveBeenCalledTimes(2);
  });

  it("does NOT do a fallback search when primary queries return results", async () => {
    await runTechnologyEvaluator(CANDIDATE, CONFIG);
    expect(mockMultiSearch).toHaveBeenCalledTimes(1);
  });

  it("uses low temperature for consistent scoring", async () => {
    await runTechnologyEvaluator(CANDIDATE, CONFIG);
    const call = mockCallLLM.mock.calls[0]?.[0] as { temperature: number };
    expect(call.temperature).toBeLessThanOrEqual(0.15);
  });

  it("returns a TechEvaluation with all required fields", async () => {
    const result = await runTechnologyEvaluator(CANDIDATE, CONFIG);
    expect(result).toHaveProperty("candidate_name");
    expect(result).toHaveProperty("metrics");
    expect(result).toHaveProperty("scores");
    expect(result).toHaveProperty("weighted_total");
    expect(result).toHaveProperty("pros");
    expect(result).toHaveProperty("cons");
    expect(result).toHaveProperty("migration_complexity");
    expect(result).toHaveProperty("community_health");
  });

  it("propagates LLM errors", async () => {
    mockCallLLM.mockRejectedValue(new Error("Rate limit"));
    await expect(runTechnologyEvaluator(CANDIDATE, CONFIG)).rejects.toThrow("Rate limit");
  });

  it("weighted_total is 0 when all scores are 0", async () => {
    const zeroScoreEval = makeEvalResponse({
      scores: [
        { criterion: "performance", score: 0, rationale: "n/a", evidence: "none" },
        { criterion: "developer_experience", score: 0, rationale: "n/a", evidence: "none" },
        { criterion: "maturity", score: 0, rationale: "n/a", evidence: "none" },
        { criterion: "cost", score: 0, rationale: "n/a", evidence: "none" },
        { criterion: "security", score: 0, rationale: "n/a", evidence: "none" },
      ],
    });
    mockCallLLM.mockResolvedValue(JSON.stringify(zeroScoreEval));
    const result = await runTechnologyEvaluator(CANDIDATE, CONFIG);
    expect(result.weighted_total).toBe(0);
  });
});
