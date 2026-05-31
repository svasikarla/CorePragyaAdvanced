"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import { useMvpDocsStore } from "@/store/mvp-docs-store";
import { useMvpDocsSSE } from "@/hooks/use-mvp-docs-sse";
import { MvpDocsForm } from "@/components/mvp-docs/MvpDocsForm";
import { MvpDocsAgentMonitor } from "@/components/mvp-docs/MvpDocsAgentMonitor";
import { MvpDocsViewer } from "@/components/mvp-docs/MvpDocsViewer";
import { Brain, ChevronRight, FileStack, RotateCcw, History } from "lucide-react";

interface Props {
  accessToken: string | null;
  user?: any;
}

const TAB_LABELS = {
  config: "Configure",
  agents: "Live Progress",
  documents: "Documents",
} as const;

export default function MvpDocsPageClient({ accessToken, user }: Props) {
  const { activeTab, setActiveTab, job, jobId, resetJob, setJob, setJobId } =
    useMvpDocsStore();
  const [isLoading, setIsLoading] = useState(false);

  useMvpDocsSSE(jobId, accessToken);

  async function handleSubmit(token: string) {
    const config = useMvpDocsStore.getState().config;
    setIsLoading(true);

    try {
      const res = await fetch("/api/mvp-docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start documentation build");

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
      alert(err instanceof Error ? err.message : "Failed to start documentation build");
    } finally {
      setIsLoading(false);
    }
  }

  const canViewDocs = job?.status === "done" && job.documents?.length;

  return (
    <AppLayout user={user}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60">
        {/* Header */}
        <div className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
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
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/25">
                  <FileStack className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-display text-lg font-bold text-slate-800 leading-tight">MVP Documentation</h1>
                  <p className="text-[11px] text-slate-400 -mt-0.5">Brief → multi-agent doc bundle</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {job && (
                <Button variant="outline" size="sm" onClick={resetJob}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  New Bundle
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href="/mvp-docs/history">
                  <History className="h-3.5 w-3.5" />
                  History
                </Link>
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="container mx-auto px-4">
            <div className="flex gap-0">
              {(["config", "agents", "documents"] as const).map((tab) => {
                const disabled = tab === "documents" && !canViewDocs;
                return (
                  <button
                    key={tab}
                    onClick={() => !disabled && setActiveTab(tab)}
                    disabled={disabled}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 -mb-px ${
                      activeTab === tab
                        ? "border-indigo-600 text-indigo-600"
                        : disabled
                        ? "border-transparent text-slate-300 cursor-not-allowed"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
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
            <MvpDocsForm
              key="config"
              onSubmit={handleSubmit}
              accessToken={accessToken}
              isLoading={isLoading}
            />
          )}

          {activeTab === "agents" && (
            <div key="agents" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
              <MvpDocsAgentMonitor job={job} />
            </div>
          )}

          {activeTab === "documents" && canViewDocs && job && (
            <div key="documents" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
              <MvpDocsViewer job={job} accessToken={accessToken} />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
