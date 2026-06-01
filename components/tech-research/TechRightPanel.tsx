"use client";

import type { TechResearchJob, TechResearchConfig } from "@/types/tech-research";
import { TECH_RESEARCH_MODELS } from "@/lib/tech-research/models";
import { SidebarCard, Stat } from "@/components/agents-ui/sidebar-primitives";
import { Cpu, Layers, Sparkles, ListChecks, Database, FileText, Lightbulb, Trophy } from "lucide-react";

type Tab = "config" | "agents" | "report";

interface Props {
  activeTab: Tab;
  job: TechResearchJob | null;
  config: TechResearchConfig;
}

const FOCUS_LABEL: Record<string, string> = {
  frontend: "Frontend", backend: "Backend", database: "Database", infrastructure: "Infra",
  security: "Security", mobile: "Mobile", ai_ml: "AI/ML", general: "General",
};
const DEPTH_LABEL: Record<string, string> = { tier1: "Quick", tier2: "Standard", tier3: "Deep" };

const PHASES = [
  { label: "Analyze requirement", sub: "Functional & NFRs" },
  { label: "Scan solutions", sub: "Candidate landscape" },
  { label: "Evaluate", sub: "Metrics & evidence" },
  { label: "Trade-offs", sub: "Weighted matrix" },
  { label: "Architecture", sub: "Blueprint & phases" },
];

function modelLabel(provider: string, model: string): string {
  const list = TECH_RESEARCH_MODELS[provider as keyof typeof TECH_RESEARCH_MODELS] ?? [];
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

export function TechRightPanel({ activeTab, job, config }: Props) {
  if (activeTab === "config") {
    return (
      <div className="space-y-4">
        <SidebarCard title="Setup" icon={<Cpu className="h-3 w-3" />}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Focus" value={FOCUS_LABEL[config.focus_area] ?? config.focus_area} />
            <Stat label="Depth" value={DEPTH_LABEL[config.depth] ?? config.depth} />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <Cpu className="h-3.5 w-3.5 text-slate-400" />
            <span className="capitalize">{config.provider}</span>
            <span className="text-slate-300">·</span>
            <span className="truncate">{modelLabel(config.provider, config.model)}</span>
          </div>
          {config.current_stack && (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Stack:</span> {config.current_stack}
            </div>
          )}
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
          <span>State the requirement and your current stack — compatibility is weighed into the recommendation.</span>
        </div>
      </div>
    );
  }

  if (activeTab === "agents") {
    let phase = 1;
    if (job?.requirement_analysis) phase = 2;
    if (job?.solution_landscape) phase = 3;
    if (job?.evaluations?.length) phase = 4;
    if (job?.tradeoff_matrix) phase = 5;
    if (job?.report || job?.status === "done") phase = 6;
    const hasData = job?.requirement_analysis || job?.solution_landscape || job?.evaluations?.length;
    return (
      <div className="space-y-4">
        <SidebarCard title="Pipeline" icon={<Layers className="h-3 w-3" />}>
          <Pipeline activePhase={phase} />
        </SidebarCard>
        {hasData ? (
          <SidebarCard title="Findings so far" icon={<ListChecks className="h-3 w-3" />}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Requirements" value={job?.requirement_analysis?.functional.length ?? 0} />
              <Stat label="Candidates" value={job?.solution_landscape?.candidates.length ?? 0} />
              <Stat label="Evaluated" value={job?.evaluations?.length ?? 0} />
              <Stat label="Questions" value={job?.requirement_analysis?.open_questions.length ?? 0} />
            </div>
          </SidebarCard>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5" /> Findings appear here as each agent completes.
          </div>
        )}
      </div>
    );
  }

  // Report tab
  const report = job?.report;
  if (!report) return null;
  const matrix = report.tradeoff_matrix;
  return (
    <div className="space-y-4">
      <SidebarCard title="Recommendation" icon={<Trophy className="h-3 w-3" />}>
        <p className="text-sm font-semibold text-slate-800">{matrix.winner}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
            {matrix.confidence} confidence
          </span>
          {matrix.runner_up && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
              vs {matrix.runner_up}
            </span>
          )}
        </div>
      </SidebarCard>
      <SidebarCard title="Report" icon={<FileText className="h-3 w-3" />}>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Evaluated" value={report.evaluations.length} />
          <Stat label="Sources" value={report.source_index.length} />
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Download options are in the report toolbar.</p>
      </SidebarCard>
    </div>
  );
}
