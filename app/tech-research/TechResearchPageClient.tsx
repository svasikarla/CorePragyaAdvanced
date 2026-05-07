"use client";

import { useState } from "react";
import { useTechResearchStore } from "@/store/tech-research-store";
import { useTechResearchSSE } from "@/hooks/use-tech-research-sse";
import { TechResearchForm } from "@/components/tech-research/TechResearchForm";
import { AgentMonitor } from "@/components/tech-research/AgentMonitor";
import { TechReportViewer } from "@/components/tech-research/TechReportViewer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import { Cpu, RotateCcw, History, Brain, ChevronRight } from "lucide-react";

interface Props {
  accessToken: string | null;
  user?: any;
}

const TAB_LABELS = {
  config: "Configure",
  agents: "Live Progress",
  report: "Report",
} as const;

export default function TechResearchPageClient({ accessToken, user }: Props) {
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
    <AppLayout user={user}>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
            >
              <Brain size={14} />
              Dashboard
            </Link>
            <ChevronRight size={14} className="text-slate-300" />
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-50">
                <Cpu className="h-5 w-5 text-indigo-600" />
              </div>
              <h1 className="font-display font-bold text-slate-800">Technical Research</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {job && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetJob}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Research
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/tech-research/history">
                <History className="h-3.5 w-3.5" />
                History
              </Link>
            </Button>
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
                      ? "border-indigo-600 text-indigo-600"
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
    </AppLayout>
  );
}
