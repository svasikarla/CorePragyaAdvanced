-- ── Prompt Refiner History Table ─────────────────────────────────────────────
-- Stores each prompt-refinement request a user makes, along with the two
-- refined variants returned by the model. Run this migration in your Supabase
-- SQL editor (or via the Supabase CLI) before using /prompt-refiner.

CREATE TABLE IF NOT EXISTS prompt_refiner_history (
  id              TEXT         PRIMARY KEY,
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_prompt TEXT         NOT NULL,
  -- Optional user-supplied hints that shaped the refinement.
  context         JSONB        NOT NULL DEFAULT '{}',
  -- Array of refined variants: [{ title, prompt, techniques, rationale }, ...]
  variants        JSONB        NOT NULL DEFAULT '[]',
  model           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_prompt_refiner_history_user_id ON prompt_refiner_history (user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_refiner_history_created ON prompt_refiner_history (created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE prompt_refiner_history ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own history.
CREATE POLICY "prompt_refiner_history_owner_all"
  ON prompt_refiner_history
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role key bypasses RLS automatically (used by the API routes server-side).
