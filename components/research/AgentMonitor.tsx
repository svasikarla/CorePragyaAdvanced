"use client";

import { useResearchStore } from "@/store/research-store";
import { useResearchSSE } from "@/hooks/use-research-sse";
import AgentStatusRow from "./AgentStatusRow";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface Props {
  accessToken: string | null;
}

export default function AgentMonitor({ accessToken }: Props) {
  const { job, jobId, setActiveTab } = useResearchStore();
  useResearchSSE(jobId, accessToken);

  if (!job) {
    return (
      <div className="flex items-center justify-center h-48">
        <p style={{ color: "var(--cp-research-muted)" }}>
          No active research job. Configure and start one first.
        </p>
      </div>
    );
  }

  const isRunning = job.status === "running" || job.status === "queued";

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg"
        style={{
          backgroundColor: "var(--cp-research-surface)",
          border: "1px solid var(--cp-research-border)",
        }}
      >
        {isRunning ? (
          <Loader2
            size={18}
            className="animate-spin"
            style={{ color: "var(--cp-research-status-running)" }}
          />
        ) : job.status === "done" ? (
          <CheckCircle size={18} style={{ color: "var(--cp-research-status-done)" }} />
        ) : (
          <XCircle size={18} style={{ color: "var(--cp-research-status-error)" }} />
        )}

        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--cp-research-text)" }}
          >
            {job.status === "queued" && "Research queued…"}
            {job.status === "running" && "Research in progress…"}
            {job.status === "done" && "Research complete"}
            {job.status === "error" && "Research failed"}
          </p>
          <p className="text-xs" style={{ color: "var(--cp-research-muted)" }}>
            Topic: {job.config.topic.slice(0, 60)}
            {job.config.topic.length > 60 ? "…" : ""}
          </p>
        </div>

        {job.status === "done" && (
          <button
            onClick={() => setActiveTab("report")}
            className="ml-auto text-xs px-3 py-1.5 rounded font-medium"
            style={{
              backgroundColor: "var(--cp-research-accent)",
              color: "#ffffff",
            }}
          >
            View Report →
          </button>
        )}
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {job.agents.map((agent) => (
          <AgentStatusRow key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Error detail */}
      {job.status === "error" && job.error && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            backgroundColor: "rgba(239,68,68,0.08)",
            color: "#dc2626",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          {job.error}
        </div>
      )}

      {/* Evidence summary when synthesizer is still running */}
      {job.evidence_package && isRunning && (
        <div
          className="px-4 py-3 rounded-lg text-xs"
          style={{
            backgroundColor: "var(--cp-research-panel)",
            border: "1px solid var(--cp-research-border)",
            color: "var(--cp-research-text-secondary)",
          }}
        >
          {job.evidence_package.sub_topics_covered} sub-topics covered ·{" "}
          {job.evidence_package.total_sources} sources collected
        </div>
      )}
    </div>
  );
}
