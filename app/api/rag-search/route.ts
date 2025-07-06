import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { openai, anthropic, generateEmbeddings, getModelMapping } from '@/lib/ai-clients';

// Create a Supabase client with admin privileges
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Embedding model to use
const EMBEDDING_MODEL = 'text-embedding-3-small';

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
    const { query, limit = 5, useAI = true } = await request.json();

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Generate embedding for the query using Cohere
    const embeddingResults = await generateEmbeddings(query.trim());
    const queryEmbedding = embeddingResults[0];

    // Search for similar chunks using vector similarity
    const { data: similarChunks, error: searchError } = await supabaseAdmin.rpc(
      'match_embeddings',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5, // Adjust as needed
        match_count: limit
      }
    );

    if (searchError) {
      console.error('Error searching embeddings:', searchError);

      // If the RPC function doesn't exist, create it
      if (searchError.message && searchError.message.includes('function "match_embeddings" does not exist')) {
        try {
          await createMatchEmbeddingsFunction();

          // Try the search again
          const { data: retryChunks, error: retryError } = await supabaseAdmin.rpc(
            'match_embeddings',
            {
              query_embedding: queryEmbedding,
              match_threshold: 0.5,
              match_count: limit
            }
          );

          if (retryError) {
            console.error('Error in retry search:', retryError);
            return NextResponse.json({ error: 'Failed to search embeddings' }, { status: 500 });
          }

          similarChunks = retryChunks;
        } catch (funcError) {
          console.error('Error creating match_embeddings function:', funcError);
          return NextResponse.json({
            error: 'Failed to create search function. Please contact support.'
          }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'Failed to search embeddings' }, { status: 500 });
      }
    }

    if (!similarChunks || similarChunks.length === 0) {
      return NextResponse.json({
        results: [],
        message: 'No similar content found'
      });
    }

    // Fetch the full knowledge base entries for the matched chunks
    const kbIds = [...new Set(similarChunks.map(chunk => chunk.kb_id))];

    const { data: knowledgeEntries, error: kbError } = await supabaseAdmin
      .from('knowledgebase')
      .select('id, title, category, summary_text, source_ref, source_type')
      .in('id', kbIds);

    if (kbError) {
      console.error('Error fetching knowledge entries:', kbError);
      return NextResponse.json({ error: 'Failed to fetch knowledge entries' }, { status: 500 });
    }

    // Combine the results
    const results = similarChunks.map(chunk => {
      const knowledgeEntry = knowledgeEntries.find(entry => entry.id === chunk.kb_id);
      return {
        chunk_id: chunk.id,
        kb_id: chunk.kb_id,
        chunk_text: chunk.chunk_text,
        chunk_index: chunk.chunk_index,
        similarity: chunk.similarity,
        title: knowledgeEntry?.title || 'Unknown',
        category: knowledgeEntry?.category || 'Uncategorized',
        summary: knowledgeEntry?.summary_text || '',
        source_url: knowledgeEntry?.source_ref || '',
        source_type: knowledgeEntry?.source_type || 'unknown'
      };
    });

    // If AI enhancement is requested, generate an AI response
    let aiResponse = null;
    if (useAI && results.length > 0) {
      // Combine the chunks for context
      const context = results
        .map(r => r.chunk_text)
        .join('\n\n')
        .substring(0, 15000); // Limit context size

      // Generate AI response using Anthropic Claude
      const completion = await anthropic.messages.create({
        model: 'claude-3-5-sonnet',
        system: 'You are an AI assistant for CorePragya, a knowledge management system. Answer the user\'s question based on the provided context. If the context doesn\'t contain relevant information or you cannot find specific information in the context to answer the question, respond with: "I don\'t have enough information about [topic] in your knowledge base."',
        messages: [
          {
            role: 'user',
            content: `Context information is below.
---------------------
${context}
---------------------
Given the context information and not prior knowledge, answer the question: ${query}

IMPORTANT: Only use information from the context above. If the context doesn't contain enough information to fully answer the question, state clearly: "I don't have enough information about [specific topic] in your knowledge base." Do not use any external knowledge.`
          }
        ],
        temperature: 0.5,
        max_tokens: 500
      });

      aiResponse = completion.content;
    }

    return NextResponse.json({
      results,
      aiResponse,
      message: `Found ${results.length} relevant chunks`
    });

  } catch (err) {
    const error = err as Error;
    console.error('Unhandled error in RAG search:', error);
    return NextResponse.json({
      error: `Internal server error: ${error.message || 'Unknown error'}`
    }, { status: 500 });
  }
}

// Helper function to create the match_embeddings function if it doesn't exist
async function createMatchEmbeddingsFunction() {
  try {
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION match_embeddings(
        query_embedding vector,
        match_threshold float,
        match_count int
      )
      RETURNS TABLE (
        id uuid,
        kb_id uuid,
        chunk_text text,
        chunk_index int,
        similarity float
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          e.id,
          e.kb_id,
          e.chunk_text,
          e.chunk_index,
          1 - (e.vector <=> query_embedding) AS similarity
        FROM
          embeddings e
        WHERE
          e.vector IS NOT NULL
        ORDER BY
          e.vector <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `;

    const { error } = await supabaseAdmin.rpc('execute_sql', { sql: createFunctionSQL });

    if (error) {
      console.error('Error creating match_embeddings function:', error);
      throw new Error(`Failed to create function: ${error.message}`);
    }

    console.log('Successfully created match_embeddings function');
    return true;
  } catch (error) {
    console.error('Error in createMatchEmbeddingsFunction:', error);
    throw error;
  }
}
