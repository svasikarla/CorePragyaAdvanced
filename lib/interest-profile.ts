import { SupabaseClient } from '@supabase/supabase-js';

export interface InterestProfile {
  categories: { name: string; weight: number }[];
  recentSummaries: string[];
  topKeywords: string[];
}

/**
 * Builds a unified interest profile for a user from their Knowledge Base.
 * Used by ingest-rss (scoring), suggest-feeds (recommendations), and generate-insights.
 */
export async function getUserInterestProfile(
  userId: string,
  supabase: SupabaseClient
): Promise<InterestProfile> {
  // 1. Category weights from all KB entries
  const { data: kbItems } = await supabase
    .from('knowledgebase')
    .select('category')
    .eq('user_id', userId);

  const counts: Record<string, number> = {};
  kbItems?.forEach(item => {
    if (item.category) counts[item.category] = (counts[item.category] || 0) + 1;
  });

  const categories = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, weight]) => ({ name, weight }));

  // 2. Recent non-RSS summaries for semantic context
  const { data: recentEntries } = await supabase
    .from('knowledgebase')
    .select('summary_text, summary_json')
    .eq('user_id', userId)
    .neq('source_type', 'rss')
    .order('created_at', { ascending: false })
    .limit(10);

  const recentSummaries = (recentEntries || []).map(e => {
    const keyPoints = e.summary_json?.key_points?.slice(0, 2)?.join('; ') || '';
    return `${e.summary_text}${keyPoints ? ` (${keyPoints})` : ''}`;
  }).filter(Boolean).slice(0, 5);

  return {
    categories,
    recentSummaries,
    topKeywords: categories.slice(0, 5).map(c => c.name),
  };
}
