"use client";

import type { ReactNode, ComponentType } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";

// Shared building blocks for the contextual sidebars used by the multi-agent
// features (research, tech-research, content-creation, mvp-docs).

export type StepState = "current" | "done" | "error" | "idle";

export interface JourneyStep {
  key: string;
  label: string;
  sub?: string;
  state: StepState;
  Icon: ComponentType<{ className?: string }>;
  spinning?: boolean;
}

export function JourneyRail({ steps }: { steps: JourneyStep[] }) {
  return (
    <div>
      <h3 className="px-2 mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Journey</h3>
      <ol className="relative space-y-1">
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1;
          return (
            <li key={s.key} className="relative flex items-center gap-3 px-2 py-1.5">
              {!isLast && (
                <span
                  className={`absolute left-[19px] top-9 h-[calc(100%-12px)] w-px ${
                    s.state === "done" ? "bg-indigo-300" : "bg-slate-200"
                  }`}
                />
              )}
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 transition-colors ${
                  s.state === "current"
                    ? "bg-indigo-600 text-white ring-indigo-600"
                    : s.state === "done"
                    ? "bg-indigo-100 text-indigo-600 ring-indigo-200"
                    : s.state === "error"
                    ? "bg-red-100 text-red-600 ring-red-200"
                    : "bg-white text-slate-300 ring-slate-200"
                }`}
              >
                {s.state === "done" ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : s.state === "current" && s.spinning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : s.state === "error" ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <s.Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0">
                <div
                  className={`text-sm font-medium ${
                    s.state === "current"
                      ? "text-indigo-700"
                      : s.state === "done"
                      ? "text-slate-700"
                      : s.state === "error"
                      ? "text-red-600"
                      : "text-slate-400"
                  }`}
                >
                  {s.label}
                </div>
                {s.sub && <div className="text-[10px] text-slate-400">{s.sub}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function SidebarCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-center">
      <div className="text-lg font-bold tabular-nums text-slate-800">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

export interface OutlineItem {
  key: string;
  label: string;
  dotClass?: string; // e.g. "bg-indigo-400"
}

export function OutlineList({
  title,
  icon,
  items,
  activeKey,
  onSelect,
}: {
  title: string;
  icon?: ReactNode;
  items: OutlineItem[];
  activeKey?: string | null;
  onSelect?: (key: string) => void;
}) {
  if (items.length === 0) return null;
  const interactive = !!onSelect;
  return (
    <div className="border-t border-slate-100 pt-4">
      <h3 className="px-2 mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {icon}
        {title}
      </h3>
      <div className="space-y-0.5">
        {items.map((it) => {
          const isActive = interactive && activeKey === it.key;
          return (
            <button
              key={it.key}
              type="button"
              disabled={!interactive}
              onClick={() => onSelect?.(it.key)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                isActive
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : interactive
                  ? "text-slate-600 hover:bg-slate-100"
                  : "text-slate-500"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.dotClass ?? "bg-slate-300"}`} />
              <span className="truncate">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Helper: standard 3-step journey state from a feature's tab + job status.
export function computeAgentSteps(opts: {
  activeTab: "config" | "agents" | string;
  outputTab: string; // e.g. "report" | "content"
  hasJob: boolean;
  status?: "queued" | "running" | "done" | "error";
  outputReady: boolean;
}): { config: StepState; agents: StepState; output: StepState } {
  const { activeTab, outputTab, hasJob, status, outputReady } = opts;
  const config: StepState = activeTab === "config" ? "current" : "done";
  let agents: StepState;
  if (activeTab === "agents") agents = status === "error" ? "error" : "current";
  else if (status === "error") agents = "error";
  else if (status === "done" || outputReady) agents = "done";
  else if (hasJob) agents = "idle";
  else agents = "idle";
  let output: StepState;
  if (activeTab === outputTab) output = "current";
  else if (outputReady) output = "done";
  else output = "idle";
  return { config, agents, output };
}
