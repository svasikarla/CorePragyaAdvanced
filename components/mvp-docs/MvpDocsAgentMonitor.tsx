"use client";

import type { MvpDocsJob } from "@/types/mvp-docs";
import type { AgentState } from "@/types/research";
import { CheckCircle, Circle, Loader2, AlertCircle } from "lucide-react";

interface Props {
  job: MvpDocsJob | null;
}

function statusIcon(status: AgentState["status"]) {
  switch (status) {
    case "done":
      return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-indigo-500 animate-spin shrink-0" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    default:
      return <Circle className="h-4 w-4 text-slate-300 shrink-0" />;
  }
}

function jobStatusLabel(status: MvpDocsJob["status"]) {
  switch (status) {
    case "queued":   return { text: "Queued",   color: "bg-slate-100 text-slate-600" };
    case "running":  return { text: "Running",  color: "bg-indigo-50 text-indigo-700" };
    case "done":     return { text: "Complete", color: "bg-green-50 text-green-700" };
    case "error":    return { text: "Error",    color: "bg-red-50 text-red-700" };
  }
}

export function MvpDocsAgentMonitor({ job }: Props) {
  if (!job) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Start a documentation build to see agent progress here.
      </div>
    );
  }

  const label = jobStatusLabel(job.status);
  const doneCount = job.agents.filter((a) => a.status === "done").length;
  const progress = job.agents.length > 0
    ? Math.round((doneCount / job.agents.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`flex items-center justify-between rounded-2xl px-4 py-3.5 ring-1 ring-inset ring-black/[0.03] ${label.color}`}>
        <div className="flex items-center gap-2">
          {job.status === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
          <span className="text-sm font-semibold">{label.text}</span>
          {job.status === "running" && (
            <span className="text-sm opacity-70">
              — {doneCount} of {job.agents.length} agents complete
            </span>
          )}
          {job.status === "done" && (
            <span className="text-sm opacity-70">— Documentation bundle ready</span>
          )}
        </div>
        <span className="text-base font-bold tabular-nums">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        >
          {job.status === "running" && (
            <span className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)] bg-[length:200%_100%] animate-shimmer" />
          )}
        </div>
      </div>

      {/* Agent rows */}
      <div className="space-y-2">
        {job.agents.map((agent, i) => (
          <div
            key={agent.id}
            style={{ animationDelay: `${i * 55}ms` }}
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-300 animate-count-up ${
              agent.status === "running"
                ? "border-indigo-200 bg-indigo-50 animate-pulse-glow"
                : agent.status === "done"
                ? "border-green-100 bg-green-50/50"
                : agent.status === "error"
                ? "border-red-200 bg-red-50"
                : "border-slate-100 bg-white"
            }`}
          >
            {statusIcon(agent.status)}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">{agent.name}</div>
              <div className="text-xs text-slate-500 truncate">{agent.role}</div>
            </div>
            {agent.note && (
              <span className={`text-xs shrink-0 max-w-[200px] truncate rounded-full px-2 py-0.5 ${
                agent.status === "done"
                  ? "bg-green-100/70 text-green-700"
                  : agent.status === "error"
                  ? "bg-red-100/70 text-red-700"
                  : "text-slate-500"
              }`}>
                {agent.note}
              </span>
            )}
          </div>
        ))}
      </div>

      {job.status === "error" && job.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Error:</strong> {job.error}
        </div>
      )}
    </div>
  );
}
