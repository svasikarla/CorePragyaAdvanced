-- Create embeddings table for Cohere embeddings (1024 dimensions)
-- Enable the vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id UUID NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  vector vector(1024), -- Cohere embed-english-v3.0 produces 1024-dimensional vectors
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS embeddings_kb_id_idx ON embeddings (kb_id);
CREATE INDEX IF NOT EXISTS embeddings_chunk_index_idx ON embeddings (chunk_index);

-- Create vector similarity index using HNSW (Hierarchical Navigable Small World)
-- This is optimized for cosine distance which works well with Cohere embeddings
CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON embeddings 
USING hnsw (vector vector_cosine_ops);

-- Add RLS policies
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to select embeddings for their own knowledge base entries
CREATE POLICY embeddings_select_policy ON embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledgebase kb 
      WHERE kb.id = embeddings.kb_id 
      AND kb.user_id = auth.uid()
    )
  );

-- Policy to allow users to insert embeddings for their own knowledge base entries
CREATE POLICY embeddings_insert_policy ON embeddings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledgebase kb 
      WHERE kb.id = embeddings.kb_id 
      AND kb.user_id = auth.uid()
    )
  );

-- Policy to allow users to update embeddings for their own knowledge base entries
CREATE POLICY embeddings_update_policy ON embeddings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM knowledgebase kb 
      WHERE kb.id = embeddings.kb_id 
      AND kb.user_id = auth.uid()
    )
  );

-- Policy to allow users to delete embeddings for their own knowledge base entries
CREATE POLICY embeddings_delete_policy ON embeddings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM knowledgebase kb 
      WHERE kb.id = embeddings.kb_id 
      AND kb.user_id = auth.uid()
    )
  );

-- Create or replace the match_embeddings function for Cohere embeddings
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  kb_id uuid,
  chunk_text text,
  chunk_index int,
  similarity float,
  title text,
  category text,
  source_url text,
  source_type text
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
    1 - (e.vector <=> query_embedding) AS similarity,
    kb.title,
    kb.category,
    kb.source_ref AS source_url,
    kb.source_type
  FROM
    embeddings e
  JOIN
    knowledgebase kb ON e.kb_id = kb.id
  WHERE
    e.vector IS NOT NULL
    AND 1 - (e.vector <=> query_embedding) > match_threshold
    AND kb.user_id = auth.uid()
  ORDER BY
    e.vector <=> query_embedding
  LIMIT match_count;
END;
$$;
