"use client";

import { CheckCircle, XCircle, Loader2, Circle } from "lucide-react";
import type { AgentState } from "@/types/research";

interface Props {
  agent: AgentState;
}

const STATUS_CONFIG = {
  idle: {
    icon: <Circle size={14} />,
    colour: "var(--cp-research-status-idle)",
    label: "Idle",
  },
  running: {
    icon: <Loader2 size={14} className="animate-spin" />,
    colour: "var(--cp-research-status-running)",
    label: "Running",
  },
  done: {
    icon: <CheckCircle size={14} />,
    colour: "var(--cp-research-status-done)",
    label: "Done",
  },
  error: {
    icon: <XCircle size={14} />,
    colour: "var(--cp-research-status-error)",
    label: "Error",
  },
};

export default function AgentStatusRow({ agent }: Props) {
  const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.idle;

  if (agent.status === "idle" && agent.note === "not needed") return null;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-lg"
      style={{
        backgroundColor: "var(--cp-research-panel)",
        border: "1px solid var(--cp-research-border)",
      }}
    >
      {/* Status icon */}
      <div className="mt-0.5 shrink-0" style={{ color: cfg.colour }}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--cp-research-text)" }}
          >
            {agent.name}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${cfg.colour}22`,
              color: cfg.colour,
            }}
          >
            {cfg.label}
          </span>
        </div>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: "var(--cp-research-muted)" }}
        >
          {agent.role}
        </p>
        {agent.note && (
          <p
            className="text-xs mt-1"
            style={{ color: "var(--cp-research-text-secondary)" }}
          >
            {agent.note}
          </p>
        )}
      </div>

      {/* Timing */}
      {agent.completed_at && agent.started_at && (
        <div className="shrink-0 text-right">
          <span
            className="text-xs"
            style={{ color: "var(--cp-research-muted)" }}
          >
            {(
              (new Date(agent.completed_at).getTime() -
                new Date(agent.started_at).getTime()) /
              1000
            ).toFixed(1)}
            s
          </span>
        </div>
      )}
    </div>
  );
}
