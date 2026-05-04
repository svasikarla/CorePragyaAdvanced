"use client";

import { useState } from "react";
import { useTechResearchStore } from "@/store/tech-research-store";
import { useTechResearchSSE } from "@/hooks/use-tech-research-sse";
import { TechResearchForm } from "@/components/tech-research/TechResearchForm";
import { AgentMonitor } from "@/components/tech-research/AgentMonitor";
import { TechReportViewer } from "@/components/tech-research/TechReportViewer";
import Link from "next/link";
import { Cpu, RotateCcw, History, Brain, ChevronRight } from "lucide-react";

interface Props {
  accessToken: string | null;
}

const TAB_LABELS = {
  config: "Configure",
  agents: "Live Progress",
  report: "Report",
} as const;

export default function TechResearchPageClient({ accessToken }: Props) {
  const { activeTab, setActiveTab, job, jobId, resetJob, setJob, setJobId } =
    useTechResearchStore();
  const [isLoading, setIsLoading] = useState(false);

  useTechResearchSSE(jobId, accessToken);

  async function handleSubmit(token: string) {
    const config = useTechResearchStore.getState().config;
    setIsLoading(true);

    try {
      const res = await fetch("/api/tech-research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start research");

      setJobId(data.jobId);
      setJob({
        id: data.jobId,
        user_id: "",
        status: "queued",
        config,
        agents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setActiveTab("agents");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start research");
    } finally {
      setIsLoading(false);
    }
  }

  const canViewReport = job?.status === "done" && job.report;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-600 transition-colors shrink-0"
            >
              <Brain size={14} />
              Dashboard
            </Link>
            <ChevronRight size={14} className="text-slate-300" />
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-sky-500" />
              <span className="font-semibold text-slate-800">Technical Research</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {job && (
              <button
                onClick={resetJob}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Research
              </button>
            )}
            <Link
              href="/tech-research/history"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-600 transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              History
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="container mx-auto px-4">
          <div className="flex gap-0">
            {(["config", "agents", "report"] as const).map((tab) => {
              const disabled = tab === "report" && !canViewReport;
              return (
                <button
                  key={tab}
                  onClick={() => !disabled && setActiveTab(tab)}
                  disabled={disabled}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab
                      ? "border-sky-500 text-sky-600"
                      : disabled
                      ? "border-transparent text-slate-300 cursor-not-allowed"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {activeTab === "config" && (
          <TechResearchForm
            onSubmit={handleSubmit}
            accessToken={accessToken}
            isLoading={isLoading}
          />
        )}

        {activeTab === "agents" && <AgentMonitor job={job} />}

        {activeTab === "report" && canViewReport && (
          <TechReportViewer
            report={job.report!}
            jobId={jobId!}
            accessToken={accessToken}
          />
        )}
      </div>
    </div>
  );
}
