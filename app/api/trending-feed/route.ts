import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_LIMIT = 10;
const RECENCY_HALF_LIFE_HOURS = 48;

interface TrendingArticle {
  id: string;
  title: string;
  summary_text: string;
  source_ref: string;
  source_name: string | null;
  category: string;
  relevance_score: number | null;
  relevance_snippet: string | null;
  published_at: string | null;
  created_at: string;
  composite_score: number;
  is_new: boolean;
}

/**
 * GET /api/trending-feed?category=AI&page=1&limit=10
 * Returns a ranked, curated feed of articles for the authenticated user. (FR-14, FR-15)
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT))));

    // Fetch more than needed so we can score and re-rank in JS
    const fetchLimit = limit * 3;
    const offset = 0; // Always fetch from top; we paginate after composite scoring

    let query = supabaseAdmin
      .from('knowledgebase')
      .select('id, title, summary_text, source_ref, source_name, category, relevance_score, relevance_snippet, published_at, created_at, source_type')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(fetchLimit);

    // FR-21: Category filter
    if (category) {
      query = query.ilike('category', `%${category}%`);
    }

    let { data: entries, error: dbError } = await query;

    // If the query failed (e.g. is_dismissed column missing — migration not yet applied),
    // fall back to a query without the trending-feed-specific columns so the route still responds.
    if (dbError) {
      console.error('Trending feed query error (attempting fallback):', dbError);

      let fallbackQuery = supabaseAdmin
        .from('knowledgebase')
        .select('id, title, summary_text, source_ref, category, created_at, source_type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(fetchLimit);

      if (category) {
        fallbackQuery = fallbackQuery.ilike('category', `%${category}%`);
      }

      const { data: fallbackEntries, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        console.error('Trending feed fallback query error:', fallbackError);
        return NextResponse.json({ error: 'Database error — ensure migrations are applied' }, { status: 500 });
      }

      entries = fallbackEntries;
    }

    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    // FR-14: Composite score = relevance_score * recency_weight
    const scored: TrendingArticle[] = (entries || []).map(entry => {
      const entryTime = new Date(entry.published_at || entry.created_at).getTime();
      const ageHours = Math.max(0, (now - entryTime) / (1000 * 60 * 60));
      const recencyWeight = Math.exp(-ageHours / RECENCY_HALF_LIFE_HOURS);
      const baseScore = entry.relevance_score ?? 5;
      const compositeScore = baseScore * recencyWeight;

      return {
        id: entry.id,
        title: entry.title || entry.summary_text,
        summary_text: entry.summary_text,
        source_ref: entry.source_ref,
        source_name: entry.source_name,
        category: entry.category,
        relevance_score: entry.relevance_score,
        relevance_snippet: entry.relevance_snippet,
        published_at: entry.published_at,
        created_at: entry.created_at,
        composite_score: Math.round(compositeScore * 100) / 100,
        is_new: (now - entryTime) < TWO_HOURS_MS, // FR-20
      };
    });

    // Sort by composite score descending
    scored.sort((a, b) => b.composite_score - a.composite_score);

    // Paginate
    const startIdx = (page - 1) * limit;
    const pageItems = scored.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < scored.length;

    // Extract available categories for filter UI (FR-21)
    const allCategories = [...new Set((entries || []).map(e => e.category).filter(Boolean))];

    return NextResponse.json({
      articles: pageItems,
      page,
      limit,
      has_more: hasMore,
      total: scored.length,
      categories: allCategories,
    });
  } catch (error) {
    console.error('Trending feed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
