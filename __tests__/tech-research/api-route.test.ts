import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockStartJob, mockGetUser } = vi.hoisted(() => ({
  mockStartJob: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextRequest: class {
    headers = new Map<string, string>();
    json = vi.fn();
    constructor(public url: string, init?: RequestInit) {}
  },
  NextResponse: {
    json: vi.fn((data: unknown, opts?: { status?: number }) => ({
      ...((data as object) ?? {}),
      status: opts?.status ?? 200,
    })),
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/tech-research/agents/job-runner", () => ({
  startTechResearchJob: mockStartJob,
}));

import { POST } from "@/app/api/tech-research/route";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, token = "valid-token") {
  const req = new NextRequest("http://localhost/api/tech-research", {
    method: "POST",
    body: JSON.stringify(body),
  });
  (req as any).headers = new Map([["authorization", `Bearer ${token}`]]);
  (req as any).json = async () => body;
  return req;
}

const VALID_BODY = {
  requirement: "We need real-time collaborative editing for our web app",
  current_stack: "Next.js, Supabase, TypeScript",
  constraints: "",
  criteria: { performance: 3, developer_experience: 4, maturity: 3, cost: 3, security: 3 },
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  depth: "tier2",
  format: "md",
  focus_area: "general",
  searchMyKB: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/tech-research", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    mockStartJob.mockResolvedValue("job-abc123");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = new NextRequest("http://localhost/api/tech-research", { method: "POST" });
    (req as any).headers = new Map();
    (req as any).json = async () => VALID_BODY;
    const res = await POST(req) as any;
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Invalid token" } });
    const res = await POST(makeRequest(VALID_BODY)) as any;
    expect(res.status).toBe(401);
  });

  it("returns 400 when requirement is too short", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, requirement: "short" })) as any;
    expect(res.status).toBe(400);
  });

  it("returns 400 when requirement exceeds 1000 chars", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, requirement: "x".repeat(1001) })) as any;
    expect(res.status).toBe(400);
  });

  it("returns 400 when provider is invalid", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, provider: "unknown-provider" })) as any;
    expect(res.status).toBe(400);
  });

  it("returns 400 when depth is invalid", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, depth: "tier9" })) as any;
    expect(res.status).toBe(400);
  });

  it("returns 400 when focus_area is invalid", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, focus_area: "quantum" })) as any;
    expect(res.status).toBe(400);
  });

  it("returns 400 when criteria weight is out of range", async () => {
    const res = await POST(makeRequest({
      ...VALID_BODY,
      criteria: { ...VALID_BODY.criteria, performance: 10 },
    })) as any;
    expect(res.status).toBe(400);
  });

  it("returns 400 for control characters in requirement (injection guard)", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, requirement: "valid req\x00injection" })) as any;
    expect(res.status).toBe(400);
  });

  it("returns jobId on valid request", async () => {
    const res = await POST(makeRequest(VALID_BODY)) as any;
    expect(res.status).toBe(200);
    expect(res.jobId).toBe("job-abc123");
    expect(mockStartJob).toHaveBeenCalledWith(
      expect.objectContaining({ requirement: VALID_BODY.requirement }),
      "user-123"
    );
  });

  it("returns 503 when server is busy", async () => {
    mockStartJob.mockRejectedValue(new Error("Server busy — 5 jobs are already running."));
    const res = await POST(makeRequest(VALID_BODY)) as any;
    expect(res.status).toBe(503);
  });

  it("defaults searchMyKB to false when not provided", async () => {
    const { searchMyKB: _omit, ...bodyWithoutKB } = VALID_BODY;
    const res = await POST(makeRequest(bodyWithoutKB)) as any;
    expect(res.status).toBe(200);
    expect(mockStartJob).toHaveBeenCalledWith(
      expect.objectContaining({ searchMyKB: false }),
      "user-123"
    );
  });

  it("accepts all valid providers", async () => {
    for (const provider of ["anthropic", "openai", "groq"]) {
      const res = await POST(makeRequest({ ...VALID_BODY, provider })) as any;
      expect(res.status).toBe(200);
    }
  });

  it("accepts all valid focus areas", async () => {
    const areas = ["frontend", "backend", "database", "infrastructure", "security", "mobile", "ai_ml", "general"];
    for (const focus_area of areas) {
      const res = await POST(makeRequest({ ...VALID_BODY, focus_area })) as any;
      expect(res.status).toBe(200);
    }
  });
});
