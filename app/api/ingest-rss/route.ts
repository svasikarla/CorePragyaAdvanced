import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings, getLLMProvider, getModelForProvider } from '@/lib/ai-clients';
import { getUserInterestProfile, InterestProfile } from '@/lib/interest-profile';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ITEMS_PER_FEED = 5;
const RELEVANCE_THRESHOLD = 4; // Articles scoring below this are filtered out (FR-12)

interface ParsedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string | null;
}

interface ScoredArticle {
  category: string;
  relevance_score: number;
  relevance_snippet: string;
  keep: boolean;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch user's active subscriptions
    const { data: subs, error: subsError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('rss_feeds(*)')
      .eq('user_id', user.id);

    if (subsError || !subs) {
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    const feeds = subs
      .map((s: any) => s.rss_feeds)
      .filter((f: any) => f && f.status === 'active');

    if (feeds.length === 0) {
      return NextResponse.json({ success: true, processed_articles: 0, filtered_articles: 0, message: 'No active subscriptions' });
    }

    // 2. Build user's interest profile once (FR-01, FR-02)
    const profile = await getUserInterestProfile(user.id, supabaseAdmin);

    let processedCount = 0;
    let filteredCount = 0;
    const newTopics: string[] = [];

    for (const feed of feeds) {
      try {
        // 3. Fetch raw RSS XML
        const response = await fetch(feed.url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) continue;
        const text = await response.text();

        // 4. Parse RSS items with pubDate (FR-09)
        const parsedItems = parseRssItems(text);
        const items = parsedItems.slice(0, MAX_ITEMS_PER_FEED);

        // 5. Batch deduplicate against existing KB entries (FR-13: URL dedup)
        const itemLinks = items.map(item => item.link);
        const { data: existingEntries } = await supabaseAdmin
          .from('knowledgebase')
          .select('source_ref')
          .in('source_ref', itemLinks);

        const existingLinks = new Set((existingEntries || []).map(e => e.source_ref));
        const newItems = items.filter(item => !existingLinks.has(item.link));

        if (newItems.length === 0) {
          await supabaseAdmin
            .from('rss_feeds')
            .update({ last_fetched_at: new Date().toISOString() })
            .eq('id', feed.id);
          continue;
        }

        // 6. AI Scoring: categorize + score relevance + generate snippets (FR-06, FR-11)
        const scores = await batchScoreArticles(newItems, profile);

        // 7. Insert scored articles
        for (let i = 0; i < newItems.length; i++) {
          const item = newItems[i];
          const score = scores[i] || { category: 'General', relevance_score: 5, relevance_snippet: '', keep: true };
          const rawText = `${item.title}\n\n${item.description}`;

          // FR-12: Filter out articles below threshold
          if (!score.keep && score.relevance_score < RELEVANCE_THRESHOLD) {
            filteredCount++;
            continue;
          }

          const { data: kbEntry } = await supabaseAdmin
            .from('knowledgebase')
            .insert({
              user_id: user.id,
              source_type: 'rss',
              source_ref: item.link,
              raw_text: rawText,
              summary_text: item.title,
              summary_json: { title: item.title, type: 'rss_article', feed_name: feed.name },
              category: score.category,
              relevance_score: score.relevance_score,
              relevance_snippet: score.relevance_snippet,
              published_at: item.pubDate,
              source_name: feed.name,
            })
            .select('id')
            .single();

          if (kbEntry) {
            try {
              const embeddings = await generateEmbeddings(rawText);
              if (embeddings && embeddings.length > 0) {
                await supabaseAdmin.from('embeddings').insert({
                  knowledge_base_id: kbEntry.id,
                  embedding: embeddings[0]
                });
              }
            } catch (embErr) {
              console.error(`Embedding generation failed for ${item.link}:`, embErr);
            }

            newTopics.push(score.category);
            processedCount++;
          }
        }

        // Update last_fetched_at
        await supabaseAdmin
          .from('rss_feeds')
          .update({ last_fetched_at: new Date().toISOString() })
          .eq('id', feed.id);

      } catch (feedErr) {
        console.error(`Error processing feed ${feed.url}:`, feedErr);
      }
    }

    // Update trending_metrics with newly ingested topic counts
    if (newTopics.length > 0) {
      const topicCounts: Record<string, number> = {};
      newTopics.forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; });
      const today = new Date().toISOString().split('T')[0];

      for (const [topic, count] of Object.entries(topicCounts)) {
        const { data: existingMetric } = await supabaseAdmin
          .from('trending_metrics')
          .select('id, view_count')
          .eq('entity_name', topic)
          .eq('metric_date', today)
          .single();

        if (existingMetric) {
          await supabaseAdmin
            .from('trending_metrics')
            .update({ view_count: existingMetric.view_count + count })
            .eq('id', existingMetric.id);
        } else {
          await supabaseAdmin
            .from('trending_metrics')
            .insert({ entity_name: topic, view_count: count, metric_date: today });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed_articles: processedCount,
      filtered_articles: filteredCount,
    });
  } catch (error) {
    console.error('RSS ingestion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Parse RSS/Atom items from XML text, extracting title, description, link, and pubDate (FR-09).
 */
function parseRssItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

  const cleanCDATA = (s: string) =>
    s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();

  for (const block of itemBlocks) {
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const pubDateMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    const updatedMatch = block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const publishedMatch = block.match(/<published[^>]*>([\s\S]*?)<\/published>/i);

    if (titleMatch) {
      const pubDateStr = pubDateMatch?.[1] || updatedMatch?.[1] || publishedMatch?.[1];
      let pubDate: string | null = null;
      if (pubDateStr) {
        const parsed = new Date(cleanCDATA(pubDateStr));
        if (!isNaN(parsed.getTime())) pubDate = parsed.toISOString();
      }

      items.push({
        title: cleanCDATA(titleMatch[1]),
        description: descMatch ? cleanCDATA(descMatch[1]) : '',
        link: linkMatch ? cleanCDATA(linkMatch[1]) : '',
        pubDate,
      });
    }
  }

  return items;
}

/**
 * Batch score articles against user's interest profile using LLM (FR-05, FR-06, FR-11).
 * Single LLM call handles: categorization + relevance scoring + snippet generation.
 */
async function batchScoreArticles(
  items: ParsedItem[],
  profile: InterestProfile
): Promise<ScoredArticle[]> {
  const fallback = items.map(() => ({
    category: 'General',
    relevance_score: 5,
    relevance_snippet: '',
    keep: true,
  }));

  try {
    const llmProvider = getLLMProvider();
    const modelName = getModelForProvider('claude-3-haiku');

    const interestContext = profile.categories.slice(0, 6)
      .map(c => `${c.name} (${c.weight})`)
      .join(', ');

    const summaryContext = profile.recentSummaries.length > 0
      ? `\nRECENT KB TOPICS:\n${profile.recentSummaries.slice(0, 3).join('\n')}`
      : '';

    const articleList = items
      .map((item, i) => `${i + 1}. Title: ${item.title}\n   Desc: ${item.description.substring(0, 200)}`)
      .join('\n');

    const result = await llmProvider.createCompletion({
      model: modelName,
      system: `You are a news relevance scoring engine. Score each article against a user's interest profile.

For EACH article, provide:
- category: 2-3 word topic label (e.g. "Artificial Intelligence", "Cybersecurity")
- relevance_score: 0-10 float (how relevant to user's interests; 0=unrelated, 10=perfect match)
- relevance_snippet: 1-2 sentences explaining WHY this article matters to the user based on their interests
- keep: true if relevance_score >= ${RELEVANCE_THRESHOLD}, false otherwise

Respond with ONLY a JSON array, no markdown fences, no extra text.`,
      messages: [{
        role: 'user',
        content: `USER INTERESTS (by weight): ${interestContext || 'General knowledge'}${summaryContext}

ARTICLES TO SCORE:
${articleList}`
      }],
      temperature: 0.1,
      max_tokens: 800,
    });

    let raw = result.content.trim();
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === items.length) return parsed;
    return fallback;
  } catch (err) {
    console.error('Batch scoring failed, using fallback:', err);
    return fallback;
  }
}
