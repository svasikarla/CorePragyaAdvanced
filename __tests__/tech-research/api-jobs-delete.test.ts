import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockJobGet, mockJobDelete } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockJobGet: vi.fn(),
  mockJobDelete: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextRequest: class {
    headers = new Map<string, string>();
  },
  NextResponse: {
    json: vi.fn((data: unknown, opts?: { status?: number }) => ({
      ...((data as object) ?? {}),
      status: opts?.status ?? 200,
    })),
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/tech-research/store/job-store", () => ({
  techJobStore: { get: mockJobGet, delete: mockJobDelete },
  resetTableReadyCache: vi.fn(),
}));

import { DELETE } from "@/app/api/tech-research/jobs/[id]/route";
import { NextRequest } from "next/server";

function makeRequest(token = "tok") {
  const req = new NextRequest("http://localhost") as unknown as { headers: Map<string, string> };
  req.headers = new Map([["authorization", `Bearer ${token}`]]);
  return req as unknown as import("next/server").NextRequest;
}

const PARAMS = Promise.resolve({ id: "job-123" });

function makeJob(overrides = {}) {
  return {
    id: "job-123",
    user_id: "user-1",
    status: "done",
    ...overrides,
  };
}

describe("DELETE /api/tech-research/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockJobGet.mockResolvedValue(makeJob());
    mockJobDelete.mockResolvedValue(undefined);
  });

  it("returns 401 when no auth", async () => {
    const req = makeRequest();
    (req as unknown as { headers: Map<string, string> }).headers = new Map();
    const res = await DELETE(req, { params: PARAMS }) as unknown as { status: number };
    expect(res.status).toBe(401);
  });

  it("returns 401 when user not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: {} });
    const res = await DELETE(makeRequest(), { params: PARAMS }) as unknown as { status: number };
    expect(res.status).toBe(401);
  });

  it("returns 404 when job not found", async () => {
    mockJobGet.mockResolvedValue(undefined);
    const res = await DELETE(makeRequest(), { params: PARAMS }) as unknown as { status: number };
    expect(res.status).toBe(404);
  });

  it("returns 403 when job belongs to different user", async () => {
    mockJobGet.mockResolvedValue(makeJob({ user_id: "other-user" }));
    const res = await DELETE(makeRequest(), { params: PARAMS }) as unknown as { status: number };
    expect(res.status).toBe(403);
  });

  it("returns 409 when job is still running", async () => {
    mockJobGet.mockResolvedValue(makeJob({ status: "running" }));
    const res = await DELETE(makeRequest(), { params: PARAMS }) as unknown as { status: number };
    expect(res.status).toBe(409);
  });

  it("returns 409 when job is queued", async () => {
    mockJobGet.mockResolvedValue(makeJob({ status: "queued" }));
    const res = await DELETE(makeRequest(), { params: PARAMS }) as unknown as { status: number };
    expect(res.status).toBe(409);
  });

  it("deletes and returns success for a done job", async () => {
    const res = await DELETE(makeRequest(), { params: PARAMS }) as unknown as { status: number; success: boolean };
    expect(res.status).toBe(200);
    expect(res.success).toBe(true);
    expect(mockJobDelete).toHaveBeenCalledWith("job-123", "user-1");
  });

  it("deletes an errored job successfully", async () => {
    mockJobGet.mockResolvedValue(makeJob({ status: "error" }));
    const res = await DELETE(makeRequest(), { params: PARAMS }) as unknown as { status: number; success: boolean };
    expect(res.status).toBe(200);
    expect(res.success).toBe(true);
  });
});
