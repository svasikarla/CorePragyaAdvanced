/**
 * Supabase-backed job store for research jobs.
 *
 * Uses the service role key to bypass RLS for server-side operations.
 * All public read access is governed by the RLS policy on research_jobs:
 *   users may only see their own jobs.
 */

import { createClient } from "@supabase/supabase-js";
import type { ResearchJob, AgentState } from "@/types/research";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function toRow(job: ResearchJob) {
  return {
    id: job.id,
    user_id: job.user_id,
    status: job.status,
    config: job.config,
    agents: job.agents,
    evidence_package: job.evidence_package ?? null,
    report: job.report ?? null,
    error: job.error ?? null,
    created_at: job.created_at,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: Record<string, unknown>): ResearchJob {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    status: row.status as ResearchJob["status"],
    config: row.config as ResearchJob["config"],
    agents: (row.agents as AgentState[]) ?? [],
    evidence_package: row.evidence_package as ResearchJob["evidence_package"],
    report: row.report as ResearchJob["report"],
    error: row.error as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export const jobStore = {
  async set(id: string, job: ResearchJob): Promise<void> {
    const { error } = await getAdmin()
      .from("research_jobs")
      .upsert(toRow(job));
    if (error) throw new Error(`jobStore.set failed: ${error.message}`);
  },

  async get(id: string): Promise<ResearchJob | undefined> {
    const { data, error } = await getAdmin()
      .from("research_jobs")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return fromRow(data as Record<string, unknown>);
  },

  async update(id: string, updates: Partial<ResearchJob>): Promise<void> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if ("status" in updates) patch.status = updates.status;
    if ("agents" in updates) patch.agents = updates.agents;
    if ("evidence_package" in updates)
      patch.evidence_package = updates.evidence_package ?? null;
    if ("report" in updates) patch.report = updates.report ?? null;
    if ("error" in updates) patch.error = updates.error ?? null;

    const { error } = await getAdmin()
      .from("research_jobs")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(`jobStore.update failed: ${error.message}`);
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
      .from("research_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["running", "queued"]);
    return count ?? 0;
  },
};
