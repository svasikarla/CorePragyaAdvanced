-- Migration: Add trending feed support columns to knowledgebase
-- These columns power the AI-ranked trending news feed (FR-06, FR-11, FR-14, FR-22)

ALTER TABLE knowledgebase ADD COLUMN IF NOT EXISTS relevance_score FLOAT DEFAULT NULL;
ALTER TABLE knowledgebase ADD COLUMN IF NOT EXISTS relevance_snippet TEXT DEFAULT NULL;
ALTER TABLE knowledgebase ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE knowledgebase ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT NULL;
ALTER TABLE knowledgebase ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT FALSE;

-- Composite index for trending feed queries (user + not dismissed + ranked)
CREATE INDEX IF NOT EXISTS kb_trending_feed_idx
  ON knowledgebase (user_id, is_dismissed, relevance_score DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS kb_published_at_idx
  ON knowledgebase (published_at DESC NULLS LAST);
