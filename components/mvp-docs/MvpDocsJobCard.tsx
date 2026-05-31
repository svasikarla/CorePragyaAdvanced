"use client";

import { useState } from "react";
import Link from "next/link";
import type { MvpDocsJobSummary } from "@/types/mvp-docs";
import { DOC_LABELS } from "@/types/mvp-docs";
import { Trash2, Eye, Loader2, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface Props {
  job: MvpDocsJobSummary;
  accessToken: string | null;
  onDelete: (id: string) => void;
}

function StatusBadge({ status }: { status: MvpDocsJobSummary["status"] }) {
  switch (status) {
    case "done":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
          <CheckCircle className="h-3 w-3" /> Done
        </span>
      );
    case "running":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-0.5">
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

export function MvpDocsJobCard({ job, accessToken, onDelete }: Props) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!accessToken) return;
    setDeleting(true);
    try {
      await fetch(`/api/mvp-docs/jobs/${job.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      onDelete(job.id);
    } finally {
      setDeleting(false);
    }
  }

  const docList = job.config.targetDocs
    .slice(0, 4)
    .map((d) => DOC_LABELS[d])
    .join(", ");
  const extra = job.config.targetDocs.length > 4
    ? ` +${job.config.targetDocs.length - 4} more`
    : "";

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 flex items-start gap-4 transition-all duration-300 hover:border-indigo-200 hover:shadow-[0_8px_28px_-12px_rgba(99,102,241,0.35)] hover:-translate-y-0.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
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
        <p className="font-display text-base font-semibold text-slate-800 truncate transition-colors group-hover:text-indigo-700">
          {job.config.productName || "Untitled product"}
        </p>
        <p className="text-xs text-slate-400 mt-1 truncate">
          <span className="font-medium text-slate-500">{job.config.targetDocs.length} doc{job.config.targetDocs.length !== 1 ? "s" : ""}</span>
          <span className="mx-1 text-slate-300">·</span>{docList}{extra}
        </p>
        {job.status === "error" && job.error && (
          <p className="text-xs text-red-600 mt-1 truncate">{job.error}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {job.status === "done" && (
          <Link
            href={`/mvp-docs/history/${job.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50"
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
