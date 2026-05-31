import { createClient } from "@supabase/supabase-js";
import type { MvpDocsJob, MvpDocsJobSummary } from "@/types/mvp-docs";
import type { AgentState } from "@/types/research";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toRow(job: MvpDocsJob) {
  return {
    id: job.id,
    user_id: job.user_id,
    status: job.status,
    config: job.config,
    agents: job.agents,
    brief_analysis: job.brief_analysis ?? null,
    documents: job.documents ?? null,
    consistency_report: job.consistency_report ?? null,
    error: job.error ?? null,
    created_at: job.created_at,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: Record<string, unknown>): MvpDocsJob {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    status: row.status as MvpDocsJob["status"],
    config: row.config as MvpDocsJob["config"],
    agents: (row.agents as AgentState[]) ?? [],
    brief_analysis: row.brief_analysis as MvpDocsJob["brief_analysis"],
    documents: row.documents as MvpDocsJob["documents"],
    consistency_report: row.consistency_report as MvpDocsJob["consistency_report"],
    error: row.error as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function fromRowSummary(row: Record<string, unknown>): MvpDocsJobSummary {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    status: row.status as MvpDocsJob["status"],
    config: row.config as MvpDocsJob["config"],
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
    .from("mvp_docs_jobs")
    .select("id")
    .limit(1);

  if (error?.code === "42P01") {
    throw new Error(
      "The mvp_docs_jobs table does not exist. " +
      "Paste migrations/mvp_docs_jobs.sql into the Supabase SQL Editor."
    );
  }

  if (error && error.code !== "PGRST116") {
    console.error("[mvpDocsJobStore] table check error:", error.code, error.message);
  }

  _tableReady = true;
}

export const mvpDocsJobStore = {
  async set(id: string, job: MvpDocsJob): Promise<void> {
    await assertTableExists();
    const { error } = await getAdmin()
      .from("mvp_docs_jobs")
      .upsert(toRow(job));
    if (error) throw new Error(`mvpDocsJobStore.set failed: ${error.message}`);
  },

  async get(id: string): Promise<MvpDocsJob | undefined> {
    const { data, error } = await getAdmin()
      .from("mvp_docs_jobs")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return fromRow(data as Record<string, unknown>);
  },

  async update(id: string, updates: Partial<MvpDocsJob>): Promise<void> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if ("status" in updates) patch.status = updates.status;
    if ("agents" in updates) patch.agents = updates.agents;
    if ("brief_analysis" in updates) patch.brief_analysis = updates.brief_analysis ?? null;
    if ("documents" in updates) patch.documents = updates.documents ?? null;
    if ("consistency_report" in updates) patch.consistency_report = updates.consistency_report ?? null;
    if ("error" in updates) patch.error = updates.error ?? null;

    const { error } = await getAdmin()
      .from("mvp_docs_jobs")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(`mvpDocsJobStore.update failed: ${error.message}`);
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
      .from("mvp_docs_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["running", "queued"]);
    return count ?? 0;
  },

  async list(
    userId: string,
    options?: {
      status?: MvpDocsJob["status"];
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ jobs: MvpDocsJobSummary[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    let query = getAdmin()
      .from("mvp_docs_jobs")
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
      query = query.ilike("config->>productName", `%${options.search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`mvpDocsJobStore.list failed: ${error.message}`);

    return {
      jobs: (data ?? []).map((r) => fromRowSummary(r as Record<string, unknown>)),
      total: count ?? 0,
    };
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await getAdmin()
      .from("mvp_docs_jobs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(`mvpDocsJobStore.delete failed: ${error.message}`);
  },
};
