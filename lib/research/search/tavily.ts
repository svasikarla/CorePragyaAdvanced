import { tavily } from "@tavily/core";

const getClient = () => tavily({ apiKey: process.env.TAVILY_API_KEY! });

export interface SearchResult {
  title: string;
  url: string;
  date: string;
  content: string;
}

export interface SearchOptions {
  maxResults?: number;
  includeDomains?: string[];
  recencyDays?: number;
}

export async function searchWeb(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { maxResults = 6, includeDomains, recencyDays } = options;

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

    const response = await client.search(query, params as any);

    return response.results.map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      date: r.publishedDate ?? "unknown",
      content: r.content ?? "",
    }));
  } catch (err) {
    console.error(`Tavily search failed for "${query}":`, err);
    return [];
  }
}

// 1200 chars (~200 words) — enough context for the LLM to extract assertions properly
const CONTENT_CHAR_LIMIT = 1200;

export function formatResults(results: SearchResult[]): string {
  return results
    .map(
      (r, i) =>
        `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nPublished: ${r.date}\n\n${r.content.slice(0, CONTENT_CHAR_LIMIT)}`
    )
    .join("\n\n---\n\n");
}

/** Parse source_priority strings into Tavily includeDomains */
export function parseDomains(sourcePriority: string[]): string[] {
  const domainMap: Record<string, string[]> = {
    "arxiv": ["arxiv.org"],
    "gartner": ["gartner.com"],
    "mckinsey": ["mckinsey.com"],
    "forrester": ["forrester.com"],
    "idc": ["idc.com"],
    "ieee": ["ieeexplore.ieee.org", "ieee.org"],
    "github": ["github.com"],
    "government": ["gov.in", "gov.uk", "gov.us", "nic.in"],
    "mnre": ["mnre.gov.in"],
    "oracle": ["oracle.com", "docs.oracle.com"],
    "anthropic": ["anthropic.com"],
    "openai": ["openai.com"],
    "stanford": ["stanford.edu", "hai.stanford.edu"],
    "bloomberg": ["bloomberg.com"],
  };

  const domains: string[] = [];
  for (const priority of sourcePriority) {
    const lower = priority.toLowerCase();
    for (const [key, vals] of Object.entries(domainMap)) {
      if (lower.includes(key)) {
        domains.push(...vals);
      }
    }
  }
  // Return unique domains, max 5 (Tavily limit)
  return [...new Set(domains)].slice(0, 5);
}
