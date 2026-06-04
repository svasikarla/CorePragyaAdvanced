-- Closed-loop knowledge: provenance for agent outputs written back into the KB.
-- Run this in the Supabase SQL editor before enabling "Save results to Knowledge Base".

-- 1. Provenance columns (nullable → normal human-sourced entries leave these NULL).
ALTER TABLE knowledgebase ADD COLUMN IF NOT EXISTS origin_feature TEXT;       -- 'research' | 'tech_research' | 'mvp_docs' | 'content'
ALTER TABLE knowledgebase ADD COLUMN IF NOT EXISTS origin_job_id TEXT;        -- the source job id
ALTER TABLE knowledgebase ADD COLUMN IF NOT EXISTS origin_artifact_key TEXT;  -- e.g. 'report', a docType, or a platform

-- 2. Idempotency: at most one KB entry per (user, job, artifact) so re-runs UPDATE in place.
CREATE UNIQUE INDEX IF NOT EXISTS knowledgebase_provenance_uidx
  ON knowledgebase (user_id, origin_job_id, origin_artifact_key)
  WHERE origin_job_id IS NOT NULL;

-- 3. Echo-guard helper: fast filter to include/exclude agent-origin entries.
CREATE INDEX IF NOT EXISTS knowledgebase_origin_feature_idx ON knowledgebase (origin_feature);

-- 4. Allow agent-origin source_type values. NOT VALID skips re-validating existing rows
--    (existing url/pdf/email/rss values are already in the allowed set anyway).
ALTER TABLE knowledgebase DROP CONSTRAINT IF EXISTS knowledgebase_source_type_check;
ALTER TABLE knowledgebase ADD CONSTRAINT knowledgebase_source_type_check
  CHECK (source_type IN (
    'url', 'pdf', 'email', 'rss', 'note', 'manual',
    'research', 'tech_research', 'mvp_docs', 'content'
  )) NOT VALID;
