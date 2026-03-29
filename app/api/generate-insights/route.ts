import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLLMProvider, getModelForProvider } from '@/lib/ai-clients'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's KB entries with actual summaries and key_points
    const { data: entries, error: dbError } = await supabaseAdmin
      .from('knowledgebase')
      .select('id, summary_text, summary_json, category, source_type, source_ref, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (dbError || !entries || entries.length === 0) {
      return NextResponse.json({
        insights: [
          "Welcome to your knowledge dashboard!",
          "Start adding entries to build your personal knowledge base.",
          "We'll provide personalized insights as your collection grows."
        ],
        trending_topics: []
      })
    }

    // Build a rich digest from actual content — summaries + key_points
    const entryDigest = entries.map((e, i) => {
      const keyPoints = e.summary_json?.key_points?.slice(0, 3)?.join('; ') || '';
      const source = e.source_type === 'rss' ? ' (RSS)' : e.source_type === 'pdf' ? ' (PDF)' : '';
      return `${i + 1}. [${e.category}]${source} ${e.summary_text}${keyPoints ? ` | Key points: ${keyPoints}` : ''}`;
    }).join('\n');

    // Category breakdown for context
    const categoryCounts: Record<string, number> = {};
    entries.forEach(e => {
      const cat = e.category || 'Uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');

    const llmProvider = getLLMProvider();
    const modelName = getModelForProvider('claude-3-5-sonnet');

    const result = await llmProvider.createCompletion({
      model: modelName,
      system: `You are an elite intelligence analyst specializing in knowledge pattern recognition.
You will analyze a user's personal knowledge base and provide two outputs:

1. TRENDING_TOPICS: Extract 4-6 dominant themes by analyzing the actual CONTENT and summaries, not just category labels. Look for recurring subjects, emerging patterns, and cross-cutting themes across entries. Each topic must have a short name (2-4 words), a one-sentence description explaining why it matters, and a relevance score 1-10.

2. INSIGHTS: Provide 4-5 deep, specific, actionable insights:
   - Connections between seemingly unrelated entries
   - Emerging knowledge trajectories or patterns
   - Knowledge gaps relative to their interests
   - Concrete next-step recommendations

Be specific. Reference actual content themes from the entries. Avoid generic advice like "add more entries."

Respond with ONLY valid JSON (no markdown fences):
{
  "trending_topics": [
    { "name": "Topic Name", "description": "Why this matters in their collection", "relevance": 8 }
  ],
  "insights": [
    "Specific insight referencing their actual content themes..."
  ]
}`,
      messages: [{
        role: 'user',
        content: `Knowledge Base (${entries.length} most recent entries across categories: ${categoryBreakdown}):\n\n${entryDigest}`
      }],
      temperature: 0.3,
      max_tokens: 1200,
    });

    let parsed;
    try {
      let raw = result.content.trim();
      raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(raw);
    } catch {
      // Structured fallback if LLM output can't be parsed
      const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
      parsed = {
        trending_topics: sortedCategories.slice(0, 4).map(([name, count]) => ({
          name,
          description: `${count} entries in your collection`,
          relevance: Math.min(10, count * 2)
        })),
        insights: [
          `Your knowledge base spans ${sortedCategories.length} categories with ${entries.length} recent entries.`,
          `Your deepest focus area is ${sortedCategories[0]?.[0] || 'diverse topics'} — consider exploring adjacent fields to find cross-cutting patterns.`,
          "Continue growing your collection to unlock richer pattern analysis."
        ]
      };
    }

    return NextResponse.json({
      insights: parsed.insights || [],
      trending_topics: (parsed.trending_topics || []).sort(
        (a: any, b: any) => (b.relevance || 0) - (a.relevance || 0)
      )
    });
  } catch (error) {
    console.error('Error generating insights:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
