import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLLMProvider, getModelForProvider } from '@/lib/ai-clients';
import { getUserInterestProfile } from '@/lib/interest-profile';
import { DEFAULT_FEED_CATALOG, getFeedsForCategories } from '@/lib/default-feeds';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TARGET_SUGGESTIONS = 6;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get user's interest profile (FR-01)
    const profile = await getUserInterestProfile(user.id, supabaseAdmin);
    const topTopics = profile.topKeywords.length > 0
      ? profile.topKeywords.slice(0, 3)
      : ["Artificial Intelligence", "Technology", "Startups"];

    // 2. Get already-subscribed feed URLs
    const { data: existingSubs } = await supabaseAdmin
      .from('user_subscriptions')
      .select('rss_feeds(url)')
      .eq('user_id', user.id);

    const subscribedUrls = new Set(
      (existingSubs || []).map((s: any) => s.rss_feeds?.url).filter(Boolean)
    );

    // 3. FR-07: Start with default catalog feeds matching user's interests
    const catalogMatches = getFeedsForCategories(topTopics)
      .filter(f => !subscribedUrls.has(f.url));

    let suggestions = catalogMatches.slice(0, TARGET_SUGGESTIONS).map(f => ({
      name: f.name,
      url: f.url,
      description: f.description,
      category: f.category,
      source: 'catalog' as const,
    }));

    // 4. If catalog doesn't have enough, supplement with LLM suggestions
    if (suggestions.length < TARGET_SUGGESTIONS) {
      const remaining = TARGET_SUGGESTIONS - suggestions.length;
      const existingUrls = new Set([...subscribedUrls, ...suggestions.map(s => s.url)]);

      try {
        const llmProvider = getLLMProvider();
        const modelName = getModelForProvider('claude-3-5-sonnet');
        const prompt = `You are a knowledge curation assistant. The user researches these topics: [${topTopics.join(', ')}].

Recommend exactly ${remaining} highly-reliable, actively maintained RSS feeds matching these interests.
CRITICAL: Only provide feeds you are 100% certain exist (standard known feeds from NYT, TechCrunch, Wired, The Verge, Arxiv, Nature, MIT Tech Review, etc.).

Format as a raw JSON array (no markdown, no introduction):
[{"name": "Site Name", "url": "https://exact-rss-url.xml", "description": "One sentence pitch.", "category": "Topic"}]`;

        const completion = await llmProvider.createCompletion({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 1000,
        });

        let raw = completion.content || '[]';
        raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const llmSuggestions = JSON.parse(raw);

        if (Array.isArray(llmSuggestions)) {
          const filtered = llmSuggestions
            .filter((s: any) => s.url && !existingUrls.has(s.url))
            .map((s: any) => ({ ...s, source: 'ai' as const }));
          suggestions = [...suggestions, ...filtered.slice(0, remaining)];
        }
      } catch (parseErr) {
        console.error("Failed to parse LLM feed suggestions", parseErr);
      }
    }

    // 5. If still empty, provide hardcoded fallbacks
    if (suggestions.length === 0) {
      suggestions = [
        { name: "TechCrunch", url: "https://techcrunch.com/feed/", description: "Breaking technology news and startup funding.", category: topTopics[0] || "Technology", source: 'catalog' as const },
        { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", description: "Mainstream tech, science, and art coverage.", category: topTopics[1] || "Technology", source: 'catalog' as const },
      ].filter(s => !subscribedUrls.has(s.url));
    }

    return NextResponse.json({
      success: true,
      topics_analyzed: topTopics,
      suggestions,
      catalog_size: DEFAULT_FEED_CATALOG.length,
    });

  } catch (error) {
    console.error("Error generating feed suggestions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
