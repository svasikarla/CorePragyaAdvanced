-- Add is_bookmarked column to knowledgebase table
ALTER TABLE knowledgebase
  ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_knowledgebase_bookmarked
  ON knowledgebase (user_id, is_bookmarked)
  WHERE is_bookmarked = TRUE;
