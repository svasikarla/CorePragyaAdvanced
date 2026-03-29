import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/trending-feed/dismiss
 * Marks an article as dismissed for the user. (FR-22, FR-23)
 */
export async function POST(request: Request) {
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

    const { articleId } = await request.json();

    if (!articleId) {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
    }

    // Verify the article belongs to this user before dismissing
    const { data: article, error: fetchError } = await supabaseAdmin
      .from('knowledgebase')
      .select('id, user_id, category')
      .eq('id', articleId)
      .single();

    if (fetchError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    if (article.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // FR-22: Mark as dismissed
    const { error: updateError } = await supabaseAdmin
      .from('knowledgebase')
      .update({ is_dismissed: true })
      .eq('id', articleId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to dismiss article' }, { status: 500 });
    }

    // FR-23: Record negative feedback signal for future curation improvement
    // Store in trending_metrics as a negative signal
    const today = new Date().toISOString().split('T')[0];
    const dismissKey = `dismissed:${article.category}`;

    const { data: existing } = await supabaseAdmin
      .from('trending_metrics')
      .select('id, search_count')
      .eq('entity_name', dismissKey)
      .eq('metric_date', today)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('trending_metrics')
        .update({ search_count: existing.search_count + 1 })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('trending_metrics')
        .insert({ entity_name: dismissKey, search_count: 1, view_count: 0, metric_date: today });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Dismiss error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
