import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetUser,
  mockJobGet,
  mockToMarkdown,
  mockToHTML,
  mockToDocx,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockJobGet: vi.fn(),
  mockToMarkdown: vi.fn(),
  mockToHTML: vi.fn(),
  mockToDocx: vi.fn(),
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
  techJobStore: { get: mockJobGet },
  resetTableReadyCache: vi.fn(),
}));

vi.mock("@/lib/tech-research/export/markdown", () => ({
  techReportToMarkdown: mockToMarkdown,
}));

vi.mock("@/lib/tech-research/export/html", () => ({
  techReportToHTML: mockToHTML,
}));

vi.mock("@/lib/tech-research/export/docx-exporter", () => ({
  techReportToDocx: mockToDocx,
}));

import { GET } from "@/app/api/tech-research/report/[id]/download/route";
import { NextRequest } from "next/server";

const MOCK_REPORT = { requirement: "Test", generated_at: new Date().toISOString() };

function makeRequest(params: Record<string, string> = {}, token = "tok") {
  const req = new NextRequest() as unknown as {
    nextUrl: { searchParams: URLSearchParams };
    headers: Map<string, string>;
  };
  req.headers = new Map([["authorization", `Bearer ${token}`]]);
  req.nextUrl = { searchParams: new URLSearchParams({ token, ...params }) };
  return req as unknown as import("next/server").NextRequest;
}

const PARAMS = Promise.resolve({ id: "job-123" });

function makeJob(overrides = {}) {
  return {
    id: "job-123",
    user_id: "user-1",
    status: "done",
    config: { requirement: "Test requirement", format: "md" },
    report: MOCK_REPORT,
    ...overrides,
  };
}

describe("GET /api/tech-research/report/[id]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockJobGet.mockResolvedValue(makeJob());
    mockToMarkdown.mockReturnValue("# Report\n\ncontent");
    mockToHTML.mockResolvedValue("<html>report</html>");
    mockToDocx.mockResolvedValue(Buffer.from("docx content"));
  });

  it("returns 401 with no auth token", async () => {
    const req = makeRequest({}, "");
    (req as unknown as { headers: Map<string, string>; nextUrl: { searchParams: URLSearchParams } }).nextUrl.searchParams.delete("token");
    (req as unknown as { headers: Map<string, string> }).headers = new Map();
    const res = await GET(req, { params: PARAMS });
    expect((res as unknown as { status: number }).status).toBe(401);
  });

  it("returns 401 when user auth fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: {} });
    const res = await GET(makeRequest(), { params: PARAMS });
    expect((res as unknown as { status: number }).status).toBe(401);
  });

  it("returns 404 when job not found", async () => {
    mockJobGet.mockResolvedValue(undefined);
    const res = await GET(makeRequest(), { params: PARAMS });
    expect((res as unknown as { status: number }).status).toBe(404);
  });

  it("returns 403 when job belongs to different user", async () => {
    mockJobGet.mockResolvedValue(makeJob({ user_id: "other-user" }));
    const res = await GET(makeRequest(), { params: PARAMS });
    expect((res as unknown as { status: number }).status).toBe(403);
  });

  it("returns 404 when report is not ready", async () => {
    mockJobGet.mockResolvedValue(makeJob({ report: null }));
    const res = await GET(makeRequest(), { params: PARAMS });
    expect((res as unknown as { status: number }).status).toBe(404);
  });

  it("returns markdown content with text/markdown content-type", async () => {
    const res = await GET(makeRequest({ format: "md" }), { params: PARAMS });
    expect(mockToMarkdown).toHaveBeenCalledWith(MOCK_REPORT);
    const contentType = (res as unknown as Response).headers?.get("Content-Type") ?? "";
    expect(contentType).toContain("markdown");
  });

  it("returns HTML content with text/html content-type", async () => {
    const res = await GET(makeRequest({ format: "html" }), { params: PARAMS });
    expect(mockToHTML).toHaveBeenCalledWith(MOCK_REPORT);
    const contentType = (res as unknown as Response).headers?.get("Content-Type") ?? "";
    expect(contentType).toContain("html");
  });

  it("returns DOCX content with correct content-type", async () => {
    const res = await GET(makeRequest({ format: "docx" }), { params: PARAMS });
    expect(mockToDocx).toHaveBeenCalledWith(MOCK_REPORT);
    const contentType = (res as unknown as Response).headers?.get("Content-Type") ?? "";
    expect(contentType).toContain("wordprocessingml");
  });

  it("returns 400 for unknown format", async () => {
    const res = await GET(makeRequest({ format: "pdf" }), { params: PARAMS });
    expect((res as unknown as { status: number }).status).toBe(400);
  });

  it("uses job config format when no format query param", async () => {
    const res = await GET(makeRequest(), { params: PARAMS });
    // Default format from job.config.format is 'md'
    expect(mockToMarkdown).toHaveBeenCalled();
  });

  it("uses job requirement for filename slug", async () => {
    const res = await GET(makeRequest({ format: "md" }), { params: PARAMS });
    const disposition = (res as unknown as Response).headers?.get("Content-Disposition") ?? "";
    expect(disposition).toContain("tech-research-");
    expect(disposition).toContain(".md");
  });
});
