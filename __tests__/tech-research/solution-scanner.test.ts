import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCallLLM } = vi.hoisted(() => ({ mockCallLLM: vi.fn() }));

vi.mock("@/lib/research/llm-adapter", () => ({
  callLLM: mockCallLLM,
  parseJSON: (text: string) => JSON.parse(text),
}));

import { runSolutionScanner } from "@/lib/tech-research/agents/solution-scanner";
import type { TechResearchConfig, RequirementAnalysis, SolutionLandscape } from "@/types/tech-research";

const BASE_CONFIG: TechResearchConfig = {
  requirement: "Need real-time sync for web app",
  current_stack: "Next.js, TypeScript",
  constraints: "",
  criteria: { performance: 3, developer_experience: 3, maturity: 3, cost: 3, security: 3 },
  provider: "openai",
  model: "gpt-4o",
  depth: "tier2",
  format: "md",
  focus_area: "frontend",
};

const MOCK_ANALYSIS: RequirementAnalysis = {
  summary: "Real-time collaboration with conflict resolution",
  functional: [
    { description: "Sync between clients", priority: "must_have" },
  ],
  non_functional: [
    { category: "performance", description: "Low latency" },
  ],
  constraints: [],
  open_questions: [],
  search_keywords: ["CRDT", "WebSocket"],
};

function makeLandscape(count: number): SolutionLandscape {
  return {
    candidates: Array.from({ length: count }, (_, i) => ({
      name: `Option${i + 1}`,
      category: "library",
      approach: "open_source",
      description: `Option ${i + 1} description`,
      primary_search_queries: [`option${i + 1} npm`, `option${i + 1} github`],
    })),
    build_vs_buy_note: "Build not recommended.",
    excluded_approaches: [],
  };
}

describe("runSolutionScanner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls LLM with correct provider and model", async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify(makeLandscape(6)));
    await runSolutionScanner(MOCK_ANALYSIS, BASE_CONFIG);
    expect(mockCallLLM).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai", model: "gpt-4o" })
    );
  });

  it("requests 4 candidates for tier1", async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify(makeLandscape(4)));
    await runSolutionScanner(MOCK_ANALYSIS, { ...BASE_CONFIG, depth: "tier1" });
    const call = mockCallLLM.mock.calls[0]?.[0] as any;
    expect(call.messages[0].content).toContain("4");
  });

  it("requests 6 candidates for tier2", async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify(makeLandscape(6)));
    await runSolutionScanner(MOCK_ANALYSIS, { ...BASE_CONFIG, depth: "tier2" });
    const call = mockCallLLM.mock.calls[0]?.[0] as any;
    expect(call.messages[0].content).toContain("6");
  });

  it("requests 8 candidates for tier3", async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify(makeLandscape(8)));
    await runSolutionScanner(MOCK_ANALYSIS, { ...BASE_CONFIG, depth: "tier3" });
    const call = mockCallLLM.mock.calls[0]?.[0] as any;
    expect(call.messages[0].content).toContain("8");
  });

  it("includes requirement summary in the user message", async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify(makeLandscape(6)));
    await runSolutionScanner(MOCK_ANALYSIS, BASE_CONFIG);
    const call = mockCallLLM.mock.calls[0]?.[0] as any;
    expect(call.messages[0].content).toContain("Real-time collaboration");
  });

  it("includes current_stack in user message", async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify(makeLandscape(6)));
    await runSolutionScanner(MOCK_ANALYSIS, BASE_CONFIG);
    const call = mockCallLLM.mock.calls[0]?.[0] as any;
    expect(call.messages[0].content).toContain("Next.js, TypeScript");
  });

  it("returns parsed SolutionLandscape with candidates", async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify(makeLandscape(6)));
    const result = await runSolutionScanner(MOCK_ANALYSIS, BASE_CONFIG);
    expect(result.candidates).toHaveLength(6);
    expect(result.candidates[0]?.name).toBe("Option1");
    expect(result.build_vs_buy_note).toBeTruthy();
  });

  it("propagates LLM errors", async () => {
    mockCallLLM.mockRejectedValue(new Error("Context length exceeded"));
    await expect(runSolutionScanner(MOCK_ANALYSIS, BASE_CONFIG)).rejects.toThrow(
      "Context length exceeded"
    );
  });

  it("uses higher temperature than requirement analyzer (exploration needed)", async () => {
    mockCallLLM.mockResolvedValue(JSON.stringify(makeLandscape(6)));
    await runSolutionScanner(MOCK_ANALYSIS, BASE_CONFIG);
    const call = mockCallLLM.mock.calls[0]?.[0] as any;
    expect(call.temperature).toBeGreaterThanOrEqual(0.2);
  });
});
