"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/layout/AppLayout";
import { useContentCreationStore } from "@/store/content-creation-store";
import { useContentCreationSSE } from "@/hooks/use-content-creation-sse";
import { ContentCreationForm } from "@/components/content-creation/ContentCreationForm";
import { ContentAgentMonitor } from "@/components/content-creation/ContentAgentMonitor";
import { ContentPlatformViewer } from "@/components/content-creation/ContentPlatformViewer";
import { ContentLeftRail } from "@/components/content-creation/ContentLeftRail";
import { ContentRightPanel } from "@/components/content-creation/ContentRightPanel";
import { Brain, ChevronRight, FileEdit, RotateCcw, History } from "lucide-react";

interface Props {
  accessToken: string | null;
  user?: any;
}

const TAB_LABELS = {
  config: "Configure",
  agents: "Live Progress",
  content: "Content",
} as const;

export default function ContentCreationPageClient({ accessToken, user }: Props) {
  const { activeTab, setActiveTab, job, jobId, resetJob, setJob, setJobId, config } =
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
                <FileEdit className="h-5 w-5 text-indigo-600" />
              </div>
              <h1 className="font-display font-bold text-slate-800">Content Creation</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {job && (
              <Button variant="outline" size="sm" onClick={resetJob}>
                <RotateCcw className="h-3.5 w-3.5" />
                New Content
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/content-creation/history">
                <History className="h-3.5 w-3.5" />
                History
              </Link>
            </Button>
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

      {/* Content — 3-column shell: sticky context rails flank the main column on xl+ */}
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto grid max-w-3xl gap-8 xl:max-w-[1500px] xl:grid-cols-[230px_minmax(0,1fr)_310px]">
          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <ContentLeftRail activeTab={activeTab} job={job} config={config} />
            </div>
          </aside>

          <main className="min-w-0">
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
          </main>

          <aside className="hidden xl:block">
            <div className="sticky top-24 animate-in fade-in duration-500">
              <ContentRightPanel activeTab={activeTab} job={job} config={config} accessToken={accessToken} />
            </div>
          </aside>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
