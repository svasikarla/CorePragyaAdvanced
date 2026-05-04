-- Tech Research Jobs table
-- Run this migration in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS tech_research_jobs (
  id                   TEXT         PRIMARY KEY,
  user_id              UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status               TEXT         NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'running', 'done', 'error')),
  config               JSONB        NOT NULL,
  agents               JSONB        NOT NULL DEFAULT '[]',
  requirement_analysis JSONB,
  solution_landscape   JSONB,
  evaluations          JSONB,
  tradeoff_matrix      JSONB,
  report               JSONB,
  error                TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tech_research_jobs_user_id
  ON tech_research_jobs (user_id);

CREATE INDEX IF NOT EXISTS idx_tech_research_jobs_status
  ON tech_research_jobs (status);

CREATE INDEX IF NOT EXISTS idx_tech_research_jobs_updated
  ON tech_research_jobs (updated_at DESC);

-- Row Level Security
ALTER TABLE tech_research_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own jobs
CREATE POLICY tech_research_jobs_owner_all
  ON tech_research_jobs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_tech_research_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tech_research_jobs_updated_at
  BEFORE UPDATE ON tech_research_jobs
  FOR EACH ROW EXECUTE FUNCTION update_tech_research_jobs_updated_at();
