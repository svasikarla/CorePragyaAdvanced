"use client";

import { create } from "zustand";
import type { ResearchConfig, ResearchJob, AgentState } from "@/types/research";
import { RESEARCH_MODELS } from "@/lib/research/models";

interface ResearchStore {
  config: ResearchConfig;
  job: ResearchJob | null;
  jobId: string | null;
  activeTab: "config" | "agents" | "report";

  setConfig: (updates: Partial<ResearchConfig>) => void;
  setJob: (job: ResearchJob | null) => void;
  setJobId: (id: string | null) => void;
  setActiveTab: (tab: "config" | "agents" | "report") => void;
  updateAgent: (agentId: string, updates: Partial<AgentState>) => void;
  updateJobStatus: (status: ResearchJob["status"], error?: string) => void;
  resetJob: () => void;
}

export const useResearchStore = create<ResearchStore>((set) => ({
  config: {
    topic: "",
    provider: "anthropic",
    model: RESEARCH_MODELS.anthropic[0].id,
    depth: "tier2",
    audience: "analyst",
    format: "md",
    searchMyKB: false,
  },
  job: null,
  jobId: null,
  activeTab: "config",

  setConfig: (updates) =>
    set((state) => ({ config: { ...state.config, ...updates } })),

  setJob: (job) => set({ job }),

  setJobId: (jobId) => set({ jobId }),

  setActiveTab: (activeTab) => set({ activeTab }),

  updateAgent: (agentId, updates) =>
    set((state) => {
      if (!state.job) return state;
      return {
        job: {
          ...state.job,
          agents: state.job.agents.map((a) =>
            a.id === agentId ? { ...a, ...updates } : a
          ),
        },
      };
    }),

  updateJobStatus: (status, error) =>
    set((state) => {
      if (!state.job) return state;
      return { job: { ...state.job, status, ...(error ? { error } : {}) } };
    }),

  resetJob: () => set({ job: null, jobId: null, activeTab: "config" }),
}));
