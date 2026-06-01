"use client";

import type { ResearchJob, ResearchConfig } from "@/types/research";
import { RESEARCH_MODELS } from "@/lib/research/models";
import { SidebarCard, Stat } from "@/components/agents-ui/sidebar-primitives";
import { FlaskConical, Layers, Cpu, Sparkles, ListChecks, Database, FileText, Lightbulb } from "lucide-react";

type Tab = "config" | "agents" | "report";

interface Props {
  activeTab: Tab;
  job: ResearchJob | null;
  config: ResearchConfig;
}

const DEPTH_LABEL: Record<string, string> = { tier1: "Quick", tier2: "Standard", tier3: "Deep" };

const PHASES = [
  { label: "Plan sub-topics", sub: "Decompose the question" },
  { label: "Gather evidence", sub: "Web search & sourcing" },
  { label: "Synthesize", sub: "Cross-cut & resolve" },
  { label: "Draft report", sub: "Structured write-up" },
];

function modelLabel(provider: string, model: string): string {
  const list = RESEARCH_MODELS[provider as keyof typeof RESEARCH_MODELS] ?? [];
  return (list as readonly { id: string; label: string }[]).find((m) => m.id === model)?.label ?? model;
}

function Pipeline({ activePhase }: { activePhase: number }) {
  return (
    <ol className="space-y-2.5">
      {PHASES.map((p, i) => {
        const done = activePhase > i + 1;
        const current = activePhase === i + 1;
        return (
          <li key={p.label} className="flex items-start gap-2.5">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold ${current ? "bg-indigo-600 text-white" : done ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"}`}>
              {i + 1}
            </span>
            <div>
              <div className={`text-xs font-semibold ${current ? "text-indigo-700" : "text-slate-700"}`}>{p.label}</div>
              <div className="text-[10px] text-slate-400">{p.sub}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ResearchRightPanel({ activeTab, job, config }: Props) {
  if (activeTab === "config") {
    return (
      <div className="space-y-4">
        <SidebarCard title="Setup" icon={<FlaskConical className="h-3 w-3" />}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Depth" value={DEPTH_LABEL[config.depth] ?? config.depth} />
            <Stat label="Audience" value={config.audience} />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <Cpu className="h-3.5 w-3.5 text-slate-400" />
            <span className="capitalize">{config.provider}</span>
            <span className="text-slate-300">·</span>
            <span className="truncate">{modelLabel(config.provider, config.model)}</span>
          </div>
          {config.searchMyKB && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <Database className="h-3.5 w-3.5" /> Augmented with your Knowledge Base
            </div>
          )}
        </SidebarCard>
        <SidebarCard title="How it works" icon={<Layers className="h-3 w-3" />}>
          <Pipeline activePhase={0} />
        </SidebarCard>
        <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/60 p-3 text-xs text-amber-700">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>A specific, well-scoped question yields more decisive findings than a broad one.</span>
        </div>
      </div>
    );
  }

  if (activeTab === "agents") {
    const ev = job?.evidence_package;
    let phase = 1;
    if (job?.status === "running") phase = 2;
    if (ev) phase = 3;
    if (job?.report) phase = 4;
    if (job?.status === "done") phase = 5;
    return (
      <div className="space-y-4">
        <SidebarCard title="Pipeline" icon={<Layers className="h-3 w-3" />}>
          <Pipeline activePhase={phase} />
        </SidebarCard>
        {ev ? (
          <SidebarCard title="Evidence gathered" icon={<ListChecks className="h-3 w-3" />}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Sources" value={ev.total_sources} />
              <Stat label="Primary" value={ev.primary_sources} />
              <Stat label="Sub-topics" value={ev.sub_topics_covered} />
              <Stat label="Conflicts" value={ev.contradictions.length} />
            </div>
          </SidebarCard>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5" /> Evidence stats appear here as sources are gathered.
          </div>
        )}
      </div>
    );
  }

  // Report tab
  const report = job?.report;
  if (!report) return null;
  return (
    <div className="space-y-4">
      <SidebarCard title="Report" icon={<FileText className="h-3 w-3" />}>
        <p className="text-sm font-semibold text-slate-800 line-clamp-2">{report.topic}</p>
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between"><dt className="text-slate-400">Sections</dt><dd className="font-semibold text-slate-700">{report.sections.length}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-slate-400">Sources</dt><dd className="font-semibold text-slate-700">{report.source_index.length}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-slate-400">Audience</dt><dd className="font-medium capitalize text-slate-600">{report.config.audience}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-slate-400">Generated</dt><dd className="font-medium text-slate-600">{new Date(report.generated_at).toLocaleDateString()}</dd></div>
        </dl>
      </SidebarCard>
      <SidebarCard title="Takeaways" icon={<ListChecks className="h-3 w-3" />}>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Actions" value={report.recommended_actions.length} />
          <Stat label="Insights" value={report.cross_cutting_insights.length} />
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Download options are in the report toolbar.</p>
      </SidebarCard>
    </div>
  );
}
