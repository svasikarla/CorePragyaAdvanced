"use client";

import { useState } from "react";
import Link from "next/link";
import type { ContentJobSummary } from "@/types/content-creation";
import { PLATFORM_LABELS } from "@/types/content-creation";
import { Trash2, Eye, Loader2, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface Props {
  job: ContentJobSummary;
  accessToken: string | null;
  onDelete: (id: string) => void;
}

function StatusBadge({ status }: { status: ContentJobSummary["status"] }) {
  switch (status) {
    case "done":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
          <CheckCircle className="h-3 w-3" /> Done
        </span>
      );
    case "running":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-0.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Running
        </span>
      );
    case "queued":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5">
          <Clock className="h-3 w-3" /> Queued
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
          <AlertCircle className="h-3 w-3" /> Error
        </span>
      );
  }
}

export function ContentJobCard({ job, accessToken, onDelete }: Props) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!accessToken) return;
    setDeleting(true);
    try {
      await fetch(`/api/content-creation/jobs/${job.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      onDelete(job.id);
    } finally {
      setDeleting(false);
    }
  }

  const platformList = job.config.targetPlatforms
    .slice(0, 4)
    .map((p) => PLATFORM_LABELS[p])
    .join(", ");
  const extra = job.config.targetPlatforms.length > 4
    ? ` +${job.config.targetPlatforms.length - 4} more`
    : "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 flex items-start gap-4 hover:border-slate-300 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={job.status} />
          <span className="text-xs text-slate-400">
            {new Date(job.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-800 truncate">{job.config.topic}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {platformList}{extra} · {job.config.tone}
          {job.config.targetAudience ? ` · ${job.config.targetAudience}` : ""}
        </p>
        {job.status === "error" && job.error && (
          <p className="text-xs text-red-600 mt-1 truncate">{job.error}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {job.status === "done" && (
          <Link
            href={`/content-creation/history/${job.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting || job.status === "running" || job.status === "queued"}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Delete job"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
