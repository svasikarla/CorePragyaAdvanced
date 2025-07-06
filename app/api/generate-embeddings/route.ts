import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings } from '@/lib/ai-clients';

// Create a Supabase client with admin privileges
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Batch size for processing chunks
const BATCH_SIZE = 10;

// Embedding model to use (defined in ai-clients.ts)
const EMBEDDING_MODEL = 'embed-english-v3.0';

export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    // Extract the token
    const token = authHeader.split(' ')[1];

    // Verify the token and get the user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body parameters
    const { limit = 50 } = await request.json();

    // Fetch chunks without embeddings
    const { data: chunks, error: fetchError } = await supabaseAdmin
      .from('embeddings')
      .select('id, chunk_text')
      .is('vector', null)
      .limit(limit);

    if (fetchError) {
      console.error('Error fetching chunks:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch chunks' }, { status: 500 });
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No chunks found without embeddings',
        processed: 0
      });
    }

    console.log(`Processing ${chunks.length} chunks for embeddings`);

    // Process chunks in batches
    let processedCount = 0;
    let failedCount = 0;

    // Process in batches to avoid rate limits
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);

      try {
        // Generate embeddings for the batch using Cohere
        const chunkTexts = batchChunks.map(chunk => chunk.chunk_text);
        const embeddings = await generateEmbeddings(chunkTexts);

        // Update each chunk with its embedding
        for (let j = 0; j < batchChunks.length; j++) {
          const chunk = batchChunks[j];
          const embedding = embeddings[j];

          // Update the database with the embedding
          const { error: updateError } = await supabaseAdmin
            .from('embeddings')
            .update({ vector: embedding })
            .eq('id', chunk.id);

          if (updateError) {
            console.error(`Error updating embedding for chunk ${chunk.id}:`, updateError);
            failedCount++;
          } else {
            processedCount++;
          }
        }

        // Sleep for a short time to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (batchError) {
        console.error('Error processing batch:', batchError);
        failedCount += batchChunks.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} chunks with embeddings`,
      processed: processedCount,
      failed: failedCount
    });

  } catch (err) {
    const error = err as Error;
    console.error('Unhandled error generating embeddings:', error);
    return NextResponse.json({
      error: `Internal server error: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}
