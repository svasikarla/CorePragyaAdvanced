import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Extract keywords from summary JSON
function extractKeywords(summaryJson: any): string[] {
  try {
    const keywords: string[] = [];

    // Extract from key_points
    if (summaryJson?.key_points && Array.isArray(summaryJson.key_points)) {
      summaryJson.key_points.forEach((point: string) => {
        // Simple keyword extraction - split by non-word characters
        const words = point
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
          .split(/\s+/)
          .filter(w => w.length > 4); // Only words longer than 4 characters
        keywords.push(...words);
      });
    }

    // Extract from main_ideas
    if (summaryJson?.main_ideas && Array.isArray(summaryJson.main_ideas)) {
      summaryJson.main_ideas.forEach((idea: string) => {
        const words = idea
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 4);
        keywords.push(...words);
      });
    }

    // Remove duplicates and common words
    const commonWords = new Set([
      'that', 'this', 'with', 'from', 'have', 'their', 'would', 'about',
      'there', 'which', 'could', 'other', 'these', 'those', 'being', 'should',
      'where', 'while', 'after', 'before', 'through', 'during', 'between'
    ]);

    const uniqueKeywords = [...new Set(keywords)]
      .filter(w => !commonWords.has(w))
      .slice(0, 15); // Top 15 keywords

    return uniqueKeywords;
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return [];
  }
}

// Calculate similarity between two sets of keywords
function calculateSimilarity(keywords1: string[], keywords2: string[]): {
  sharedKeywords: string[];
  similarity: number;
} {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  const sharedKeywords = keywords1.filter(k => set2.has(k));
  const totalUniqueKeywords = new Set([...keywords1, ...keywords2]).size;

  // Jaccard similarity coefficient
  const similarity = totalUniqueKeywords > 0
    ? sharedKeywords.length / totalUniqueKeywords
    : 0;

  return { sharedKeywords, similarity };
}

export async function POST(request: Request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const minSimilarity = body.minSimilarity || 0.15; // Minimum similarity threshold
    const maxLinks = body.maxLinks || 1000; // Maximum links to create

    console.log(`Generating links for user ${user.id} with minSimilarity=${minSimilarity}`);

    // Fetch all user's knowledge base entries
    const { data: entries, error: entriesError } = await supabase
      .from('knowledgebase')
      .select('id, summary_json, category, title')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      throw entriesError;
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        success: true,
        linksCreated: 0,
        message: 'No knowledge base entries found',
      });
    }

    console.log(`Found ${entries.length} entries to analyze`);

    // Extract keywords for all entries
    const entriesWithKeywords = entries.map(entry => ({
      ...entry,
      keywords: extractKeywords(entry.summary_json),
    }));

    const linksToInsert: any[] = [];
    let comparisons = 0;

    // Compare each entry with every other entry
    for (let i = 0; i < entriesWithKeywords.length; i++) {
      for (let j = i + 1; j < entriesWithKeywords.length; j++) {
        comparisons++;

        const entry1 = entriesWithKeywords[i];
        const entry2 = entriesWithKeywords[j];

        // Calculate similarity
        const { sharedKeywords, similarity } = calculateSimilarity(
          entry1.keywords,
          entry2.keywords
        );

        // Create link if similarity meets threshold
        if (similarity >= minSimilarity && sharedKeywords.length >= 2) {
          // Boost similarity if same category
          const categoryBoost = entry1.category === entry2.category ? 0.1 : 0;
          const finalStrength = Math.min(similarity + categoryBoost, 1.0);

          linksToInsert.push({
            user_id: user.id,
            source_kb_id: entry1.id,
            target_kb_id: entry2.id,
            link_type: 'auto',
            link_strength: finalStrength,
            shared_keywords: sharedKeywords,
          });

          // Stop if we've reached max links
          if (linksToInsert.length >= maxLinks) {
            console.log(`Reached maximum links limit (${maxLinks})`);
            break;
          }
        }
      }

      if (linksToInsert.length >= maxLinks) {
        break;
      }
    }

    console.log(`Made ${comparisons} comparisons, found ${linksToInsert.length} potential links`);

    // Batch insert links (upsert to avoid duplicates)
    let insertedCount = 0;
    if (linksToInsert.length > 0) {
      // Insert in batches of 100 to avoid timeout
      const batchSize = 100;
      for (let i = 0; i < linksToInsert.length; i += batchSize) {
        const batch = linksToInsert.slice(i, i + batchSize);

        const { data, error } = await supabase
          .from('knowledge_graph_links')
          .upsert(batch, {
            onConflict: 'user_id,source_kb_id,target_kb_id',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error('Error inserting batch:', error);

          // Check if it's a table doesn't exist error
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            return NextResponse.json(
              {
                error: 'Knowledge graph table not found',
                message: 'Please run the database migration first: node scripts/create-knowledge-graph-links-table.js',
                details: error.message,
              },
              { status: 500 }
            );
          }
          // Continue with other batches even if one fails
        } else {
          insertedCount += batch.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      linksCreated: insertedCount,
      totalEntries: entries.length,
      comparisons,
      message: `Successfully generated ${insertedCount} connections from ${entries.length} entries`,
    });
  } catch (error) {
    console.error('Error in generate-links API:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate links',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
