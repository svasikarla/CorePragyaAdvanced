-- Migration: Create learning_progress table
-- Tracks per-user, per-entry learning activity for AI Learning features

CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entry_id UUID NOT NULL REFERENCES knowledgebase(id) ON DELETE CASCADE,
  flashcards_generated BOOLEAN DEFAULT FALSE,
  concept_map_created BOOLEAN DEFAULT FALSE,
  questions_asked INTEGER DEFAULT 0,
  completion_percentage INTEGER DEFAULT 0,
  last_studied TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, entry_id)
);

-- RLS policies
ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY learning_progress_select ON learning_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY learning_progress_insert ON learning_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY learning_progress_update ON learning_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY learning_progress_delete ON learning_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS learning_progress_user_idx ON learning_progress (user_id);
