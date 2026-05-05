"use client";

import { useState } from "react";
import Link from "next/link";
import { useContentCreationStore } from "@/store/content-creation-store";
import { useContentCreationSSE } from "@/hooks/use-content-creation-sse";
import { ContentCreationForm } from "@/components/content-creation/ContentCreationForm";
import { ContentAgentMonitor } from "@/components/content-creation/ContentAgentMonitor";
import { ContentPlatformViewer } from "@/components/content-creation/ContentPlatformViewer";
import { Brain, ChevronRight, FileEdit, RotateCcw, History } from "lucide-react";

interface Props {
  accessToken: string | null;
}

const TAB_LABELS = {
  config: "Configure",
  agents: "Live Progress",
  content: "Content",
} as const;

export default function ContentCreationPageClient({ accessToken }: Props) {
  const { activeTab, setActiveTab, job, jobId, resetJob, setJob, setJobId } =
    useContentCreationStore();
  const [isLoading, setIsLoading] = useState(false);

  useContentCreationSSE(jobId, accessToken);

  async function handleSubmit(token: string) {
    const config = useContentCreationStore.getState().config;
    setIsLoading(true);

    try {
      const res = await fetch("/api/content-creation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start content creation");

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
      alert(err instanceof Error ? err.message : "Failed to start content creation");
    } finally {
      setIsLoading(false);
    }
  }

  const canViewContent = job?.status === "done" && job.content_pieces?.length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-600 transition-colors shrink-0"
            >
              <Brain size={14} />
              Dashboard
            </Link>
            <ChevronRight size={14} className="text-slate-300" />
            <div className="flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-violet-500" />
              <span className="font-semibold text-slate-800">Content Creation</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {job && (
              <button
                onClick={resetJob}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Content
              </button>
            )}
            <Link
              href="/content-creation/history"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              History
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="container mx-auto px-4">
          <div className="flex gap-0">
            {(["config", "agents", "content"] as const).map((tab) => {
              const disabled = tab === "content" && !canViewContent;
              return (
                <button
                  key={tab}
                  onClick={() => !disabled && setActiveTab(tab)}
                  disabled={disabled}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab
                      ? "border-violet-500 text-violet-600"
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
          <ContentCreationForm
            onSubmit={handleSubmit}
            accessToken={accessToken}
            isLoading={isLoading}
          />
        )}

        {activeTab === "agents" && <ContentAgentMonitor job={job} />}

        {activeTab === "content" && canViewContent && job && (
          <ContentPlatformViewer job={job} accessToken={accessToken} />
        )}
      </div>
    </div>
  );
}
