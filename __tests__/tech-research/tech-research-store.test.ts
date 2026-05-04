import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";

// Import the Zustand store directly (not via React hook) for unit testing
import { useTechResearchStore } from "@/store/tech-research-store";
import type { TechResearchJob } from "@/types/tech-research";

function makeJob(overrides: Partial<TechResearchJob> = {}): TechResearchJob {
  return {
    id: "job-1",
    user_id: "user-abc",
    status: "queued",
    config: {
      requirement: "Test requirement",
      current_stack: "Next.js",
      constraints: "",
      criteria: { performance: 3, developer_experience: 3, maturity: 3, cost: 3, security: 3 },
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      depth: "tier2",
      format: "md",
      focus_area: "general",
    },
    agents: [
      { id: "req-analyzer", name: "Requirement Analyzer", role: "Parsing", status: "idle" },
      { id: "solution-scanner", name: "Solution Scanner", role: "Scanning", status: "idle" },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("useTechResearchStore", () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    act(() => useTechResearchStore.getState().resetJob());
    act(() => useTechResearchStore.setState({
      config: {
        requirement: "",
        current_stack: "",
        constraints: "",
        criteria: { performance: 3, developer_experience: 4, maturity: 3, cost: 3, security: 3 },
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        depth: "tier2",
        format: "md",
        focus_area: "general",
        searchMyKB: false,
      },
    }));
  });

  describe("initial state", () => {
    it("has empty requirement", () => {
      expect(useTechResearchStore.getState().config.requirement).toBe("");
    });

    it("defaults to anthropic provider", () => {
      expect(useTechResearchStore.getState().config.provider).toBe("anthropic");
    });

    it("defaults to tier2 depth", () => {
      expect(useTechResearchStore.getState().config.depth).toBe("tier2");
    });

    it("defaults to 'config' tab", () => {
      expect(useTechResearchStore.getState().activeTab).toBe("config");
    });

    it("has no active job", () => {
      expect(useTechResearchStore.getState().job).toBeNull();
      expect(useTechResearchStore.getState().jobId).toBeNull();
    });

    it("has all criteria weights initialized", () => {
      const { criteria } = useTechResearchStore.getState().config;
      expect(criteria.performance).toBeGreaterThan(0);
      expect(criteria.developer_experience).toBeGreaterThan(0);
      expect(criteria.maturity).toBeGreaterThan(0);
      expect(criteria.cost).toBeGreaterThan(0);
      expect(criteria.security).toBeGreaterThan(0);
    });
  });

  describe("setConfig", () => {
    it("updates the requirement", () => {
      act(() => useTechResearchStore.getState().setConfig({ requirement: "Need real-time sync" }));
      expect(useTechResearchStore.getState().config.requirement).toBe("Need real-time sync");
    });

    it("merges partial config updates", () => {
      act(() => useTechResearchStore.getState().setConfig({ provider: "openai" }));
      const { config } = useTechResearchStore.getState();
      expect(config.provider).toBe("openai");
      expect(config.depth).toBe("tier2"); // unchanged
    });

    it("updates criteria weights", () => {
      act(() => useTechResearchStore.getState().setConfig({
        criteria: { performance: 5, developer_experience: 5, maturity: 5, cost: 5, security: 5 },
      }));
      expect(useTechResearchStore.getState().config.criteria.performance).toBe(5);
    });
  });

  describe("setJob / setJobId", () => {
    it("sets the job and jobId", () => {
      const job = makeJob();
      act(() => {
        useTechResearchStore.getState().setJob(job);
        useTechResearchStore.getState().setJobId("job-1");
      });
      expect(useTechResearchStore.getState().job?.id).toBe("job-1");
      expect(useTechResearchStore.getState().jobId).toBe("job-1");
    });

    it("clears the job when called with null", () => {
      act(() => useTechResearchStore.getState().setJob(makeJob()));
      act(() => useTechResearchStore.getState().setJob(null));
      expect(useTechResearchStore.getState().job).toBeNull();
    });
  });

  describe("setActiveTab", () => {
    it("switches to agents tab", () => {
      act(() => useTechResearchStore.getState().setActiveTab("agents"));
      expect(useTechResearchStore.getState().activeTab).toBe("agents");
    });

    it("switches to report tab", () => {
      act(() => useTechResearchStore.getState().setActiveTab("report"));
      expect(useTechResearchStore.getState().activeTab).toBe("report");
    });

    it("switches back to config tab", () => {
      act(() => useTechResearchStore.getState().setActiveTab("agents"));
      act(() => useTechResearchStore.getState().setActiveTab("config"));
      expect(useTechResearchStore.getState().activeTab).toBe("config");
    });
  });

  describe("updateAgent", () => {
    beforeEach(() => {
      act(() => useTechResearchStore.getState().setJob(makeJob()));
    });

    it("updates a specific agent by id", () => {
      act(() => useTechResearchStore.getState().updateAgent("req-analyzer", { status: "running" }));
      const agent = useTechResearchStore.getState().job?.agents.find((a) => a.id === "req-analyzer");
      expect(agent?.status).toBe("running");
    });

    it("does not modify other agents", () => {
      act(() => useTechResearchStore.getState().updateAgent("req-analyzer", { status: "done" }));
      const other = useTechResearchStore.getState().job?.agents.find((a) => a.id === "solution-scanner");
      expect(other?.status).toBe("idle");
    });

    it("adds a note to the agent", () => {
      act(() => useTechResearchStore.getState().updateAgent("req-analyzer", { note: "3 requirements parsed" }));
      const agent = useTechResearchStore.getState().job?.agents.find((a) => a.id === "req-analyzer");
      expect(agent?.note).toBe("3 requirements parsed");
    });

    it("does nothing when job is null", () => {
      act(() => useTechResearchStore.getState().setJob(null));
      expect(() => {
        act(() => useTechResearchStore.getState().updateAgent("req-analyzer", { status: "done" }));
      }).not.toThrow();
    });
  });

  describe("updateJobStatus", () => {
    beforeEach(() => {
      act(() => useTechResearchStore.getState().setJob(makeJob()));
    });

    it("updates job status", () => {
      act(() => useTechResearchStore.getState().updateJobStatus("running"));
      expect(useTechResearchStore.getState().job?.status).toBe("running");
    });

    it("sets error message when provided", () => {
      act(() => useTechResearchStore.getState().updateJobStatus("error", "API key missing"));
      expect(useTechResearchStore.getState().job?.status).toBe("error");
      expect(useTechResearchStore.getState().job?.error).toBe("API key missing");
    });

    it("does nothing when job is null", () => {
      act(() => useTechResearchStore.getState().setJob(null));
      expect(() => {
        act(() => useTechResearchStore.getState().updateJobStatus("done"));
      }).not.toThrow();
    });
  });

  describe("resetJob", () => {
    it("clears job, jobId and returns to config tab", () => {
      act(() => {
        useTechResearchStore.getState().setJob(makeJob());
        useTechResearchStore.getState().setJobId("job-1");
        useTechResearchStore.getState().setActiveTab("report");
      });

      act(() => useTechResearchStore.getState().resetJob());

      const state = useTechResearchStore.getState();
      expect(state.job).toBeNull();
      expect(state.jobId).toBeNull();
      expect(state.activeTab).toBe("config");
    });
  });
});
