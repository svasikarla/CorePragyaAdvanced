"use client";

import type { ContentCreationJob } from "@/types/content-creation";
import type { AgentState } from "@/types/research";
import { CheckCircle, Circle, Loader2, AlertCircle } from "lucide-react";

interface Props {
  job: ContentCreationJob | null;
}

function statusIcon(status: AgentState["status"]) {
  switch (status) {
    case "done":
      return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-violet-500 animate-spin shrink-0" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    default:
      return <Circle className="h-4 w-4 text-slate-300 shrink-0" />;
  }
}

function jobStatusLabel(status: ContentCreationJob["status"]) {
  switch (status) {
    case "queued":   return { text: "Queued",   color: "bg-slate-100 text-slate-600" };
    case "running":  return { text: "Running",  color: "bg-violet-50 text-violet-700" };
    case "done":     return { text: "Complete", color: "bg-green-50 text-green-700" };
    case "error":    return { text: "Error",    color: "bg-red-50 text-red-700" };
  }
}

export function ContentAgentMonitor({ job }: Props) {
  if (!job) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Start a content creation job to see agent progress here.
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
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${label.color}`}>
        <div className="flex items-center gap-2">
          {job.status === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
          <span className="text-sm font-semibold">{label.text}</span>
          {job.status === "running" && (
            <span className="text-sm opacity-70">
              — {doneCount} of {job.agents.length} agents complete
            </span>
          )}
          {job.status === "done" && (
            <span className="text-sm opacity-70">— All content generated</span>
          )}
        </div>
        <span className="text-sm font-semibold">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Agent rows */}
      <div className="space-y-2">
        {job.agents.map((agent) => (
          <div
            key={agent.id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              agent.status === "running"
                ? "border-violet-200 bg-violet-50"
                : agent.status === "done"
                ? "border-green-100 bg-green-50/40"
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
              <span className="text-xs text-slate-500 shrink-0 max-w-[180px] truncate">
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
