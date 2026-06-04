/**
 * Supabase-backed history store for the prompt refiner.
 *
 * Uses the service role key for server-side operations. Per-user isolation is
 * enforced both here (explicit user_id filters) and by RLS on the table.
 */

import { createClient } from "@supabase/supabase-js";
import type {
  PromptRefinerHistoryEntry,
  RefineContext,
  RefinedVariant,
} from "@/types/prompt-refiner";

const TABLE = "prompt_refiner_history";
const MAX_LIMIT = 100;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function fromRow(row: Record<string, unknown>): PromptRefinerHistoryEntry {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    original_prompt: row.original_prompt as string,
    context: (row.context as RefineContext) ?? {},
    variants: (row.variants as RefinedVariant[]) ?? [],
    model: (row.model as string) ?? null,
    created_at: row.created_at as string,
  };
}

export interface CreateHistoryInput {
  userId: string;
  originalPrompt: string;
  context: RefineContext;
  variants: RefinedVariant[];
  model: string | null;
}

export const historyStore = {
  async create(input: CreateHistoryInput): Promise<PromptRefinerHistoryEntry> {
    const admin = getAdmin();
    const id = `pr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const row = {
      id,
      user_id: input.userId,
      original_prompt: input.originalPrompt,
      context: input.context,
      variants: input.variants,
      model: input.model,
    };

    const { data, error } = await admin.from(TABLE).insert(row).select().single();
    if (error) throw new Error(`Failed to save refinement: ${error.message}`);
    return fromRow(data);
  },

  async list(
    userId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<{ entries: PromptRefinerHistoryEntry[]; total: number }> {
    const admin = getAdmin();
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), MAX_LIMIT);
    const offset = Math.max(opts.offset ?? 0, 0);

    const { data, error, count } = await admin
      .from(TABLE)
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to load history: ${error.message}`);
    return {
      entries: (data ?? []).map(fromRow),
      total: count ?? 0,
    };
  },

  async delete(userId: string, id: string): Promise<void> {
    const admin = getAdmin();
    const { error } = await admin
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(`Failed to delete entry: ${error.message}`);
  },

  async clear(userId: string): Promise<void> {
    const admin = getAdmin();
    const { error } = await admin.from(TABLE).delete().eq("user_id", userId);
    if (error) throw new Error(`Failed to clear history: ${error.message}`);
  },
};
