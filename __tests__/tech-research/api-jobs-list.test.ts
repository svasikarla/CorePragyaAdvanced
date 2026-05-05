import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockList } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextRequest: class {
    nextUrl = { searchParams: new URLSearchParams() };
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
  techJobStore: { list: mockList },
  resetTableReadyCache: vi.fn(),
}));

import { GET } from "@/app/api/tech-research/jobs/route";
import { NextRequest } from "next/server";

function makeRequest(params: Record<string, string> = {}, token = "tok") {
  const req = new NextRequest("http://localhost") as unknown as { headers: Map<string, string>; nextUrl: { searchParams: URLSearchParams } };
  req.headers = new Map([["authorization", `Bearer ${token}`]]);
  req.nextUrl = { searchParams: new URLSearchParams(params) };
  return req as unknown as import("next/server").NextRequest;
}

describe("GET /api/tech-research/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockList.mockResolvedValue({ jobs: [], total: 0 });
  });

  it("returns 401 when no Authorization header", async () => {
    const req = makeRequest({}, "");
    (req as unknown as { headers: Map<string, string> }).headers = new Map();
    const res = await GET(req) as unknown as { status: number };
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "bad token" } });
    const res = await GET(makeRequest()) as unknown as { status: number };
    expect(res.status).toBe(401);
  });

  it("returns jobs list on valid auth", async () => {
    const res = await GET(makeRequest()) as unknown as { status: number; jobs: unknown[]; total: number };
    expect(res.status).toBe(200);
    expect(res.jobs).toEqual([]);
    expect(res.total).toBe(0);
  });

  it("passes status filter to the store", async () => {
    await GET(makeRequest({ status: "done" }));
    expect(mockList).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ status: "done" })
    );
  });

  it("passes search filter to the store", async () => {
    await GET(makeRequest({ search: "sync" }));
    expect(mockList).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ search: "sync" })
    );
  });

  it("caps limit at 50 regardless of query param", async () => {
    await GET(makeRequest({ limit: "200" }));
    expect(mockList).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ limit: 50 })
    );
  });

  it("passes offset from query param", async () => {
    await GET(makeRequest({ offset: "40" }));
    expect(mockList).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ offset: 40 })
    );
  });

  it("returns 500 when store throws", async () => {
    mockList.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest()) as unknown as { status: number };
    expect(res.status).toBe(500);
  });
});
