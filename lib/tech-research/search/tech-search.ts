import { tavily } from "@tavily/core";

const getClient = () => tavily({ apiKey: process.env.TAVILY_API_KEY! });

export interface SearchResult {
  title: string;
  url: string;
  date: string;
  content: string;
}

export interface TechSearchOptions {
  maxResults?: number;
  includeDomains?: string[];
  recencyDays?: number;
}

// Tech-specific domain prioritization
const TECH_DOMAINS = {
  packages: ["npmjs.com", "pkg.go.dev", "pypi.org", "crates.io"],
  repos: ["github.com", "gitlab.com"],
  benchmarks: ["jsperf.app", "web.dev", "bundlephobia.com", "pkg-size.dev"],
  docs: [
    "developer.mozilla.org",
    "docs.microsoft.com",
    "developer.apple.com",
    "developer.android.com",
  ],
  security: ["nvd.nist.gov", "snyk.io", "security.snyk.io", "cve.mitre.org"],
  community: [
    "stackoverflow.com",
    "dev.to",
    "hashnode.dev",
    "medium.com",
    "reddit.com",
  ],
  architecture: [
    "martinfowler.com",
    "aws.amazon.com",
    "cloud.google.com",
    "learn.microsoft.com",
  ],
};

export function getTechDomains(
  categories: Array<keyof typeof TECH_DOMAINS>
): string[] {
  const domains: string[] = [];
  for (const cat of categories) {
    domains.push(...TECH_DOMAINS[cat]);
  }
  return [...new Set(domains)].slice(0, 5);
}

export async function searchTech(
  query: string,
  options: TechSearchOptions = {}
): Promise<SearchResult[]> {
  const { maxResults = 8, includeDomains, recencyDays } = options;

  try {
    const client = getClient();

    const params: Record<string, unknown> = {
      searchDepth: "advanced",
      maxResults,
      includeAnswer: false,
      includeRawContent: false,
    };

    if (includeDomains && includeDomains.length > 0) {
      params.includeDomains = includeDomains;
    }
    if (recencyDays) {
      params.days = recencyDays;
    }

    const response = await client.search(query, params as never);

    return response.results.map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      date: r.publishedDate ?? "unknown",
      content: r.content ?? "",
    }));
  } catch (err) {
    console.error(`Tech search failed for "${query}":`, err);
    return [];
  }
}

// 1500 chars — extra context for technical content with code examples
const CONTENT_CHAR_LIMIT = 1500;

export function formatTechResults(results: SearchResult[]): string {
  return results
    .map(
      (r, i) =>
        `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nDate: ${r.date}\n\n${r.content.slice(0, CONTENT_CHAR_LIMIT)}`
    )
    .join("\n\n---\n\n");
}

/** Run multiple queries, deduplicate by URL, return merged results */
export async function multiSearch(
  queries: string[],
  options: TechSearchOptions = {}
): Promise<SearchResult[]> {
  const batches = await Promise.allSettled(
    queries.map((q) => searchTech(q, options))
  );

  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  for (const batch of batches) {
    if (batch.status === "fulfilled") {
      for (const r of batch.value) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          merged.push(r);
        }
      }
    }
  }

  return merged;
}
