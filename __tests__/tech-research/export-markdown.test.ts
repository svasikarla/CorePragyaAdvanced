import { describe, it, expect, beforeAll } from "vitest";
import { techReportToMarkdown } from "@/lib/tech-research/export/markdown";
import type { TechReport } from "@/types/tech-research";

// ── Fixture ───────────────────────────────────────────────────────────────────

const MOCK_REPORT: TechReport = {
  requirement: "We need real-time collaborative editing for our web app",
  config: {
    requirement: "We need real-time collaborative editing for our web app",
    current_stack: "Next.js, Supabase, TypeScript",
    constraints: "",
    criteria: { performance: 4, developer_experience: 4, maturity: 3, cost: 3, security: 3 },
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    depth: "tier2",
    format: "md",
    focus_area: "frontend",
  },
  verdict: "Recommend Yjs: best overall fit for collaborative editing in Next.js",
  executive_summary: "Yjs is the clear winner with a score of 4.2/5, outperforming alternatives on performance and developer experience.",
  requirement_analysis: {
    summary: "Core challenge is CRDT-based real-time sync with conflict resolution",
    functional: [
      { description: "Real-time sync between clients", priority: "must_have" },
      { description: "Offline support", priority: "should_have" },
      { description: "Version history", priority: "nice_to_have" },
    ],
    non_functional: [
      { category: "performance", description: "Sub-100ms sync latency", measurable_target: "<100ms" },
    ],
    constraints: [
      { type: "stack_compatibility", description: "Must work with Next.js App Router" },
    ],
    open_questions: ["What is the expected concurrent user count?"],
    search_keywords: ["CRDT", "Yjs", "ShareDB", "collaborative editing"],
  },
  solution_landscape: {
    candidates: [
      {
        name: "Yjs",
        category: "library",
        approach: "open_source",
        description: "CRDT library for collaborative editing",
        primary_search_queries: ["Yjs CRDT performance"],
      },
    ],
    build_vs_buy_note: "Build is not recommended given complexity of CRDT algorithms.",
    excluded_approaches: [{ name: "Socket.IO simple sync", reason: "No conflict resolution" }],
  },
  evaluations: [
    {
      candidate_name: "Yjs",
      metrics: { github_stars: 14000, npm_weekly_downloads: 500000, license: "MIT", latest_version: "13.6.0" },
      scores: [
        { criterion: "performance", score: 5, rationale: "Benchmark shows best throughput", evidence: "Yjs benchmarks — yjs.dev" },
        { criterion: "developer_experience", score: 4, rationale: "Good docs", evidence: "docs.yjs.dev" },
        { criterion: "maturity", score: 4, rationale: "5+ years, stable", evidence: "GitHub — github.com/yjs/yjs" },
        { criterion: "cost", score: 5, rationale: "MIT license, free", evidence: "npmjs.com/yjs" },
        { criterion: "security", score: 4, rationale: "No known CVEs", evidence: "snyk.io" },
      ],
      weighted_total: 4.5,
      pros: ["Best CRDT performance", "Huge ecosystem"],
      cons: ["Complex initial setup"],
      stack_compatibility_note: "Works with Next.js via provider pattern",
      known_gotchas: ["Requires WebSocket server for persistence"],
      migration_complexity: "medium",
      community_health: "thriving",
      security_cves: "No known critical CVEs",
      sources: [
        { title: "Yjs Docs", url: "https://docs.yjs.dev", date: "2024-01-01", type: "primary", credibility_note: "Official", relevance_score: "high" },
      ],
    },
  ],
  tradeoff_matrix: {
    criteria_weights: { performance: 4, developer_experience: 4, maturity: 3, cost: 3, security: 3 },
    rows: [
      {
        candidate: "Yjs",
        scores: { performance: 5, developer_experience: 4, maturity: 4, cost: 5, security: 4 },
        weighted_total: 4.4,
        rank: 1,
      },
    ],
    winner: "Yjs",
    runner_up: "Yjs",
    confidence: "high",
    key_differentiators: ["Performance advantage is decisive"],
    non_obvious_tradeoffs: ["Requires dedicated WebSocket server"],
  },
  architecture_blueprint: {
    recommended_solution: "Yjs",
    rationale: "Yjs provides the best CRDT implementation for Next.js with minimal overhead.",
    integration_overview: "Install yjs and y-websocket, add a WebSocket server, wrap editor components with Yjs providers.",
    folder_structure: "lib/\n  yjs-provider.ts\napp/\n  editor/\n    page.tsx",
    key_interfaces: ["interface YjsEditorProps { roomId: string; initialContent?: string; }"],
    configuration_notes: ["Set WEBSOCKET_URL env var", "Configure Next.js rewrites for WS"],
    code_snippets: [
      { description: "Initialize Yjs document", language: "typescript", code: 'import * as Y from "yjs";\nconst ydoc = new Y.Doc();' },
    ],
    phases: [
      { phase: 1, title: "Setup WebSocket server", duration_estimate: "1 day", tasks: ["Install y-websocket", "Configure server"], deliverable: "Working local WS server" },
    ],
    risks: [
      { risk: "WebSocket server adds infrastructure cost", mitigation: "Use Liveblocks or Partykit as managed alternative" },
    ],
    success_metrics: ["Sub-100ms sync verified in load test", "Conflicts resolve correctly in 100 concurrent edit test"],
  },
  compatibility_warnings: ["Yjs requires a WebSocket server not included in Supabase"],
  source_index: [
    { title: "Yjs Docs", url: "https://docs.yjs.dev", date: "2024-01-01", type: "primary", credibility_note: "Official", relevance_score: "high" },
  ],
  generated_at: "2024-01-01T00:00:00.000Z",
  model_used: "claude-sonnet-4-6",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("techReportToMarkdown", () => {
  let md: string;

  beforeAll(() => {
    md = techReportToMarkdown(MOCK_REPORT);
  });

  it("includes the requirement as a heading", () => {
    expect(md).toContain("We need real-time collaborative editing");
  });

  it("includes the verdict", () => {
    expect(md).toContain("Yjs: best overall fit");
  });

  it("includes the executive summary", () => {
    expect(md).toContain("Yjs is the clear winner");
  });

  it("includes requirement analysis section", () => {
    expect(md).toContain("Requirement Analysis");
    expect(md).toContain("Real-time sync between clients");
  });

  it("renders must-have requirements with human-readable label", () => {
    expect(md).toContain("Must-have requirements:");
    expect(md).toContain("Real-time sync between clients");
  });

  it("includes open questions", () => {
    expect(md).toContain("expected concurrent user count");
  });

  it("includes trade-off matrix section as a table", () => {
    expect(md).toContain("Trade-off Matrix");
    expect(md).toContain("|");
    expect(md).toContain("Yjs");
    expect(md).toContain("4.4");
  });

  it("includes architecture blueprint section", () => {
    expect(md).toContain("Architecture Blueprint");
    expect(md).toContain("Yjs");
  });

  it("includes folder structure as code block", () => {
    expect(md).toContain("```\nlib/");
  });

  it("includes code snippets as fenced blocks", () => {
    expect(md).toContain("```typescript");
    expect(md).toContain("new Y.Doc()");
  });

  it("includes implementation phases", () => {
    expect(md).toContain("Phase 1");
    expect(md).toContain("Setup WebSocket server");
    expect(md).toContain("1 day");
  });

  it("includes risks section", () => {
    expect(md).toContain("WebSocket server adds infrastructure");
    expect(md).toContain("Liveblocks");
  });

  it("includes compatibility warnings", () => {
    expect(md).toContain("Compatibility Warnings");
    expect(md).toContain("⚠️");
  });

  it("includes candidate evaluations", () => {
    expect(md).toContain("Candidate Evaluations");
    expect(md).toContain("Score: 4.5");
  });

  it("includes source index table", () => {
    expect(md).toContain("Source Index");
    expect(md).toContain("docs.yjs.dev");
  });

  it("includes model and timestamp metadata", () => {
    expect(md).toContain("claude-sonnet-4-6");
  });

  it("includes pros and cons for each candidate", () => {
    expect(md).toContain("Best CRDT performance");
    expect(md).toContain("Complex initial setup");
  });

  it("renders criteria keys with underscores replaced by spaces in table", () => {
    // "developer_experience" → "developer experience"
    expect(md).toContain("developer experience");
  });
});
