import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mock Zustand store ────────────────────────────────────────────────────────

const {
  mockSetJob,
  mockUpdateAgent,
  mockUpdateJobStatus,
  mockSetActiveTab,
  mockStoreHook,
} = vi.hoisted(() => {
  const mockSetJob = vi.fn();
  const mockUpdateAgent = vi.fn();
  const mockUpdateJobStatus = vi.fn();
  const mockSetActiveTab = vi.fn();

  const storeState: { job: unknown } = { job: null };

  // Build hook function with Zustand static methods attached
  const hookFn = vi.fn(() => ({
    setJob: mockSetJob,
    updateAgent: mockUpdateAgent,
    updateJobStatus: mockUpdateJobStatus,
    setActiveTab: mockSetActiveTab,
  })) as ReturnType<typeof vi.fn> & { setState: ReturnType<typeof vi.fn>; getState: ReturnType<typeof vi.fn> };

  hookFn.setState = vi.fn((updater: (s: unknown) => unknown) => {
    if (typeof updater === "function") {
      const next = updater(storeState) as { job?: unknown };
      if (next?.job !== undefined) storeState.job = next.job;
    }
  });
  hookFn.getState = vi.fn(() => storeState);

  return {
    mockSetJob,
    mockUpdateAgent,
    mockUpdateJobStatus,
    mockSetActiveTab,
    mockStoreHook: hookFn,
  };
});

vi.mock("@/store/tech-research-store", () => ({
  useTechResearchStore: mockStoreHook,
}));

// ── Mock EventSource ──────────────────────────────────────────────────────────

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(handler);
  }

  close() {
    this.closed = true;
  }

  // Test helper: trigger an event
  trigger(event: string, data: object) {
    const e = { data: JSON.stringify(data) } as MessageEvent;
    this.listeners[event]?.forEach((h) => h(e));
  }

  // Test helper: trigger a connection-level error (no data)
  triggerError() {
    const e = { data: null } as unknown as MessageEvent;
    this.listeners["error"]?.forEach((h) => h(e));
  }
}

vi.stubGlobal("EventSource", MockEventSource);

// Also mock fetch for the probe-on-error path
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { useTechResearchSSE } from "@/hooks/use-tech-research-sse";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useTechResearchSSE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ error: "Job not found" }),
    });
  });

  afterEach(() => {
    MockEventSource.instances = [];
  });

  it("does not create EventSource when jobId is null", () => {
    renderHook(() => useTechResearchSSE(null, "token"));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("does not create EventSource when accessToken is null", () => {
    renderHook(() => useTechResearchSSE("job-1", null));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("creates EventSource with correct URL when both are provided", () => {
    renderHook(() => useTechResearchSSE("job-1", "my-token"));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]!.url).toContain("/api/tech-research/status/job-1");
    expect(MockEventSource.instances[0]!.url).toContain("my-token");
  });

  it("calls setJob on 'init' event", () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;
    const job = { id: "job-1", status: "queued", agents: [], config: {} };
    act(() => es.trigger("init", job));
    expect(mockSetJob).toHaveBeenCalledWith(job);
  });

  it("switches to report tab and closes ES when init shows done status", () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;
    act(() => es.trigger("init", { status: "done" }));
    expect(mockSetActiveTab).toHaveBeenCalledWith("report");
    expect(es.closed).toBe(true); // prevent infinite reconnect loop
  });

  it("closes ES when init shows error status (prevents reconnect loop)", () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;
    act(() => es.trigger("init", { status: "error", error: "API key missing" }));
    expect(es.closed).toBe(true);
  });

  it("calls setJob on 'poll' event", () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;
    const job = { id: "job-1", status: "running" };
    act(() => es.trigger("poll", job));
    expect(mockSetJob).toHaveBeenCalledWith(job);
  });

  it("switches to report tab and closes ES on 'poll' with done status", () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;
    act(() => es.trigger("poll", { status: "done" }));
    expect(mockSetActiveTab).toHaveBeenCalledWith("report");
    expect(es.closed).toBe(true);
  });

  it("calls updateAgent on 'agent_update' event", () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;
    act(() => es.trigger("agent_update", { agentId: "req-analyzer", status: "running", note: "parsing" }));
    expect(mockUpdateAgent).toHaveBeenCalledWith("req-analyzer", { status: "running", note: "parsing" });
  });

  it("switches to report and closes ES on 'complete' event", () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;
    act(() => es.trigger("complete", { report: { verdict: "Use Yjs" } }));
    expect(mockSetActiveTab).toHaveBeenCalledWith("report");
    expect(es.closed).toBe(true);
  });

  it("calls updateJobStatus with specific message on server SSE error event", () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;
    act(() => es.trigger("error", { message: "ANTHROPIC_API_KEY not set" }));
    expect(mockUpdateJobStatus).toHaveBeenCalledWith("error", "ANTHROPIC_API_KEY not set");
    expect(es.closed).toBe(true);
  });

  it("shows connection-lost message on HTTP-level error when job is still running", async () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;

    // Store has job in "running" state — connection drop is unexpected
    mockStoreHook.getState = vi.fn(() => ({ job: { status: "running" } }));

    await act(async () => {
      es.triggerError();
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should NOT fetch the SSE endpoint (which returns text/event-stream, not JSON)
    expect(mockFetch).not.toHaveBeenCalled();

    // Should show a clear actionable message
    expect(mockUpdateJobStatus).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Connection to the research service was lost")
    );
    expect(es.closed).toBe(true);
  });

  it("closes silently on HTTP-level error when job is already done", async () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;

    // Store says job is done — the stream closed normally after completion
    mockStoreHook.getState = vi.fn(() => ({ job: { status: "done" } }));

    await act(async () => {
      es.triggerError();
    });

    // Must NOT call updateJobStatus — job is already done, not an error
    expect(mockUpdateJobStatus).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(es.closed).toBe(true);
  });

  it("closes silently on HTTP-level error when job is already in error state", async () => {
    renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;

    mockStoreHook.getState = vi.fn(() => ({ job: { status: "error" } }));

    await act(async () => { es.triggerError(); });

    expect(mockUpdateJobStatus).not.toHaveBeenCalled();
    expect(es.closed).toBe(true);
  });

  it("closes EventSource on component unmount", () => {
    const { unmount } = renderHook(() => useTechResearchSSE("job-1", "tok"));
    const es = MockEventSource.instances[0]!;
    unmount();
    expect(es.closed).toBe(true);
  });

  it("recreates EventSource when jobId changes", () => {
    const { rerender } = renderHook(
      ({ jobId }: { jobId: string | null }) => useTechResearchSSE(jobId, "tok"),
      { initialProps: { jobId: "job-1" } }
    );
    expect(MockEventSource.instances).toHaveLength(1);

    rerender({ jobId: "job-2" });
    // Old one should be closed, new one created
    expect(MockEventSource.instances[0]!.closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1]!.url).toContain("job-2");
  });
});
