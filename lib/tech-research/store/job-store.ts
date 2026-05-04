import { createClient } from "@supabase/supabase-js";
import type {
  TechResearchJob,
  TechJobSummary,
} from "@/types/tech-research";
import type { AgentState } from "@/types/research";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toRow(job: TechResearchJob) {
  return {
    id: job.id,
    user_id: job.user_id,
    status: job.status,
    config: job.config,
    agents: job.agents,
    requirement_analysis: job.requirement_analysis ?? null,
    solution_landscape: job.solution_landscape ?? null,
    evaluations: job.evaluations ?? null,
    tradeoff_matrix: job.tradeoff_matrix ?? null,
    report: job.report ?? null,
    error: job.error ?? null,
    created_at: job.created_at,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: Record<string, unknown>): TechResearchJob {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    status: row.status as TechResearchJob["status"],
    config: row.config as TechResearchJob["config"],
    agents: (row.agents as AgentState[]) ?? [],
    requirement_analysis: row.requirement_analysis as TechResearchJob["requirement_analysis"],
    solution_landscape: row.solution_landscape as TechResearchJob["solution_landscape"],
    evaluations: row.evaluations as TechResearchJob["evaluations"],
    tradeoff_matrix: row.tradeoff_matrix as TechResearchJob["tradeoff_matrix"],
    report: row.report as TechResearchJob["report"],
    error: row.error as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function fromRowSummary(row: Record<string, unknown>): TechJobSummary {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    status: row.status as TechResearchJob["status"],
    config: row.config as TechResearchJob["config"],
    agents: (row.agents as AgentState[]) ?? [],
    error: row.error as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// Cached per process startup — the table either exists or it doesn't mid-run
let _tableReady: boolean | null = null;

/** Reset the table-ready cache — used in tests only */
export function resetTableReadyCache() {
  _tableReady = null;
}

async function assertTableExists(): Promise<void> {
  if (_tableReady === true) return;

  const { error } = await getAdmin()
    .from("tech_research_jobs")
    .select("id")
    .limit(1);

  if (error?.code === "42P01") {
    throw new Error(
      'The tech_research_jobs table does not exist. ' +
      'Run: node scripts/create-tech-research-table.js — ' +
      'or paste migrations/tech_research_jobs.sql into the Supabase SQL Editor.'
    );
  }

  if (error && error.code !== "PGRST116") {
    // PGRST116 = "no rows" — table exists but empty, that's fine
    console.error("[techJobStore] table check error:", error.code, error.message);
  }

  _tableReady = true;
}

export const techJobStore = {
  async set(id: string, job: TechResearchJob): Promise<void> {
    await assertTableExists();
    const { error } = await getAdmin()
      .from("tech_research_jobs")
      .upsert(toRow(job));
    if (error) throw new Error(`techJobStore.set failed: ${error.message}`);
  },

  async get(id: string): Promise<TechResearchJob | undefined> {
    const { data, error } = await getAdmin()
      .from("tech_research_jobs")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return fromRow(data as Record<string, unknown>);
  },

  async update(id: string, updates: Partial<TechResearchJob>): Promise<void> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if ("status" in updates) patch.status = updates.status;
    if ("agents" in updates) patch.agents = updates.agents;
    if ("requirement_analysis" in updates)
      patch.requirement_analysis = updates.requirement_analysis ?? null;
    if ("solution_landscape" in updates)
      patch.solution_landscape = updates.solution_landscape ?? null;
    if ("evaluations" in updates) patch.evaluations = updates.evaluations ?? null;
    if ("tradeoff_matrix" in updates)
      patch.tradeoff_matrix = updates.tradeoff_matrix ?? null;
    if ("report" in updates) patch.report = updates.report ?? null;
    if ("error" in updates) patch.error = updates.error ?? null;

    const { error } = await getAdmin()
      .from("tech_research_jobs")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(`techJobStore.update failed: ${error.message}`);
  },

  async updateAgent(
    jobId: string,
    agentId: string,
    agentUpdates: Partial<AgentState>
  ): Promise<void> {
    const job = await this.get(jobId);
    if (!job) return;
    const agents = job.agents.map((a) =>
      a.id === agentId ? { ...a, ...agentUpdates } : a
    );
    await this.update(jobId, { agents });
  },

  async countRunning(): Promise<number> {
    const { count } = await getAdmin()
      .from("tech_research_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["running", "queued"]);
    return count ?? 0;
  },

  async list(
    userId: string,
    options?: {
      status?: TechResearchJob["status"];
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ jobs: TechJobSummary[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    let query = getAdmin()
      .from("tech_research_jobs")
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
      query = query.ilike("config->>requirement", `%${options.search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`techJobStore.list failed: ${error.message}`);

    return {
      jobs: (data ?? []).map((r) => fromRowSummary(r as Record<string, unknown>)),
      total: count ?? 0,
    };
  },

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await getAdmin()
      .from("tech_research_jobs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(`techJobStore.delete failed: ${error.message}`);
  },
};
