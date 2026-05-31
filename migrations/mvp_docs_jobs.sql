-- MVP Documentation Jobs table
-- Run this migration in your Supabase SQL editor before using the MVP Docs feature.

CREATE TABLE IF NOT EXISTS mvp_docs_jobs (
  id                  TEXT         PRIMARY KEY,
  user_id             UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status              TEXT         NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'running', 'done', 'error')),
  config              JSONB        NOT NULL,
  agents              JSONB        NOT NULL DEFAULT '[]',
  brief_analysis      JSONB,
  documents           JSONB,
  consistency_report  JSONB,
  error               TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_mvp_docs_jobs_user_id
  ON mvp_docs_jobs (user_id);

CREATE INDEX IF NOT EXISTS idx_mvp_docs_jobs_status
  ON mvp_docs_jobs (status);

CREATE INDEX IF NOT EXISTS idx_mvp_docs_jobs_updated
  ON mvp_docs_jobs (updated_at DESC);

-- Row Level Security
ALTER TABLE mvp_docs_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY mvp_docs_jobs_owner_all
  ON mvp_docs_jobs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_mvp_docs_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mvp_docs_jobs_updated_at
  BEFORE UPDATE ON mvp_docs_jobs
  FOR EACH ROW EXECUTE FUNCTION update_mvp_docs_jobs_updated_at();
