import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const {
  mockUpsert,
  mockSelect,
  mockEq,
  mockSingle,
  mockLimit,
  mockUpdate,
  mockDelete,
  mockIn,
  mockCount,
} = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockLimit: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockIn: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      upsert: mockUpsert,
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
    }),
  }),
}));

import { techJobStore, resetTableReadyCache } from "@/lib/tech-research/store/job-store";
import type { TechResearchJob } from "@/types/tech-research";

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<TechResearchJob> = {}): TechResearchJob {
  return {
    id: "job-1",
    user_id: "user-abc",
    status: "queued",
    config: {
      requirement: "Need real-time sync",
      current_stack: "Next.js",
      constraints: "",
      criteria: { performance: 3, developer_experience: 3, maturity: 3, cost: 3, security: 3 },
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      depth: "tier1",
      format: "md",
      focus_area: "general",
    },
    agents: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("techJobStore.set", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // assertTableExists uses .select("id").limit(1) — mock returns no error (table exists)
    mockLimit.mockResolvedValue({ error: null });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, limit: mockLimit });
  });

  it("upserts the job to tech_research_jobs", async () => {
    mockUpsert.mockResolvedValue({ error: null });
    await techJobStore.set("job-1", makeJob());
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "job-1", user_id: "user-abc", status: "queued" })
    );
  });

  it("throws when supabase returns an error on upsert", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "relation does not exist", code: "42P01" } });
    await expect(techJobStore.set("job-1", makeJob())).rejects.toThrow(
      "techJobStore.set failed: relation does not exist"
    );
  });

  it("throws with clear message when table does not exist (assertTableExists)", async () => {
    resetTableReadyCache(); // clear process-level cache so assertTableExists runs
    mockLimit.mockResolvedValueOnce({ error: { code: "42P01", message: "relation does not exist" } });
    await expect(techJobStore.set("job-1", makeJob())).rejects.toThrow(
      "tech_research_jobs table does not exist"
    );
  });
});

describe("techJobStore.get", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns undefined when job not found", async () => {
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockSingle.mockResolvedValue({ data: null, error: { message: "No rows" } });
    const result = await techJobStore.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("returns a parsed job when found", async () => {
    const row = {
      id: "job-1", user_id: "user-abc", status: "running",
      config: makeJob().config, agents: [],
      requirement_analysis: null, solution_landscape: null,
      evaluations: null, tradeoff_matrix: null, report: null, error: null,
      created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
    };
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockSingle.mockResolvedValue({ data: row, error: null });
    const result = await techJobStore.get("job-1");
    expect(result?.id).toBe("job-1");
    expect(result?.status).toBe("running");
  });
});

describe("techJobStore.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("patches only the specified fields", async () => {
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
    await techJobStore.update("job-1", { status: "done" });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done" })
    );
    // Should not include unset fields like 'report'
    const call = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("agents");
  });

  it("throws when update fails", async () => {
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: { message: "DB error" } });
    await expect(techJobStore.update("job-1", { status: "error" })).rejects.toThrow(
      "techJobStore.update failed: DB error"
    );
  });

  it("always sets updated_at", async () => {
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
    await techJobStore.update("job-1", { status: "running" });
    const patch = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch).toHaveProperty("updated_at");
    expect(typeof patch.updated_at).toBe("string");
  });
});

describe("techJobStore.delete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes by id AND user_id (enforces ownership)", async () => {
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValueOnce({ error: null }); // final .eq resolves
    // Build a proper chain
    const eqChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
    const firstEq = vi.fn().mockReturnValue(eqChain);
    mockDelete.mockReturnValue({ eq: firstEq });

    await techJobStore.delete("job-1", "user-abc");

    expect(firstEq).toHaveBeenCalledWith("id", "job-1");
    expect(eqChain.eq).toHaveBeenCalledWith("user_id", "user-abc");
  });

  it("throws when delete fails", async () => {
    const eqChain = { eq: vi.fn().mockResolvedValue({ error: { message: "Delete failed" } }) };
    mockDelete.mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) });
    await expect(techJobStore.delete("job-1", "user-abc")).rejects.toThrow(
      "techJobStore.delete failed: Delete failed"
    );
  });
});

describe("techJobStore.countRunning", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 0 when count is null (table might not exist)", async () => {
    mockSelect.mockReturnValue({ in: mockIn });
    mockIn.mockResolvedValue({ count: null, error: null });
    const count = await techJobStore.countRunning();
    expect(count).toBe(0);
  });

  it("returns the active job count", async () => {
    mockSelect.mockReturnValue({ in: mockIn });
    mockIn.mockResolvedValue({ count: 3, error: null });
    const count = await techJobStore.countRunning();
    expect(count).toBe(3);
  });
});
