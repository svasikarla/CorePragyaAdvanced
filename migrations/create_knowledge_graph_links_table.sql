-- Create knowledge_graph_links table to store relationships between knowledge base entries
CREATE TABLE IF NOT EXISTS knowledge_graph_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_kb_id UUID NOT NULL REFERENCES knowledgebase(id) ON DELETE CASCADE,
  target_kb_id UUID NOT NULL REFERENCES knowledgebase(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'auto', -- 'auto', 'manual', 'bidirectional'
  link_strength REAL DEFAULT 1.0, -- 0.0 to 1.0 (connection strength)
  shared_keywords TEXT[], -- Array of keywords that connect the entries
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique links between entries
  CONSTRAINT unique_link UNIQUE(user_id, source_kb_id, target_kb_id),

  -- Ensure source and target are different
  CONSTRAINT different_nodes CHECK (source_kb_id != target_kb_id),

  -- Ensure link_strength is between 0 and 1
  CONSTRAINT valid_strength CHECK (link_strength >= 0.0 AND link_strength <= 1.0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS kg_links_user_id_idx ON knowledge_graph_links(user_id);
CREATE INDEX IF NOT EXISTS kg_links_source_idx ON knowledge_graph_links(source_kb_id);
CREATE INDEX IF NOT EXISTS kg_links_target_idx ON knowledge_graph_links(target_kb_id);
CREATE INDEX IF NOT EXISTS kg_links_strength_idx ON knowledge_graph_links(link_strength DESC);
CREATE INDEX IF NOT EXISTS kg_links_type_idx ON knowledge_graph_links(link_type);

-- Create composite index for efficient bidirectional queries
CREATE INDEX IF NOT EXISTS kg_links_nodes_idx ON knowledge_graph_links(source_kb_id, target_kb_id);

-- Enable Row Level Security
ALTER TABLE knowledge_graph_links ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only select their own links
CREATE POLICY kg_links_select_policy ON knowledge_graph_links
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only insert their own links
CREATE POLICY kg_links_insert_policy ON knowledge_graph_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only update their own links
CREATE POLICY kg_links_update_policy ON knowledge_graph_links
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own links
CREATE POLICY kg_links_delete_policy ON knowledge_graph_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_kg_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_kg_links_updated_at_trigger
  BEFORE UPDATE ON knowledge_graph_links
  FOR EACH ROW
  EXECUTE FUNCTION update_kg_links_updated_at();

-- Add a helpful comment
COMMENT ON TABLE knowledge_graph_links IS 'Stores relationships between knowledge base entries for graph visualization';
