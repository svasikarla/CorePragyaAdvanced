"use client";

import Link from "next/link";
import type { ContentCreationJob } from "@/types/content-creation";
import { ContentPlatformViewer } from "@/components/content-creation/ContentPlatformViewer";
import { ContentLeftRail } from "@/components/content-creation/ContentLeftRail";
import { ContentRightPanel } from "@/components/content-creation/ContentRightPanel";
import { Brain, ChevronRight, FileEdit, ArrowLeft } from "lucide-react";

interface Props {
  job: ContentCreationJob;
  accessToken: string | null;
}

export default function ContentDetailClient({ job, accessToken }: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/dashboard" className="flex items-center gap-1 hover:text-violet-600 transition-colors">
              <Brain size={13} /> Dashboard
            </Link>
            <ChevronRight size={13} className="text-slate-300" />
            <Link href="/content-creation" className="flex items-center gap-1 hover:text-violet-600 transition-colors">
              <FileEdit size={13} /> Content Creation
            </Link>
            <ChevronRight size={13} className="text-slate-300" />
            <Link href="/content-creation/history" className="hover:text-violet-600 transition-colors">
              History
            </Link>
            <ChevronRight size={13} className="text-slate-300" />
            <span className="text-slate-600 truncate max-w-[200px]">{job.config.topic}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl xl:max-w-[1500px]">
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/content-creation/history"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-800 truncate">{job.config.topic}</h1>
              <p className="text-xs text-slate-400">
                {job.config.tone} · {job.config.targetAudience || "General audience"} ·{" "}
                {new Date(job.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {job.status === "done" && job.content_pieces?.length ? (
            <div className="grid gap-8 xl:grid-cols-[230px_minmax(0,1fr)_310px]">
              <aside className="hidden xl:block">
                <div className="sticky top-24">
                  <ContentLeftRail activeTab="content" job={job} config={job.config} />
                </div>
              </aside>
              <main className="min-w-0">
                <ContentPlatformViewer job={job} accessToken={accessToken} />
              </main>
              <aside className="hidden xl:block">
                <div className="sticky top-24">
                  <ContentRightPanel activeTab="content" job={job} config={job.config} accessToken={accessToken} />
                </div>
              </aside>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400 text-sm">
              {job.status === "error"
                ? `Error: ${job.error ?? "Unknown error"}`
                : "Content is not available for this job."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
