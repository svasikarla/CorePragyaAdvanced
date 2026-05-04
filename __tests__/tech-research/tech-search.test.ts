import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock ────────────────────────────────────────────────────────────────

const { mockSearch } = vi.hoisted(() => ({ mockSearch: vi.fn() }));

vi.mock("@tavily/core", () => ({
  tavily: () => ({ search: mockSearch }),
}));

import {
  getTechDomains,
  formatTechResults,
  searchTech,
  multiSearch,
  type SearchResult,
} from "@/lib/tech-research/search/tech-search";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_RESULTS: SearchResult[] = [
  { title: "Yjs Docs", url: "https://docs.yjs.dev/guide", date: "2024-01-01", content: "Yjs is a CRDT library" },
  { title: "Yjs GitHub", url: "https://github.com/yjs/yjs", date: "2024-02-01", content: "Stars: 15000" },
];

// ── getTechDomains ─────────────────────────────────────────────────────────────

describe("getTechDomains", () => {
  it("returns repos domains for 'repos' category", () => {
    const domains = getTechDomains(["repos"]);
    expect(domains).toContain("github.com");
  });

  it("returns package domains for 'packages' category", () => {
    const domains = getTechDomains(["packages"]);
    expect(domains).toContain("npmjs.com");
  });

  it("returns security domains for 'security' category", () => {
    const domains = getTechDomains(["security"]);
    expect(domains.some((d) => d.includes("snyk") || d.includes("nist") || d.includes("cve"))).toBe(true);
  });

  it("combines domains from multiple categories", () => {
    const domains = getTechDomains(["repos", "security"]);
    expect(domains).toContain("github.com");
    expect(domains.some((d) => d.includes("snyk") || d.includes("nist"))).toBe(true);
  });

  it("deduplicates domains that appear in multiple categories", () => {
    const domains = getTechDomains(["repos", "repos"]);
    const unique = new Set(domains);
    expect(unique.size).toBe(domains.length);
  });

  it("caps result at 5 domains (Tavily limit)", () => {
    const domains = getTechDomains(["repos", "packages", "benchmarks", "docs", "security", "community"]);
    expect(domains.length).toBeLessThanOrEqual(5);
  });

  it("returns empty array for unknown category", () => {
    const domains = getTechDomains([] as never[]);
    expect(domains).toEqual([]);
  });
});

// ── formatTechResults ─────────────────────────────────────────────────────────

describe("formatTechResults", () => {
  it("formats each result with index, title, URL, date, and content", () => {
    const formatted = formatTechResults(SAMPLE_RESULTS);
    expect(formatted).toContain("[1]");
    expect(formatted).toContain("[2]");
    expect(formatted).toContain("Yjs Docs");
    expect(formatted).toContain("docs.yjs.dev");
    expect(formatted).toContain("2024-01-01");
  });

  it("separates results with ---", () => {
    const formatted = formatTechResults(SAMPLE_RESULTS);
    expect(formatted).toContain("---");
  });

  it("truncates content to CONTENT_CHAR_LIMIT (1500 chars)", () => {
    const longContent = "x".repeat(3000);
    const results: SearchResult[] = [
      { title: "Test", url: "https://test.com", date: "2024-01-01", content: longContent },
    ];
    const formatted = formatTechResults(results);
    // Should not contain the full 3000 chars
    expect(formatted.length).toBeLessThan(3000 + 100); // allow for metadata overhead
  });

  it("returns empty string for empty results array", () => {
    expect(formatTechResults([])).toBe("");
  });
});

// ── searchTech ─────────────────────────────────────────────────────────────────

describe("searchTech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue({
      results: [
        { title: "Yjs", url: "https://yjs.dev", publishedDate: "2024-01-01", content: "CRDT library" },
      ],
    });
  });

  it("calls Tavily with advancedSearchDepth", async () => {
    await searchTech("Yjs CRDT performance");
    expect(mockSearch).toHaveBeenCalledWith(
      "Yjs CRDT performance",
      expect.objectContaining({ searchDepth: "advanced" })
    );
  });

  it("maps response to SearchResult format", async () => {
    const results = await searchTech("test");
    expect(results[0]).toMatchObject({
      title: "Yjs",
      url: "https://yjs.dev",
      date: "2024-01-01",
      content: "CRDT library",
    });
  });

  it("passes includeDomains when provided", async () => {
    await searchTech("test", { includeDomains: ["github.com"] });
    expect(mockSearch).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({ includeDomains: ["github.com"] })
    );
  });

  it("passes recencyDays as days when provided", async () => {
    await searchTech("test", { recencyDays: 30 });
    expect(mockSearch).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({ days: 30 })
    );
  });

  it("returns empty array when Tavily throws", async () => {
    mockSearch.mockRejectedValue(new Error("API limit"));
    const results = await searchTech("test");
    expect(results).toEqual([]);
  });

  it("defaults maxResults to 8", async () => {
    await searchTech("test");
    expect(mockSearch).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({ maxResults: 8 })
    );
  });
});

// ── multiSearch ───────────────────────────────────────────────────────────────

describe("multiSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs all queries in parallel and merges results", async () => {
    mockSearch
      .mockResolvedValueOnce({ results: [{ title: "A", url: "https://a.com", publishedDate: "2024-01-01", content: "a" }] })
      .mockResolvedValueOnce({ results: [{ title: "B", url: "https://b.com", publishedDate: "2024-01-01", content: "b" }] });

    const results = await multiSearch(["query1", "query2"]);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.url)).toContain("https://a.com");
    expect(results.map((r) => r.url)).toContain("https://b.com");
    expect(mockSearch).toHaveBeenCalledTimes(2);
  });

  it("deduplicates results by URL", async () => {
    const duplicate = { title: "Same", url: "https://same.com", publishedDate: "2024-01-01", content: "content" };
    mockSearch
      .mockResolvedValueOnce({ results: [duplicate] })
      .mockResolvedValueOnce({ results: [duplicate] });

    const results = await multiSearch(["q1", "q2"]);
    expect(results).toHaveLength(1);
  });

  it("ignores failed queries and returns successful ones", async () => {
    mockSearch
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ results: [{ title: "B", url: "https://b.com", publishedDate: "2024-01-01", content: "b" }] });

    const results = await multiSearch(["fail-query", "ok-query"]);
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe("https://b.com");
  });

  it("returns empty array when all queries fail", async () => {
    mockSearch.mockRejectedValue(new Error("all fail"));
    const results = await multiSearch(["q1", "q2"]);
    expect(results).toEqual([]);
  });
});
