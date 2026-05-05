-- ── Automations ──────────────────────────────────────────────────────────────
-- Stores user-defined IF-THEN rules that run whenever KB content is added.

CREATE TABLE IF NOT EXISTS automations (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  enabled         BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Trigger: what event fires this rule
  trigger_type    TEXT         NOT NULL
    CHECK (trigger_type IN ('url_added','pdf_added','rss_article','any_added','category_match','keyword_match')),
  trigger_config  JSONB        NOT NULL DEFAULT '{}',
  -- trigger_config examples:
  --   category_match: { "category": "Artificial Intelligence" }
  --   keyword_match:  { "keyword": "machine learning" }

  -- Action: what to do when triggered
  action_type     TEXT         NOT NULL
    CHECK (action_type IN ('generate_flashcards','create_concept_map','notify','generate_flashcards_and_notify')),
  action_config   JSONB        NOT NULL DEFAULT '{}',

  last_run_at     TIMESTAMPTZ,
  run_count       INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_user_id
  ON automations (user_id);

CREATE INDEX IF NOT EXISTS idx_automations_user_enabled
  ON automations (user_id, enabled)
  WHERE enabled = TRUE;

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY automations_owner_all
  ON automations FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Automation run log ────────────────────────────────────────────────────────
-- Records every automation execution — success, failure, and generated content.

CREATE TABLE IF NOT EXISTS automation_runs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID         NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_kb_id   UUID         REFERENCES knowledgebase(id) ON DELETE SET NULL,
  trigger_title   TEXT,
  action_type     TEXT         NOT NULL,
  status          TEXT         NOT NULL DEFAULT 'done'
    CHECK (status IN ('done','error')),
  result          JSONB,       -- generated content (flashcards, concept map JSON)
  error           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_user_id
  ON automation_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id
  ON automation_runs (automation_id);

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_runs_owner_read
  ON automation_runs FOR SELECT
  USING (auth.uid() = user_id);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_automations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE TRIGGER automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_automations_updated_at();
