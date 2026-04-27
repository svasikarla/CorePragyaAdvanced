"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  Trash2,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle,
  Hourglass,
  Activity,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { JobSummary } from "@/types/research";

interface Props {
  job: JobSummary;
  onDeleted: (id: string) => void;
}

const DEPTH_LABELS: Record<string, string> = {
  tier1: "Quick",
  tier2: "Standard",
  tier3: "Deep",
};
const AUDIENCE_LABELS: Record<string, string> = {
  executive: "Executive",
  technical: "Technical",
  analyst: "Analyst",
  client: "Client",
  board: "Board",
};
const FORMAT_LABELS: Record<string, string> = {
  md: "Markdown",
  html: "HTML",
  docx: "Word",
};

function StatusBadge({ status }: { status: JobSummary["status"] }) {
  const map = {
    queued: {
      icon: <Hourglass size={11} />,
      label: "Queued",
      cls: "bg-slate-100 text-slate-600",
    },
    running: {
      icon: <Activity size={11} className="animate-pulse" />,
      label: "Running",
      cls: "bg-amber-100 text-amber-700",
    },
    done: {
      icon: <CheckCircle size={11} />,
      label: "Done",
      cls: "bg-green-100 text-green-700",
    },
    error: {
      icon: <AlertCircle size={11} />,
      label: "Error",
      cls: "bg-red-100 text-red-700",
    },
  };
  const { icon, label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}

export default function JobCard({ job, onDeleted }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isDone = job.status === "done";
  const isActive = job.status === "running" || job.status === "queued";

  async function handleDownload() {
    setDownloading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/research/report/${job.id}/download`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "research-report";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/research/jobs/${job.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok || res.status === 204) {
        onDeleted(job.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  const createdAt = new Date(job.created_at);
  const relativeTime = formatRelative(createdAt);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Left: topic + metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={job.status} />
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={10} />
              {relativeTime}
            </span>
          </div>

          <h3 className="text-sm font-semibold text-slate-800 truncate leading-snug">
            {job.config.topic}
          </h3>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
            <span className="text-xs text-slate-500">
              {job.config.model}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {DEPTH_LABELS[job.config.depth] ?? job.config.depth}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {AUDIENCE_LABELS[job.config.audience] ?? job.config.audience}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {FORMAT_LABELS[job.config.format] ?? job.config.format}
            </span>
          </div>

          {job.status === "error" && job.error && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1 truncate">
              {job.error}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isDone && (
            <>
              <Link
                href={`/research/history/${job.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <FileText size={13} />
                View
              </Link>

              <button
                onClick={handleDownload}
                disabled={downloading}
                title={`Download ${FORMAT_LABELS[job.config.format]}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                {FORMAT_LABELS[job.config.format]}
              </button>
            </>
          )}

          {isActive && (
            <Link
              href="/research"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <Activity size={13} />
              Monitor
            </Link>
          )}

          {!isActive && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title={deleteConfirm ? "Click again to confirm" : "Delete"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                deleteConfirm
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600"
              }`}
            >
              {deleting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
              {deleteConfirm ? "Confirm" : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
