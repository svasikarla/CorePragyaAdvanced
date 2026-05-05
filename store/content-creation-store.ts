"use client";

import { create } from "zustand";
import type { ContentCreationConfig, ContentCreationJob } from "@/types/content-creation";
import type { AgentState } from "@/types/research";

const DEFAULT_MODEL = "claude-sonnet-4-6";

interface ContentCreationStore {
  config: ContentCreationConfig;
  job: ContentCreationJob | null;
  jobId: string | null;
  activeTab: "config" | "agents" | "content";

  setConfig: (updates: Partial<ContentCreationConfig>) => void;
  setJob: (job: ContentCreationJob | null) => void;
  setJobId: (id: string | null) => void;
  setActiveTab: (tab: "config" | "agents" | "content") => void;
  updateAgent: (agentId: string, updates: Partial<AgentState>) => void;
  updateJobStatus: (status: ContentCreationJob["status"], error?: string) => void;
  resetJob: () => void;
}

export const useContentCreationStore = create<ContentCreationStore>((set) => ({
  config: {
    topic: "",
    additionalContext: "",
    targetPlatforms: ["medium", "linkedin_post"],
    tone: "professional",
    targetAudience: "",
    keywords: "",
    includeCode: false,
    searchMyKB: false,
    provider: "anthropic",
    model: DEFAULT_MODEL,
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
