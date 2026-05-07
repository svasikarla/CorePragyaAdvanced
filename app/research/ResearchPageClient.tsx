"use client";

import { useResearchStore } from "@/store/research-store";
import ResearchForm from "@/components/research/ResearchForm";
import AgentMonitor from "@/components/research/AgentMonitor";
import ReportViewer from "@/components/research/ReportViewer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import { FlaskConical, RotateCcw, History, Brain, ChevronRight } from "lucide-react";

interface Props {
  accessToken: string | null;
  user?: any;
}

// ── CorePragya light-theme CSS variables for the research module ──────────────
// Defined here so all child components receive them via CSS cascade.
const RESEARCH_THEME: React.CSSProperties = {
  ["--cp-research-bg" as string]: "#f8fafc",
  ["--cp-research-surface" as string]: "#ffffff",
  ["--cp-research-panel" as string]: "#f1f5f9",
  ["--cp-research-border" as string]: "#e2e8f0",
  ["--cp-research-text" as string]: "#1e293b",
  ["--cp-research-text-secondary" as string]: "#475569",
  ["--cp-research-muted" as string]: "#94a3b8",
  ["--cp-research-accent" as string]: "#4f46e5",
  ["--cp-research-status-idle" as string]: "#94a3b8",
  ["--cp-research-status-running" as string]: "#f59e0b",
  ["--cp-research-status-done" as string]: "#16a34a",
  ["--cp-research-status-error" as string]: "#dc2626",
};

const TAB_LABELS = {
  config: "Configure",
  agents: "Live Progress",
  report: "Report",
} as const;

export default function ResearchPageClient({ accessToken, user }: Props) {
  const { activeTab, setActiveTab, job, resetJob } = useResearchStore();

  return (
    <AppLayout user={user}>
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
            >
              <Brain size={14} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <ChevronRight size={13} className="text-slate-300 shrink-0" />
            <div className="p-2 rounded-lg bg-indigo-50">
              <FlaskConical className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="font-display font-bold text-slate-800">
                Research Intelligence
              </h1>
              <p className="text-xs text-slate-500">
                Multi-agent AI research pipeline · Web search · Export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/research/history">
                <History size={13} />
                History
              </Link>
            </Button>

            {job && (
              <Button variant="outline" size="sm" onClick={resetJob}>
                <RotateCcw size={13} />
                New research
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4">
          <nav className="flex gap-0">
            {(Object.keys(TAB_LABELS) as Array<keyof typeof TAB_LABELS>).map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  disabled={
                    (tab === "agents" && !job) ||
                    (tab === "report" && !job?.report)
                  }
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeTab === tab
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {tab === "agents" && job && (
                    <span
                      className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                        job.status === "done"
                          ? "bg-green-100 text-green-700"
                          : job.status === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {job.status}
                    </span>
                  )}
                </button>
              )
            )}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div style={RESEARCH_THEME} className="container mx-auto px-4 py-8 max-w-4xl">
        {activeTab === "config" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-5">
              Research Configuration
            </h2>
            <ResearchForm />
          </div>
        )}

        {activeTab === "agents" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-5">
              Agent Progress
            </h2>
            <AgentMonitor accessToken={accessToken} />
          </div>
        )}

        {activeTab === "report" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <ReportViewer />
          </div>
        )}
      </div>
    </div>
    </AppLayout>
  );
}
