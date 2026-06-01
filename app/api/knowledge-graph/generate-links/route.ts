import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { generateEmbeddings } from '@/lib/ai-clients';

// Build the text we embed to represent an entry for similarity search.
function entryText(entry: { title?: string | null; summary_text?: string | null }): string {
  const title = entry.title?.trim() || '';
  const summary = entry.summary_text?.trim() || '';
  return `${title}. ${summary}`.trim().slice(0, 2000);
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    // User-scoped client — match_embeddings filters by auth.uid(), so this must
    // run as the user (not the service role) for results to be scoped correctly.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const minSimilarity: number = body.minSimilarity ?? 0.5; // cosine similarity threshold
    const topK: number = body.topK ?? 5;                     // max neighbours per entry
    const maxLinks: number = body.maxLinks ?? 2000;
    const maxEntries: number = body.maxEntries ?? 500;       // safety cap for the batch job

    // Fetch the user's entries (most recent first).
    const { data: entries, error: entriesError } = await supabase
      .from('knowledgebase')
      .select('id, title, summary_text')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(maxEntries);

    if (entriesError) throw entriesError;
    if (!entries || entries.length < 2) {
      return NextResponse.json({
        success: true,
        linksCreated: 0,
        message: 'Need at least two knowledge base entries to find connections.',
      });
    }
    const entryList = entries; // non-null; stable reference for closures below

    // Embed every entry's text (batched to respect provider limits).
    const texts = entryList.map(entryText);
    const vectors: number[][] = [];
    const BATCH = 90;
    for (let i = 0; i < texts.length; i += BATCH) {
      const part = await generateEmbeddings(texts.slice(i, i + BATCH));
      vectors.push(...part);
    }

    const idSet = new Set(entryList.map((e) => e.id));
    // Undirected edges keyed by sorted "a|b" → best similarity seen.
    const edges = new Map<string, number>();
    let rpcMissing = false;

    // kNN per entry via the existing pgvector RPC, with limited concurrency.
    const CONCURRENCY = 5;
    let cursor = 0;
    async function worker() {
      while (cursor < entryList.length) {
        const i = cursor++;
        const self = entryList[i].id;
        const { data: matches, error } = await supabase.rpc('match_embeddings', {
          query_embedding: vectors[i],
          match_threshold: minSimilarity,
          match_count: topK + 8, // over-fetch: chunks collapse to fewer distinct entries
        });
        if (error) {
          if (error.message?.includes('does not exist')) { rpcMissing = true; return; }
          // Non-fatal: skip this entry
          continue;
        }
        // Collapse chunk matches to the best similarity per distinct entry.
        const bestPerEntry = new Map<string, number>();
        for (const m of (matches as { kb_id: string; similarity: number }[]) ?? []) {
          if (m.kb_id === self || !idSet.has(m.kb_id)) continue;
          const prev = bestPerEntry.get(m.kb_id) ?? 0;
          if (m.similarity > prev) bestPerEntry.set(m.kb_id, m.similarity);
        }
        const neighbours = [...bestPerEntry.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, topK);
        for (const [nid, sim] of neighbours) {
          const [a, b] = self < nid ? [self, nid] : [nid, self];
          const key = `${a}|${b}`;
          const prev = edges.get(key);
          if (prev === undefined || sim > prev) edges.set(key, sim);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (rpcMissing) {
      return NextResponse.json(
        {
          error: 'Semantic search is not available',
          message: 'The match_embeddings function or embeddings table is missing. Run migrations/create_embeddings_table.sql in Supabase.',
        },
        { status: 500 }
      );
    }

    // Rank by strength and cap.
    let rows = [...edges.entries()]
      .map(([key, sim]) => {
        const [a, b] = key.split('|');
        return {
          user_id: user.id,
          source_kb_id: a,
          target_kb_id: b,
          link_type: 'semantic',
          link_strength: Math.round(sim * 1000) / 1000,
          shared_keywords: [] as string[],
        };
      })
      .sort((x, y) => y.link_strength - x.link_strength);
    if (rows.length > maxLinks) rows = rows.slice(0, maxLinks);

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        linksCreated: 0,
        totalEntries: entries.length,
        message:
          'No connections passed the similarity threshold. Make sure embeddings have been generated for your entries, or lower the threshold.',
      });
    }

    // Replace previously auto-generated links so regeneration is idempotent
    // (manual links, if any, are preserved).
    await supabase
      .from('knowledge_graph_links')
      .delete()
      .eq('user_id', user.id)
      .in('link_type', ['auto', 'semantic']);

    let insertedCount = 0;
    const insertBatch = 100;
    for (let i = 0; i < rows.length; i += insertBatch) {
      const batch = rows.slice(i, i + insertBatch);
      const { error } = await supabase
        .from('knowledge_graph_links')
        .upsert(batch, { onConflict: 'user_id,source_kb_id,target_kb_id', ignoreDuplicates: false });
      if (error) {
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          return NextResponse.json(
            {
              error: 'Knowledge graph table not found',
              message: 'Please run the migration first: node scripts/create-knowledge-graph-links-table.js',
              details: error.message,
            },
            { status: 500 }
          );
        }
        console.error('Error inserting link batch:', error.message);
      } else {
        insertedCount += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      linksCreated: insertedCount,
      totalEntries: entries.length,
      method: 'embedding-cosine',
      message: `Found ${insertedCount} semantic connections across ${entries.length} entries.`,
    });
  } catch (error) {
    console.error('Error in generate-links API:', error);
    return NextResponse.json(
      { error: 'Failed to generate links', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
