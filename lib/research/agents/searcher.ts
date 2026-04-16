import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import { searchWeb, formatResults } from "@/lib/research/search/tavily";
import type { SubTopic, SubTopicFindings, SourceItem, ResearchConfig } from "@/types/research";
import { SEARCHER_SYSTEM } from "./prompts";

interface RawExtracted {
  coverage: "adequate" | "partial" | "thin";
  key_assertions: Array<{ claim: string; source: string }>;
  data_points: Array<{ fact: string; source: string }>;
  notable_quotes: Array<{ text: string; source: string }>;
  gaps: string[];
}

const MAX_QUERIES: Record<string, number> = {
  tier1: 2,
  tier2: 3,
  tier3: 4,
};

export async function runSearcher(
  subTopic: SubTopic,
  config: ResearchConfig
): Promise<SubTopicFindings> {
  const maxQueries = MAX_QUERIES[config.depth] ?? 3;

  // Collect raw search results
  const allRaw = await Promise.all(
    subTopic.primary_queries.slice(0, maxQueries).map((q) => searchWeb(q, 5))
  );
  let results = allRaw.flat();

  // Deduplicate by URL
  const seen = new Set<string>();
  results = results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Fallback if primary queries returned thin results
  if (results.length < 3 && subTopic.fallback_queries.length > 0) {
    const fallback = await searchWeb(subTopic.fallback_queries[0], 5);
    for (const r of fallback) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        results.push(r);
      }
    }
  }

  const topResults = results.slice(0, 8);

  // Ask LLM to extract structured evidence
  const prompt = `Sub-topic: "${subTopic.question}"
Audience: ${config.audience}

Web search results:
${formatResults(topResults)}

Extract structured evidence for this sub-topic from the results above.
Only cite information actually present in the results.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: SEARCHER_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4096,
  });

  const extracted = parseJSON<RawExtracted>(raw);

  // Map search results into SourceItem objects
  const sources: SourceItem[] = topResults.map((r) => ({
    title: r.title || r.url,
    url: r.url,
    date: r.date,
    type: "secondary" as const,
    credibility_note: "",
    relevance_score: "medium" as const,
  }));

  return {
    sub_topic: subTopic.question,
    coverage: extracted.coverage,
    key_assertions: extracted.key_assertions,
    data_points: extracted.data_points,
    notable_quotes: extracted.notable_quotes,
    gaps: extracted.gaps,
    sources,
  };
}
