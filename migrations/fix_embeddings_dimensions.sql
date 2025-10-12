-- Fix embeddings table to use Cohere dimensions (1024) instead of OpenAI (1536)
-- This migration will recreate the embeddings table with the correct vector dimensions

-- Enable the vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing policies and indexes first
DROP POLICY IF EXISTS embeddings_select_policy ON embeddings;
DROP POLICY IF EXISTS embeddings_insert_policy ON embeddings;
DROP POLICY IF EXISTS embeddings_update_policy ON embeddings;
DROP POLICY IF EXISTS embeddings_delete_policy ON embeddings;

DROP INDEX IF EXISTS embeddings_vector_idx;
DROP INDEX IF EXISTS embeddings_kb_id_idx;
DROP INDEX IF EXISTS embeddings_chunk_index_idx;

-- Drop the existing match_embeddings function
DROP FUNCTION IF EXISTS match_embeddings(vector, float, int);

-- Backup existing data (if any) and drop the table
DROP TABLE IF EXISTS embeddings_backup;
CREATE TABLE embeddings_backup AS SELECT * FROM embeddings WHERE vector IS NULL;

-- Drop and recreate the embeddings table with correct dimensions
DROP TABLE IF EXISTS embeddings;

-- Create embeddings table with Cohere dimensions (1024)
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id UUID NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  vector vector(1024), -- Cohere embed-english-v3.0 produces 1024-dimensional vectors
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Restore data without vectors (vectors will be regenerated)
INSERT INTO embeddings (id, kb_id, chunk_text, chunk_index, created_at, updated_at)
SELECT id, kb_id, chunk_text, chunk_index, created_at, updated_at 
FROM embeddings_backup;

-- Clean up backup table
DROP TABLE IF EXISTS embeddings_backup;

-- Add indexes for performance
CREATE INDEX embeddings_kb_id_idx ON embeddings (kb_id);
CREATE INDEX embeddings_chunk_index_idx ON embeddings (chunk_index);

-- Create vector similarity index using HNSW (Hierarchical Navigable Small World)
-- This is optimized for cosine distance which works well with Cohere embeddings
CREATE INDEX embeddings_vector_idx ON embeddings 
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
