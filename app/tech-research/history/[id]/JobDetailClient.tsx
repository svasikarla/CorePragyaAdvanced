"use client";

import Link from "next/link";
import { TechReportViewer } from "@/components/tech-research/TechReportViewer";
import type { TechResearchJob } from "@/types/tech-research";
import { ChevronLeft, Cpu } from "lucide-react";

interface Props {
  job: TechResearchJob;
  accessToken: string | null;
}

export default function TechJobDetailClient({ job, accessToken }: Props) {
  if (!job.report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <p className="text-sm">Report not available for this job.</p>
          <Link
            href="/tech-research/history"
            className="mt-3 inline-block text-sm text-sky-500 hover:text-sky-600"
          >
            Back to history
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/tech-research/history"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-600 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            History
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Cpu className="h-3.5 w-3.5 text-sky-500" />
            <span className="truncate max-w-xs">{job.config.requirement.slice(0, 60)}…</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <TechReportViewer
          report={job.report}
          jobId={job.id}
          accessToken={accessToken}
        />
      </div>
    </div>
  );
}
