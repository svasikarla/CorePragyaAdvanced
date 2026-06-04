import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings, getLLMProvider, getModelForProvider } from '@/lib/ai-clients';
import { getUserInterestProfile } from '@/lib/interest-profile';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ITEMS_PER_FEED = 5;
const RELEVANCE_THRESHOLD = 4;

/**
 * GET /api/cron/ingest-feeds
 * Scheduled endpoint called by Vercel Cron every 30 minutes (FR-08).
 * Processes RSS feeds for ALL users with active subscriptions.
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret (Vercel sends this automatically)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get all active subscriptions grouped by feed
    const { data: allSubs, error: subsError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, rss_feeds(*)');

    if (subsError || !allSubs) {
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    // Group: feed -> list of user_ids
    const feedUsers = new Map<string, { feed: any; userIds: string[] }>();

    for (const sub of allSubs) {
      const feed = (sub as any).rss_feeds;
      if (!feed || feed.status !== 'active') continue;

      if (!feedUsers.has(feed.id)) {
        feedUsers.set(feed.id, { feed, userIds: [] });
      }
      feedUsers.get(feed.id)!.userIds.push(sub.user_id);
    }

    let totalProcessed = 0;
    let totalFiltered = 0;
    let feedsProcessed = 0;

    for (const [, { feed, userIds }] of feedUsers) {
      try {
        // Fetch RSS once per feed
        const response = await fetch(feed.url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) continue;
        const xml = await response.text();

        const parsedItems = parseRssItems(xml).slice(0, MAX_ITEMS_PER_FEED);

        // Process for each subscribed user
        for (const userId of userIds) {
          // Deduplicate per user
          const itemLinks = parsedItems.map(item => item.link);
          const { data: existing } = await supabaseAdmin
            .from('knowledgebase')
            .select('source_ref')
            .eq('user_id', userId)
            .in('source_ref', itemLinks);

          const existingLinks = new Set((existing || []).map(e => e.source_ref));
          const newItems = parsedItems.filter(item => !existingLinks.has(item.link));

          if (newItems.length === 0) continue;

          // Score against user's interest profile
          const profile = await getUserInterestProfile(userId, supabaseAdmin);
          const scores = await batchScoreArticles(newItems, profile);

          for (let i = 0; i < newItems.length; i++) {
            const item = newItems[i];
            const score = scores[i] || { category: 'General', relevance_score: 5, relevance_snippet: '', keep: true };

            if (!score.keep && score.relevance_score < RELEVANCE_THRESHOLD) {
              totalFiltered++;
              continue;
            }

            const rawText = `${item.title}\n\n${item.description}`;
            const { data: kbEntry } = await supabaseAdmin
              .from('knowledgebase')
              .insert({
                user_id: userId,
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
                const chunkText = rawText.slice(0, 8000);
                const [vector] = await generateEmbeddings(chunkText);
                if (vector) {
                  // Clear the insert-trigger placeholder, then write a real chunk
                  // in the match_embeddings schema (kb_id/chunk_text/chunk_index/vector).
                  await supabaseAdmin.from('embeddings').delete().eq('kb_id', kbEntry.id);
                  await supabaseAdmin.from('embeddings').insert({
                    kb_id: kbEntry.id,
                    chunk_text: chunkText,
                    chunk_index: 0,
                    vector,
                  });
                }
              } catch {
                // Non-critical: embedding failure shouldn't block ingestion
              }
              totalProcessed++;
            }
          }
        }

        // Update feed timestamp
        await supabaseAdmin
          .from('rss_feeds')
          .update({ last_fetched_at: new Date().toISOString() })
          .eq('id', feed.id);

        feedsProcessed++;
      } catch (feedErr) {
        console.error(`Cron: error processing feed ${feed.url}:`, feedErr);
      }
    }

    return NextResponse.json({
      success: true,
      feeds_processed: feedsProcessed,
      articles_ingested: totalProcessed,
      articles_filtered: totalFiltered,
    });
  } catch (error) {
    console.error('Cron ingestion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// --- Shared helpers (same as ingest-rss) ---

interface ParsedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string | null;
}

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

    if (titleMatch) {
      const pubDateStr = pubDateMatch?.[1] || updatedMatch?.[1];
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

async function batchScoreArticles(
  items: ParsedItem[],
  profile: { categories: { name: string; weight: number }[]; recentSummaries: string[] }
): Promise<{ category: string; relevance_score: number; relevance_snippet: string; keep: boolean }[]> {
  const fallback = items.map(() => ({
    category: 'General', relevance_score: 5, relevance_snippet: '', keep: true,
  }));

  try {
    const llmProvider = getLLMProvider();
    const modelName = getModelForProvider('claude-3-haiku');

    const interestCtx = profile.categories.slice(0, 6)
      .map(c => `${c.name} (${c.weight})`).join(', ');
    const summaryCtx = profile.recentSummaries.length > 0
      ? `\nRECENT KB TOPICS:\n${profile.recentSummaries.slice(0, 3).join('\n')}` : '';
    const articleList = items
      .map((item, i) => `${i + 1}. Title: ${item.title}\n   Desc: ${item.description.substring(0, 200)}`)
      .join('\n');

    const result = await llmProvider.createCompletion({
      model: modelName,
      system: `Score each article against a user's interests. For each, provide:
- category (2-3 words), relevance_score (0-10), relevance_snippet (1-2 sentences why it matters), keep (true if score>=${RELEVANCE_THRESHOLD}).
Respond with ONLY a JSON array.`,
      messages: [{ role: 'user', content: `INTERESTS: ${interestCtx || 'General'}${summaryCtx}\n\nARTICLES:\n${articleList}` }],
      temperature: 0.1,
      max_tokens: 800,
    });

    let raw = result.content.trim().replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === items.length) return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}
