import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import { searchWeb, formatResults, parseDomains } from "@/lib/research/search/tavily";
import type { SubTopic, SubTopicFindings, SourceItem, ResearchConfig } from "@/types/research";
import { SEARCHER_SYSTEM } from "./prompts";

interface RawExtracted {
  coverage: "adequate" | "partial" | "thin";
  key_assertions: Array<{ claim: string; source: string }>;
  data_points: Array<{ fact: string; source: string }>;
  notable_quotes: Array<{ text: string; source: string }>;
  gaps: string[];
}

// How many queries to run per depth tier
const MAX_QUERIES: Record<string, number> = {
  tier1: 2,
  tier2: 3,
  tier3: 4,
};

// How many results to fetch per query per depth tier
const RESULTS_PER_QUERY: Record<string, number> = {
  tier1: 5,
  tier2: 6,
  tier3: 8,
};

// How many results to pass to the LLM for extraction
const LLM_CONTEXT_RESULTS: Record<string, number> = {
  tier1: 6,
  tier2: 10,
  tier3: 14,
};

// Recency window in days for "critical" recency topics
const RECENCY_DAYS: Record<string, number> = {
  critical: 90,
  preferred: 365,
};

export async function runSearcher(
  subTopic: SubTopic,
  config: ResearchConfig
): Promise<SubTopicFindings> {
  const maxQueries = MAX_QUERIES[config.depth] ?? 3;
  const resultsPerQuery = RESULTS_PER_QUERY[config.depth] ?? 6;
  const llmContextLimit = LLM_CONTEXT_RESULTS[config.depth] ?? 10;

  // Resolve domain filtering from the orchestrator's source_priority
  const preferredDomains = parseDomains(subTopic.source_priority ?? []);

  // Recency filtering
  const recencyDays =
    subTopic.recency_requirement === "critical"
      ? RECENCY_DAYS.critical
      : subTopic.recency_requirement === "preferred"
      ? RECENCY_DAYS.preferred
      : undefined;

  // Run primary queries (with domain hints if available)
  const primaryQueryList = subTopic.primary_queries.slice(0, maxQueries);

  const allRaw = await Promise.all(
    primaryQueryList.map((q) =>
      searchWeb(q, {
        maxResults: resultsPerQuery,
        includeDomains: preferredDomains.length > 0 ? preferredDomains : undefined,
        recencyDays,
      })
    )
  );

  let results = allRaw.flat();

  // Deduplicate by URL
  const seen = new Set<string>();
  results = results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Fallback: broaden search if results are thin (no domain filter, no recency filter)
  if (results.length < 4 && subTopic.fallback_queries.length > 0) {
    const fallback = await searchWeb(subTopic.fallback_queries[0], {
      maxResults: resultsPerQuery,
    });
    for (const r of fallback) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        results.push(r);
      }
    }
  }

  // Sort by date (most recent first) when recency matters
  if (subTopic.recency_requirement !== "not_required") {
    results.sort((a, b) => {
      const da = a.date === "unknown" ? 0 : new Date(a.date).getTime();
      const db = b.date === "unknown" ? 0 : new Date(b.date).getTime();
      return db - da;
    });
  }

  const topResults = results.slice(0, llmContextLimit);

  // LLM evidence extraction
  const today = new Date().toISOString().split("T")[0];
  const prompt = `Sub-topic: "${subTopic.question}"
Audience: ${config.audience}
Today's date: ${today}
Recency requirement: ${subTopic.recency_requirement}

Web search results (${topResults.length} sources):
${formatResults(topResults)}

Extract all available evidence for this sub-topic following the quality standards in your instructions.
Prioritise recent sources when recency is "critical" or "preferred".
Flag any sources that appear to be blogs, forums, or opinion pieces as (unverified) in the citation.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: SEARCHER_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const extracted = parseJSON<RawExtracted>(raw);

  // Build SourceItem list with credibility assessment
  const sources: SourceItem[] = topResults.map((r) => {
    const domain = (() => {
      try { return new URL(r.url).hostname.replace("www.", ""); }
      catch { return r.url; }
    })();

    const isHighCredibility = preferredDomains.some((d) => r.url.includes(d));
    const isLowCredibility = /\b(blog|medium\.com|reddit|quora|forum|substack)\b/.test(r.url);

    return {
      title: r.title || domain,
      url: r.url,
      date: r.date,
      type: isHighCredibility ? ("primary" as const) : ("secondary" as const),
      credibility_note: isHighCredibility
        ? "Priority source"
        : isLowCredibility
        ? "Community/opinion source — treat with caution"
        : "",
      relevance_score: isHighCredibility ? ("high" as const) : ("medium" as const),
    };
  });

  return {
    sub_topic: subTopic.question,
    coverage: extracted.coverage,
    key_assertions: extracted.key_assertions ?? [],
    data_points: extracted.data_points ?? [],
    notable_quotes: extracted.notable_quotes ?? [],
    gaps: extracted.gaps ?? [],
    sources,
  };
}
