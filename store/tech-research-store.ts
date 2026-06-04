"use client";

import { create } from "zustand";
import type { TechResearchConfig, TechResearchJob } from "@/types/tech-research";
import type { AgentState } from "@/types/research";
import { TECH_RESEARCH_MODELS } from "@/lib/tech-research/models";

interface TechResearchStore {
  config: TechResearchConfig;
  job: TechResearchJob | null;
  jobId: string | null;
  activeTab: "config" | "agents" | "report";

  setConfig: (updates: Partial<TechResearchConfig>) => void;
  setJob: (job: TechResearchJob | null) => void;
  setJobId: (id: string | null) => void;
  setActiveTab: (tab: "config" | "agents" | "report") => void;
  updateAgent: (agentId: string, updates: Partial<AgentState>) => void;
  updateJobStatus: (status: TechResearchJob["status"], error?: string) => void;
  resetJob: () => void;
}

export const useTechResearchStore = create<TechResearchStore>((set) => ({
  config: {
    requirement: "",
    current_stack: "",
    constraints: "",
    criteria: {
      performance: 3,
      developer_experience: 4,
      maturity: 3,
      cost: 3,
      security: 3,
    },
    provider: "anthropic",
    model: TECH_RESEARCH_MODELS.anthropic[0].id,
    depth: "tier2",
    format: "md",
    focus_area: "general",
    searchMyKB: false,
    indexToKB: true,
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
