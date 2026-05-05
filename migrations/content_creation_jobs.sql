-- Content Creation Jobs table
-- Run this migration in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS content_creation_jobs (
  id                TEXT         PRIMARY KEY,
  user_id           UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT         NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'running', 'done', 'error')),
  config            JSONB        NOT NULL,
  agents            JSONB        NOT NULL DEFAULT '[]',
  topic_analysis    JSONB,
  research          JSONB,
  outline           JSONB,
  content_pieces    JSONB,
  error             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_content_creation_jobs_user_id
  ON content_creation_jobs (user_id);

CREATE INDEX IF NOT EXISTS idx_content_creation_jobs_status
  ON content_creation_jobs (status);

CREATE INDEX IF NOT EXISTS idx_content_creation_jobs_updated
  ON content_creation_jobs (updated_at DESC);

-- Row Level Security
ALTER TABLE content_creation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_creation_jobs_owner_all
  ON content_creation_jobs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_content_creation_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_creation_jobs_updated_at
  BEFORE UPDATE ON content_creation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_content_creation_jobs_updated_at();
