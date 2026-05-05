import { describe, it, expect, beforeAll } from "vitest";
import { techReportToHTML } from "@/lib/tech-research/export/html";
import type { TechReport } from "@/types/tech-research";

// Minimal report fixture — reuse pattern from markdown test
const MOCK_REPORT: TechReport = {
  requirement: "Real-time collaborative editing",
  config: {
    requirement: "Real-time collaborative editing",
    current_stack: "Next.js, TypeScript",
    constraints: "",
    criteria: { performance: 4, developer_experience: 4, maturity: 3, cost: 3, security: 3 },
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    depth: "tier2",
    format: "html",
    focus_area: "frontend",
  },
  verdict: "Recommend Yjs for CRDT-based editing",
  executive_summary: "Yjs is the best choice with top performance.",
  requirement_analysis: {
    summary: "CRDT-based sync needed",
    functional: [{ description: "Real-time sync", priority: "must_have" }],
    non_functional: [{ category: "performance", description: "sub-100ms" }],
    constraints: [{ type: "stack_compatibility", description: "Must work with Next.js" }],
    open_questions: ["Expected concurrent users?"],
    search_keywords: ["CRDT", "Yjs"],
  },
  solution_landscape: {
    candidates: [{ name: "Yjs", category: "library", approach: "open_source", description: "CRDT", primary_search_queries: [] }],
    build_vs_buy_note: "Build not recommended.",
    excluded_approaches: [],
  },
  evaluations: [],
  tradeoff_matrix: {
    criteria_weights: { performance: 4, developer_experience: 4, maturity: 3, cost: 3, security: 3 },
    rows: [{ candidate: "Yjs", scores: { performance: 5, developer_experience: 4, maturity: 4, cost: 5, security: 4 }, weighted_total: 4.4, rank: 1 }],
    winner: "Yjs",
    runner_up: "Yjs",
    confidence: "high",
    key_differentiators: ["Performance gap"],
    non_obvious_tradeoffs: ["Needs WebSocket server"],
  },
  architecture_blueprint: {
    recommended_solution: "Yjs",
    rationale: "Best CRDT for Next.js.",
    integration_overview: "Install yjs and configure WebSocket.",
    folder_structure: "lib/\n  yjs-provider.ts",
    key_interfaces: ["interface YjsProps { roomId: string; }"],
    configuration_notes: ["Set WEBSOCKET_URL"],
    code_snippets: [{ description: "Init", language: "typescript", code: "const ydoc = new Y.Doc();" }],
    phases: [{ phase: 1, title: "Setup", duration_estimate: "1 day", tasks: ["Install"], deliverable: "WS running" }],
    risks: [{ risk: "WS cost", mitigation: "Use Liveblocks" }],
    success_metrics: ["Sub-100ms sync"],
  },
  compatibility_warnings: ["Yjs requires a WebSocket server"],
  source_index: [{ title: "Yjs", url: "https://yjs.dev", date: "2024-01-01", type: "primary", credibility_note: "Official", relevance_score: "high" }],
  generated_at: "2024-01-01T00:00:00.000Z",
  model_used: "claude-sonnet-4-6",
};

describe("techReportToHTML", () => {
  let html: string;

  beforeAll(async () => {
    html = await techReportToHTML(MOCK_REPORT);
  });

  it("returns a valid HTML document", () => {
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<body");
  });

  it("includes the requirement in the title", () => {
    expect(html).toContain("Real-time collaborative editing");
  });

  it("includes a <style> block with CSS", () => {
    expect(html).toContain("<style>");
    expect(html).toContain("body {");
  });

  it("includes syntax highlighting CSS for code blocks", () => {
    expect(html).toContain("pre {");
  });

  it("renders the verdict text in the body", () => {
    expect(html).toContain("Recommend Yjs");
  });

  it("renders the executive summary", () => {
    expect(html).toContain("Yjs is the best choice");
  });

  it("renders the trade-off matrix as a table", () => {
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("Yjs");
  });

  it("renders code snippets", () => {
    expect(html).toContain("new Y.Doc()");
  });

  it("renders compatibility warnings", () => {
    expect(html).toContain("WebSocket server");
  });

  it("renders implementation phases", () => {
    expect(html).toContain("1 day");
  });

  it("includes a print media query in the CSS", () => {
    expect(html).toContain("@media print");
  });

  it("escapes HTML special chars in the <title> tag to prevent injection", async () => {
    const xssReport = {
      ...MOCK_REPORT,
      requirement: '<b>Bold</b> & "quoted"',
    };
    const xssHtml = await techReportToHTML(xssReport);
    // The <title> uses escapeHtml — raw tags must not appear unescaped there
    const titleMatch = xssHtml.match(/<title>([\s\S]*?)<\/title>/);
    expect(titleMatch).not.toBeNull();
    const titleContent = titleMatch![1]!;
    expect(titleContent).not.toContain("<b>");
    expect(titleContent).toContain("&lt;b&gt;");
    expect(titleContent).toContain("&amp;");
    expect(titleContent).toContain("&quot;");
  });

  it("uses UTF-8 charset meta tag", () => {
    expect(html).toContain('charset="UTF-8"');
  });
});
