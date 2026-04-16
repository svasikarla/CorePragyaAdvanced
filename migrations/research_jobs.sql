-- ── Research Jobs Table ───────────────────────────────────────────────────────
-- Run this migration in your Supabase SQL editor or via the Supabase CLI.
--
-- After applying:
--   1. Add TAVILY_API_KEY to your .env.local
--   2. Add MAX_CONCURRENT_RESEARCH_JOBS=5 (optional, defaults to 5)
--   3. Restart the dev server

CREATE TABLE IF NOT EXISTS research_jobs (
  id              TEXT         PRIMARY KEY,
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT         NOT NULL DEFAULT 'queued',
  config          JSONB        NOT NULL,
  agents          JSONB        NOT NULL DEFAULT '[]',
  evidence_package JSONB,
  report          JSONB,
  error           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_research_jobs_user_id  ON research_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_research_jobs_status   ON research_jobs (status);
CREATE INDEX IF NOT EXISTS idx_research_jobs_updated  ON research_jobs (updated_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own jobs
CREATE POLICY "research_jobs_owner_all"
  ON research_jobs
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role key bypasses RLS automatically (used by job-store.ts server-side).

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_research_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER research_jobs_updated_at
  BEFORE UPDATE ON research_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_research_jobs_updated_at();

-- ── Optional: Cleanup old completed jobs after 30 days ────────────────────────
-- Uncomment if you want automatic cleanup via pg_cron or a scheduled function.
--
-- SELECT cron.schedule(
--   'cleanup_old_research_jobs',
--   '0 3 * * *',
--   $$DELETE FROM research_jobs
--     WHERE status IN ('done', 'error')
--       AND updated_at < NOW() - INTERVAL '30 days'$$
-- );
