// ── Prompt Refiner types ──────────────────────────────────────────────────────

/** Optional hints the user can supply to steer the refinement. */
export interface RefineContext {
  /** Who the model should act as (e.g. "senior React engineer"). */
  role?: string;
  /** Desired output format (e.g. "markdown table", "JSON", "step-by-step"). */
  outputFormat?: string;
  /** Free-text notes about audience, tone, or goal. */
  audience?: string;
  /** Target model the refined prompt is meant for (e.g. "Claude", "GPT-4"). */
  targetModel?: string;
}

/** A single refined prompt variant returned by the model. */
export interface RefinedVariant {
  /** Short label describing the angle of this variant. */
  title: string;
  /** The full, ready-to-use refined prompt. */
  prompt: string;
  /** Prompt-engineering techniques applied in this variant. */
  techniques: string[];
  /** Why this variant is structured the way it is. */
  rationale: string;
}

/** A persisted refinement record. */
export interface PromptRefinerHistoryEntry {
  id: string;
  user_id: string;
  original_prompt: string;
  context: RefineContext;
  variants: RefinedVariant[];
  model: string | null;
  created_at: string;
}

/** POST /api/prompt-refiner request body. */
export interface RefineRequest {
  prompt: string;
  context?: RefineContext;
}

/** POST /api/prompt-refiner response body. */
export interface RefineResponse {
  id: string;
  variants: RefinedVariant[];
}
