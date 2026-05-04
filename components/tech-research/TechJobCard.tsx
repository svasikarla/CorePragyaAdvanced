"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { TechJobSummary } from "@/types/tech-research";
import {
  CheckCircle,
  Loader2,
  Clock,
  AlertCircle,
  Trash2,
  Eye,
  Download,
  ExternalLink,
} from "lucide-react";

interface Props {
  job: TechJobSummary;
  accessToken: string | null;
  onDelete: (id: string) => void;
}

function StatusBadge({ status }: { status: TechJobSummary["status"] }) {
  const map: Record<string, { icon: React.ElementType; color: string; label: string; spin?: boolean }> = {
    queued: { icon: Clock, color: "text-slate-500 bg-slate-100", label: "Queued" },
    running: { icon: Loader2, color: "text-sky-600 bg-sky-50", label: "Running", spin: true },
    done: { icon: CheckCircle, color: "text-green-600 bg-green-50", label: "Done" },
    error: { icon: AlertCircle, color: "text-red-600 bg-red-50", label: "Error" },
  };
  const { icon: Icon, color, label, spin } = map[status] ?? map.queued!;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      <Icon className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

export function TechJobCard({ job, accessToken, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!accessToken) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }

    setIsDeleting(true);
    try {
      await fetch(`/api/tech-research/jobs/${job.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      onDelete(job.id);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  const isDone = job.status === "done";
  const isActive = job.status === "running" || job.status === "queued";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={job.status} />
            <span className="text-xs text-slate-400">
              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
            </span>
          </div>

          <p className="text-sm font-semibold text-slate-800 line-clamp-2 mb-2">
            {job.config.requirement}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
              {job.config.model}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 capitalize">
              {job.config.depth.replace("tier", "Tier ")}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 capitalize">
              {job.config.focus_area.replace(/_/g, " ")}
            </span>
            {job.config.current_stack && (
              <span className="rounded bg-sky-50 px-2 py-0.5 text-sky-700 max-w-[200px] truncate">
                {job.config.current_stack}
              </span>
            )}
          </div>

          {job.status === "error" && job.error && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
              {job.error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDone && (
            <>
              <Link
                href={`/tech-research/history/${job.id}`}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-600 transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </Link>
              {accessToken && (
                <a
                  href={`/api/tech-research/report/${job.id}/download?format=${job.config.format}&token=${encodeURIComponent(accessToken)}`}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-600 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  {job.config.format.toUpperCase()}
                </a>
              )}
            </>
          )}
          {isActive && (
            <Link
              href="/tech-research"
              className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-100 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Monitor
            </Link>
          )}
          {!isActive && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                confirmDelete
                  ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                  : "border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500"
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmDelete ? "Confirm" : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
