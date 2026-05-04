import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const { mockCallLLM, mockSearchTech } = vi.hoisted(() => ({
  mockCallLLM: vi.fn(),
  mockSearchTech: vi.fn(),
}));

vi.mock("@/lib/research/llm-adapter", () => ({
  callLLM: mockCallLLM,
  parseJSON: (text: string) => JSON.parse(text),
}));

vi.mock("@/lib/tech-research/search/tech-search", () => ({
  searchTech: mockSearchTech,
  formatTechResults: (r: unknown[]) => r.map((_, i) => `[${i + 1}] result`).join("\n"),
  getTechDomains: () => ["docs.yjs.dev"],
}));

import { runArchitectureSynthesizer } from "@/lib/tech-research/agents/architecture-synthesizer";
import type {
  TechResearchConfig,
  RequirementAnalysis,
  SolutionLandscape,
  TradeoffMatrix,
  TechEvaluation,
  ArchitectureBlueprint,
} from "@/types/tech-research";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONFIG: TechResearchConfig = {
  requirement: "Real-time sync for web app",
  current_stack: "Next.js 15, TypeScript",
  constraints: "OSS only",
  criteria: { performance: 4, developer_experience: 4, maturity: 3, cost: 3, security: 3 },
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  depth: "tier2",
  format: "md",
  focus_area: "frontend",
};

const ANALYSIS: RequirementAnalysis = {
  summary: "Need CRDT-based sync",
  functional: [{ description: "Real-time sync", priority: "must_have" }],
  non_functional: [{ category: "performance", description: "sub-100ms" }],
  constraints: [],
  open_questions: [],
  search_keywords: ["CRDT", "Yjs"],
};

const LANDSCAPE: SolutionLandscape = {
  candidates: [{ name: "Yjs", category: "library", approach: "open_source", description: "CRDT", primary_search_queries: [] }],
  build_vs_buy_note: "Build not recommended.",
  excluded_approaches: [],
};

const MATRIX: TradeoffMatrix = {
  criteria_weights: { performance: 4, developer_experience: 4, maturity: 3, cost: 3, security: 3 },
  rows: [{ candidate: "Yjs", scores: { performance: 5, developer_experience: 4, maturity: 4, cost: 5, security: 4 }, weighted_total: 4.4, rank: 1 }],
  winner: "Yjs",
  runner_up: "Yjs",
  confidence: "high",
  key_differentiators: ["Best performance"],
  non_obvious_tradeoffs: ["Needs WebSocket server"],
};

const EVAL: TechEvaluation = {
  candidate_name: "Yjs",
  metrics: { license: "MIT", github_stars: 15000 },
  scores: [
    { criterion: "performance", score: 5, rationale: "top", evidence: "yjs.dev" },
    { criterion: "developer_experience", score: 4, rationale: "good", evidence: "docs.yjs.dev" },
    { criterion: "maturity", score: 4, rationale: "stable", evidence: "github" },
    { criterion: "cost", score: 5, rationale: "free", evidence: "npm" },
    { criterion: "security", score: 4, rationale: "no CVE", evidence: "snyk" },
  ],
  weighted_total: 4.4,
  pros: ["Fast CRDT"],
  cons: ["Needs server"],
  stack_compatibility_note: "Works with Next.js",
  known_gotchas: ["y-websocket required"],
  migration_complexity: "medium",
  community_health: "thriving",
  security_cves: "None",
  sources: [],
};

function makeBlueprintResponse(): ArchitectureBlueprint {
  return {
    recommended_solution: "Yjs",
    rationale: "Yjs provides the best CRDT implementation for Next.js.",
    integration_overview: "Install yjs and y-websocket, wrap editor with Yjs provider.",
    folder_structure: "lib/\n  yjs-provider.ts",
    key_interfaces: ["interface YjsEditorProps { roomId: string; }"],
    configuration_notes: ["Set WEBSOCKET_URL env var"],
    code_snippets: [{ description: "Init Yjs", language: "typescript", code: "const ydoc = new Y.Doc();" }],
    phases: [{ phase: 1, title: "Setup", duration_estimate: "1 day", tasks: ["Install"], deliverable: "WS server" }],
    risks: [{ risk: "WS server cost", mitigation: "Use Liveblocks" }],
    success_metrics: ["Sub-100ms sync"],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runArchitectureSynthesizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchTech.mockResolvedValue([
      { title: "Yjs Integration", url: "https://yjs.dev/guide", date: "2024-01-01", content: "How to integrate" },
    ]);
    mockCallLLM.mockResolvedValue(JSON.stringify(makeBlueprintResponse()));
  });

  it("throws when evaluations is empty", async () => {
    await expect(
      runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [], CONFIG, "")
    ).rejects.toThrow("No candidate evaluations available");
  });

  it("searches for integration docs for the winning candidate", async () => {
    await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, "");
    expect(mockSearchTech).toHaveBeenCalledWith(
      expect.stringContaining("Yjs"),
      expect.any(Object)
    );
  });

  it("passes the winning candidate to the LLM", async () => {
    await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, "");
    const call = mockCallLLM.mock.calls[0]?.[0] as { messages: { content: string }[] };
    expect(call.messages[0]!.content).toContain("Yjs");
  });

  it("includes current_stack in the LLM message", async () => {
    await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, "");
    const call = mockCallLLM.mock.calls[0]?.[0] as { messages: { content: string }[] };
    expect(call.messages[0]!.content).toContain("Next.js 15, TypeScript");
  });

  it("includes KB context in the LLM message when provided", async () => {
    const kbContext = "[KB: My Patterns] Use Zustand for state";
    await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, kbContext);
    const call = mockCallLLM.mock.calls[0]?.[0] as { messages: { content: string }[] };
    expect(call.messages[0]!.content).toContain("My Patterns");
  });

  it("returns a report with the correct requirement field", async () => {
    const { report } = await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, "");
    expect(report.requirement).toBe(CONFIG.requirement);
  });

  it("uses the actual solution_landscape in the report (not reconstructed)", async () => {
    const { report } = await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, "");
    expect(report.solution_landscape).toBe(LANDSCAPE);
  });

  it("sets blueprint.recommended_solution to the winner", async () => {
    const { blueprint } = await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, "");
    expect(blueprint.recommended_solution).toBe("Yjs");
  });

  it("builds executive_summary mentioning the winner", async () => {
    const { report } = await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, "");
    expect(report.executive_summary).toContain("Yjs");
  });

  it("verdict is a non-empty string mentioning the winner", async () => {
    const { report } = await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, "");
    expect(report.verdict).toContain("Yjs");
    expect(report.verdict.length).toBeGreaterThan(10);
  });

  it("deduplicates sources from all evaluations in source_index", async () => {
    const evalWithSources: TechEvaluation = {
      ...EVAL,
      sources: [
        { title: "A", url: "https://a.com", date: "2024-01-01", type: "primary", credibility_note: "", relevance_score: "high" },
        { title: "A dup", url: "https://a.com", date: "2024-01-01", type: "primary", credibility_note: "", relevance_score: "high" },
      ],
    };
    const { report } = await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [evalWithSources], CONFIG, "");
    const urlCount = report.source_index.filter((s) => s.url === "https://a.com").length;
    expect(urlCount).toBe(1);
  });

  it("uses fallback evaluation when winner name doesn't match exactly (case-insensitive)", async () => {
    const matrixWithDifferentCase: TradeoffMatrix = { ...MATRIX, winner: "YJS" };
    // EVAL has candidate_name "Yjs" — lowercase match should find it
    const { blueprint } = await runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, matrixWithDifferentCase, [EVAL], CONFIG, "");
    expect(blueprint.recommended_solution).toBe("YJS");
  });

  it("propagates LLM errors", async () => {
    mockCallLLM.mockRejectedValue(new Error("Context too long"));
    await expect(
      runArchitectureSynthesizer(ANALYSIS, LANDSCAPE, MATRIX, [EVAL], CONFIG, "")
    ).rejects.toThrow("Context too long");
  });
});
