import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/dom";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const {
  mockCountRunning,
  mockSet,
  mockGet,
  mockUpdate,
  mockUpdateAgent,
  mockEmit,
  mockRunRequirementAnalyzer,
  mockRunSolutionScanner,
  mockRunTechnologyEvaluator,
  mockRunTradeoffAnalyst,
  mockRunArchitectureSynthesizer,
  mockNanoid,
} = vi.hoisted(() => ({
  mockCountRunning: vi.fn(),
  mockSet: vi.fn(),
  mockGet: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateAgent: vi.fn(),
  mockEmit: vi.fn(),
  mockRunRequirementAnalyzer: vi.fn(),
  mockRunSolutionScanner: vi.fn(),
  mockRunTechnologyEvaluator: vi.fn(),
  mockRunTradeoffAnalyst: vi.fn(),
  mockRunArchitectureSynthesizer: vi.fn(),
  mockNanoid: vi.fn(() => "test-job-id"),
}));

vi.mock("@/lib/tech-research/store/job-store", () => ({
  techJobStore: {
    countRunning: mockCountRunning,
    set: mockSet,
    get: mockGet,
    update: mockUpdate,
    updateAgent: mockUpdateAgent,
  },
  resetTableReadyCache: vi.fn(),
}));

vi.mock("@/lib/tech-research/store/sse-emitter", () => ({
  techSseEmitter: { emit: mockEmit },
}));

vi.mock("@/lib/tech-research/agents/requirement-analyzer", () => ({
  runRequirementAnalyzer: mockRunRequirementAnalyzer,
}));

vi.mock("@/lib/tech-research/agents/solution-scanner", () => ({
  runSolutionScanner: mockRunSolutionScanner,
}));

vi.mock("@/lib/tech-research/agents/technology-evaluator", () => ({
  runTechnologyEvaluator: mockRunTechnologyEvaluator,
}));

vi.mock("@/lib/tech-research/agents/tradeoff-analyst", () => ({
  runTradeoffAnalyst: mockRunTradeoffAnalyst,
}));

vi.mock("@/lib/tech-research/agents/architecture-synthesizer", () => ({
  runArchitectureSynthesizer: mockRunArchitectureSynthesizer,
}));

vi.mock("nanoid", () => ({ nanoid: mockNanoid }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: vi.fn(), from: vi.fn() }),
}));

vi.mock("@/lib/ai-clients", () => ({
  generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2]]),
}));

import { startTechResearchJob } from "@/lib/tech-research/agents/job-runner";
import type { TechResearchConfig } from "@/types/tech-research";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONFIG: TechResearchConfig = {
  requirement: "Real-time collaborative editing for Next.js",
  current_stack: "Next.js, TypeScript",
  constraints: "",
  criteria: { performance: 4, developer_experience: 3, maturity: 3, cost: 3, security: 3 },
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  depth: "tier2",
  format: "md",
  focus_area: "frontend",
};

const MOCK_ANALYSIS = {
  summary: "Need CRDT sync",
  functional: [{ description: "Real-time sync", priority: "must_have" as const }],
  non_functional: [],
  constraints: [],
  open_questions: [],
  search_keywords: ["CRDT"],
};

const MOCK_LANDSCAPE = {
  candidates: [
    { name: "Yjs", category: "library" as const, approach: "open_source" as const, description: "CRDT", primary_search_queries: [] },
    { name: "ShareDB", category: "library" as const, approach: "open_source" as const, description: "OT", primary_search_queries: [] },
  ],
  build_vs_buy_note: "Build not recommended.",
  excluded_approaches: [],
};

const MOCK_EVAL = {
  candidate_name: "Yjs",
  metrics: {},
  scores: [
    { criterion: "performance" as const, score: 5, rationale: "fast", evidence: "yjs.dev" },
    { criterion: "developer_experience" as const, score: 4, rationale: "good", evidence: "docs" },
    { criterion: "maturity" as const, score: 4, rationale: "stable", evidence: "github" },
    { criterion: "cost" as const, score: 5, rationale: "free", evidence: "npm" },
    { criterion: "security" as const, score: 4, rationale: "safe", evidence: "snyk" },
  ],
  weighted_total: 4.4,
  pros: ["Fast"],
  cons: ["WS needed"],
  stack_compatibility_note: "Compatible",
  known_gotchas: [],
  migration_complexity: "medium" as const,
  community_health: "thriving" as const,
  security_cves: "None",
  sources: [],
};

const MOCK_MATRIX = {
  criteria_weights: CONFIG.criteria,
  rows: [{ candidate: "Yjs", scores: { performance: 5, developer_experience: 4, maturity: 4, cost: 5, security: 4 }, weighted_total: 4.4, rank: 1 }],
  winner: "Yjs",
  runner_up: "Yjs",
  confidence: "high" as const,
  key_differentiators: ["performance"],
  non_obvious_tradeoffs: [],
};

const MOCK_REPORT = {
  requirement: CONFIG.requirement,
  config: CONFIG,
  verdict: "Recommend Yjs",
  executive_summary: "Yjs is the best choice",
  requirement_analysis: MOCK_ANALYSIS,
  solution_landscape: MOCK_LANDSCAPE,
  evaluations: [MOCK_EVAL],
  tradeoff_matrix: MOCK_MATRIX,
  architecture_blueprint: {
    recommended_solution: "Yjs",
    rationale: "Best fit",
    integration_overview: "Install yjs",
    folder_structure: "lib/",
    key_interfaces: [],
    configuration_notes: [],
    code_snippets: [],
    phases: [],
    risks: [],
    success_metrics: [],
  },
  compatibility_warnings: [],
  source_index: [],
  generated_at: new Date().toISOString(),
  model_used: "claude-sonnet-4-6",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("startTechResearchJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountRunning.mockResolvedValue(0);
    mockSet.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockUpdateAgent.mockResolvedValue(undefined);
    mockRunRequirementAnalyzer.mockResolvedValue(MOCK_ANALYSIS);
    mockRunSolutionScanner.mockResolvedValue(MOCK_LANDSCAPE);
    mockRunTechnologyEvaluator.mockResolvedValue(MOCK_EVAL);
    mockRunTradeoffAnalyst.mockResolvedValue(MOCK_MATRIX);
    mockRunArchitectureSynthesizer.mockResolvedValue({ blueprint: MOCK_REPORT.architecture_blueprint, report: MOCK_REPORT });
  });

  it("throws when server is at max concurrency", async () => {
    mockCountRunning.mockResolvedValue(5);
    await expect(startTechResearchJob(CONFIG, "user-1")).rejects.toThrow("Server busy");
  });

  it("returns a job ID on success", async () => {
    const jobId = await startTechResearchJob(CONFIG, "user-1");
    expect(jobId).toBe("test-job-id");
  });

  it("calls techJobStore.set to persist the initial job", async () => {
    await startTechResearchJob(CONFIG, "user-1");
    expect(mockSet).toHaveBeenCalledWith(
      "test-job-id",
      expect.objectContaining({ id: "test-job-id", status: "queued", config: CONFIG })
    );
  });

  it("creates agents for all pipeline stages", async () => {
    await startTechResearchJob(CONFIG, "user-1");
    const jobArg = mockSet.mock.calls[0]?.[1] as { agents: { id: string }[] };
    const agentIds = jobArg.agents.map((a) => a.id);
    expect(agentIds).toContain("req-analyzer");
    expect(agentIds).toContain("solution-scanner");
    expect(agentIds).toContain("tradeoff-analyst");
    expect(agentIds).toContain("arch-synthesizer");
    // At least one evaluator
    expect(agentIds.some((id) => id.startsWith("evaluator-"))).toBe(true);
  });

  it("creates 6 evaluator agents for tier2", async () => {
    await startTechResearchJob(CONFIG, "user-1");
    const jobArg = mockSet.mock.calls[0]?.[1] as { agents: { id: string }[] };
    const evaluators = jobArg.agents.filter((a: { id: string }) => a.id.startsWith("evaluator-"));
    const evaluatorAgents = jobArg.agents.filter((a) => a.id.startsWith("evaluator-"));
    expect(evaluatorAgents).toHaveLength(6);
  });

  it("all initial agents have status 'idle'", async () => {
    await startTechResearchJob(CONFIG, "user-1");
    const jobArg = mockSet.mock.calls[0]?.[1] as { agents: { status: string }[] };
    expect(jobArg.agents.every((a) => a.status === "idle")).toBe(true);
  });

  it("emits 'complete' event when job finishes successfully", async () => {
    await startTechResearchJob(CONFIG, "user-1");
    await waitFor(
      () => {
        expect(mockEmit).toHaveBeenCalledWith(
          "test-job-id",
          "complete",
          expect.objectContaining({ report: MOCK_REPORT })
        );
      },
      { timeout: 2000 }
    );
  });

  it("emits 'error' event and logs when runJob fails", async () => {
    mockRunRequirementAnalyzer.mockRejectedValue(new Error("ANTHROPIC_API_KEY not set"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await startTechResearchJob(CONFIG, "user-1");
    await waitFor(
      () => {
        expect(mockEmit).toHaveBeenCalledWith(
          "test-job-id",
          "error",
          expect.objectContaining({ message: "ANTHROPIC_API_KEY not set" })
        );
        expect(consoleSpy).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
    consoleSpy.mockRestore();
  });

  it("updates job status to 'error' in DB when runJob fails", async () => {
    mockRunRequirementAnalyzer.mockRejectedValue(new Error("DB error"));
    await startTechResearchJob(CONFIG, "user-1");
    await waitFor(
      () => {
        expect(mockUpdate).toHaveBeenCalledWith(
          "test-job-id",
          expect.objectContaining({ status: "error", error: "DB error" })
        );
      },
      { timeout: 2000 }
    );
  });

  it("uses fallback error message when error has empty message", async () => {
    mockRunRequirementAnalyzer.mockRejectedValue(new Error(""));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await startTechResearchJob(CONFIG, "user-1");
    await waitFor(
      () => {
        expect(mockEmit).toHaveBeenCalledWith(
          "test-job-id",
          "error",
          expect.objectContaining({ message: "Job failed unexpectedly" })
        );
      },
      { timeout: 2000 }
    );
    consoleSpy.mockRestore();
  });
});
