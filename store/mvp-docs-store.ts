"use client";

import { create } from "zustand";
import type { MvpDocsConfig, MvpDocsJob, DocType } from "@/types/mvp-docs";
import type { AgentState } from "@/types/research";

const DEFAULT_MODEL = "claude-sonnet-4-6";

interface MvpDocsStore {
  config: MvpDocsConfig;
  job: MvpDocsJob | null;
  jobId: string | null;
  activeTab: "config" | "agents" | "documents";
  activeDocType: DocType | null;

  setConfig: (updates: Partial<MvpDocsConfig>) => void;
  setJob: (job: MvpDocsJob | null) => void;
  setJobId: (id: string | null) => void;
  setActiveTab: (tab: "config" | "agents" | "documents") => void;
  setActiveDocType: (docType: DocType | null) => void;
  updateAgent: (agentId: string, updates: Partial<AgentState>) => void;
  updateJobStatus: (status: MvpDocsJob["status"], error?: string) => void;
  resetJob: () => void;
}

export const useMvpDocsStore = create<MvpDocsStore>((set) => ({
  config: {
    productBrief: "",
    additionalContext: "",
    productName: "",
    targetDocs: ["vision", "prd", "system_architecture", "data_model", "api_contract"],
    targetAudience: "",
    searchMyKB: false,
    provider: "anthropic",
    model: DEFAULT_MODEL,
  },
  job: null,
  jobId: null,
  activeTab: "config",
  activeDocType: null,

  setConfig: (updates) =>
    set((state) => ({ config: { ...state.config, ...updates } })),

  setJob: (job) => set({ job }),

  setJobId: (jobId) => set({ jobId }),

  setActiveTab: (activeTab) => set({ activeTab }),

  setActiveDocType: (activeDocType) => set({ activeDocType }),

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

  resetJob: () => set({ job: null, jobId: null, activeTab: "config", activeDocType: null }),
}));
