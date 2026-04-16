import { tavily } from "@tavily/core";

const getClient = () => tavily({ apiKey: process.env.TAVILY_API_KEY! });

export interface SearchResult {
  title: string;
  url: string;
  date: string;
  content: string;
}

export async function searchWeb(
  query: string,
  maxResults: number = 5
): Promise<SearchResult[]> {
  try {
    const client = getClient();
    const response = await client.search(query, {
      searchDepth: "advanced",
      maxResults,
      includeAnswer: false,
      includeRawContent: false,
    });

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

const CONTENT_CHAR_LIMIT = 400;

export function formatResults(results: SearchResult[]): string {
  return results
    .map(
      (r) =>
        `Title: ${r.title}\nURL: ${r.url}\nDate: ${r.date}\n\n${r.content.slice(0, CONTENT_CHAR_LIMIT)}`
    )
    .join("\n\n---\n\n");
}
