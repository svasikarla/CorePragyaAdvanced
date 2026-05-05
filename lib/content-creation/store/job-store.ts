import { createClient } from "@supabase/supabase-js";
import type { ContentCreationJob, ContentJobSummary } from "@/types/content-creation";
import type { AgentState } from "@/types/research";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toRow(job: ContentCreationJob) {
  return {
    id: job.id,
    user_id: job.user_id,
    status: job.status,
    config: job.config,
    agents: job.agents,
    topic_analysis: job.topic_analysis ?? null,
    research: job.research ?? null,
    outline: job.outline ?? null,
    content_pieces: job.content_pieces ?? null,
    error: job.error ?? null,
    created_at: job.created_at,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: Record<string, unknown>): ContentCreationJob {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    status: row.status as ContentCreationJob["status"],
    config: row.config as ContentCreationJob["config"],
    agents: (row.agents as AgentState[]) ?? [],
    topic_analysis: row.topic_analysis as ContentCreationJob["topic_analysis"],
    research: row.research as ContentCreationJob["research"],
    outline: row.outline as ContentCreationJob["outline"],
    content_pieces: row.content_pieces as ContentCreationJob["content_pieces"],
    error: row.error as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function fromRowSummary(row: Record<string, unknown>): ContentJobSummary {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    status: row.status as ContentCreationJob["status"],
    config: row.config as ContentCreationJob["config"],
    agents: (row.agents as AgentState[]) ?? [],
    error: row.error as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

let _tableReady: boolean | null = null;

export function resetTableReadyCache() {
  _tableReady = null;
}

async function assertTableExists(): Promise<void> {
  if (_tableReady === true) return;

  const { error } = await getAdmin()
    .from("content_creation_jobs")
    .select("id")
    .limit(1);

  if (error?.code === "42P01") {
    throw new Error(
      "The content_creation_jobs table does not exist. " +
      "Paste migrations/content_creation_jobs.sql into the Supabase SQL Editor."
    );
  }

  if (error && error.code !== "PGRST116") {
    console.error("[contentJobStore] table check error:", error.code, error.message);
  }

  _tableReady = true;
}

export const contentJobStore = {
  async set(id: string, job: ContentCreationJob): Promise<void> {
    await assertTableExists();
    const { error } = await getAdmin()
      .from("content_creation_jobs")
      .upsert(toRow(job));
    if (error) throw new Error(`contentJobStore.set failed: ${error.message}`);
  },

  async get(id: string): Promise<ContentCreationJob | undefined> {
    const { data, error } = await getAdmin()
      .from("content_creation_jobs")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return fromRow(data as Record<string, unknown>);
  },

  async update(id: string, updates: Partial<ContentCreationJob>): Promise<void> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if ("status" in updates) patch.status = updates.status;
    if ("agents" in updates) patch.agents = updates.agents;
    if ("topic_analysis" in updates) patch.topic_analysis = updates.topic_analysis ?? null;
    if ("research" in updates) patch.research = updates.research ?? null;
    if ("outline" in updates) patch.outline = updates.outline ?? null;
    if ("content_pieces" in updates) patch.content_pieces = updates.content_pieces ?? null;
    if ("error" in updates) patch.error = updates.error ?? null;

    const { error } = await getAdmin()
      .from("content_creation_jobs")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(`contentJobStore.update failed: ${error.message}`);
  },

  async updateAgent(jobId: string, agentId: string, agentUpdates: Partial<AgentState>): Promise<void> {
    const job = await this.get(jobId);
    if (!job) return;
    const agents = job.agents.map((a) =>
      a.id === agentId ? { ...a, ...agentUpdates } : a
    );
    await this.update(jobId, { agents });
  },

  async countRunning(): Promise<number> {
    const { count } = await getAdmin()
      .from("content_creation_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["running", "queued"]);
    return count ?? 0;
  },

  async list(
    userId: string,
    options?: {
      status?: ContentCreationJob["status"];
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ jobs: ContentJobSummary[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    let query = getAdmin()
      .from("content_creation_jobs")
      .select(
        "id, user_id, status, config, agents, error, created_at, updated_at",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.search) {
      query = query.ilike("config->>topic", `%${options.search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`contentJobStore.list failed: ${error.message}`);

    return {
      jobs: (data ?? []).map((r) => fromRowSummary(r as Record<string, unknown>)),
      total: count ?? 0,
    };
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await getAdmin()
      .from("content_creation_jobs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(`contentJobStore.delete failed: ${error.message}`);
  },
};
