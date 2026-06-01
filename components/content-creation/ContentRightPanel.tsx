"use client";

import type { ContentCreationJob, ContentCreationConfig } from "@/types/content-creation";
import { PLATFORM_LABELS } from "@/types/content-creation";
import { useContentCreationStore } from "@/store/content-creation-store";
import { RESEARCH_MODELS } from "@/lib/research/models";
import { SidebarCard, Stat } from "@/components/agents-ui/sidebar-primitives";
import {
  FileEdit, Layers, Cpu, Sparkles, Download, Clock, Hash, ListChecks, Lightbulb, Database, Type,
} from "lucide-react";

type Tab = "config" | "agents" | "content";

interface Props {
  activeTab: Tab;
  job: ContentCreationJob | null;
  config: ContentCreationConfig;
  accessToken: string | null;
}

const PHASES = [
  { label: "Analyze topic", sub: "Audience & angles" },
  { label: "Research", sub: "Facts & evidence" },
  { label: "Outline", sub: "Per-platform structure" },
  { label: "Write", sub: "One writer per platform" },
  { label: "Optimize", sub: "Polish & consistency" },
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
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold ${
                current ? "bg-violet-600 text-white" : done ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-400"
              }`}
            >
              {i + 1}
            </span>
            <div>
              <div className={`text-xs font-semibold ${current ? "text-violet-700" : "text-slate-700"}`}>{p.label}</div>
              <div className="text-[10px] text-slate-400">{p.sub}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ContentRightPanel({ activeTab, job, config, accessToken }: Props) {
  const { activePlatform } = useContentCreationStore();

  if (activeTab === "config") {
    return (
      <div className="space-y-4">
        <SidebarCard title="Setup" icon={<FileEdit className="h-3 w-3" />}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Platforms" value={config.targetPlatforms.length} />
            <Stat label="Tone" value={config.tone} />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <Cpu className="h-3.5 w-3.5 text-slate-400" />
            <span className="capitalize">{config.provider}</span>
            <span className="text-slate-300">·</span>
            <span className="truncate">{modelLabel(config.provider, config.model)}</span>
          </div>
          {config.searchMyKB && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <Database className="h-3.5 w-3.5" /> Drawing on your Knowledge Base
            </div>
          )}
        </SidebarCard>
        <SidebarCard title="How it works" icon={<Layers className="h-3 w-3" />}>
          <Pipeline activePhase={0} />
        </SidebarCard>
        <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/60 p-3 text-xs text-amber-700">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>A focused topic and a clear audience produce sharper, more on-brand content.</span>
        </div>
      </div>
    );
  }

  if (activeTab === "agents") {
    const a = (id: string) => job?.agents.find((x) => x.id === id)?.status;
    let phase = 1;
    if (a("topic-analyzer") === "done") phase = 2;
    if (a("researcher") === "done") phase = 3;
    if (a("outline-generator") === "done") phase = 4;
    if (a("optimizer") === "running" || a("optimizer") === "done") phase = 5;
    if (job?.status === "done") phase = 6;
    const ta = job?.topic_analysis;
    const research = job?.research;
    return (
      <div className="space-y-4">
        <SidebarCard title="Pipeline" icon={<Layers className="h-3 w-3" />}>
          <Pipeline activePhase={phase} />
        </SidebarCard>
        {ta || research ? (
          <SidebarCard title="Insights so far" icon={<ListChecks className="h-3 w-3" />}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Concepts" value={ta?.key_concepts.length ?? 0} />
              <Stat label="Angles" value={ta?.unique_angles.length ?? 0} />
              <Stat label="Facts" value={research?.key_facts.length ?? 0} />
              <Stat label="Examples" value={research?.examples.length ?? 0} />
            </div>
          </SidebarCard>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5" /> Topic insights appear here as the first agents finish.
          </div>
        )}
      </div>
    );
  }

  // Content tab
  const pieces = job?.content_pieces ?? [];
  const active = pieces.find((p) => p.platform === activePlatform) ?? pieces[0];
  const bundleMd = `/api/content-creation/export/${job?.id}?format=md&token=${encodeURIComponent(accessToken ?? "")}`;
  const bundleHtml = `/api/content-creation/export/${job?.id}?format=html&token=${encodeURIComponent(accessToken ?? "")}`;

  return (
    <div className="space-y-4">
      <SidebarCard title="Pack" icon={<FileEdit className="h-3 w-3" />}>
        <dl className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Platforms</dt>
            <dd className="font-semibold text-slate-700">{pieces.length}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Tone</dt>
            <dd className="font-medium capitalize text-slate-600">{config.tone}</dd>
          </div>
        </dl>
      </SidebarCard>

      {active && (
        <SidebarCard title="Active piece" icon={<Type className="h-3 w-3" />}>
          <p className="text-sm font-semibold text-slate-800">{PLATFORM_LABELS[active.platform]}</p>
          {active.title && <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-3">{active.title}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {active.metadata.readingTimeMinutes != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                <Clock className="h-3 w-3" />{active.metadata.readingTimeMinutes} min
              </span>
            )}
            {active.metadata.characterCount != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                <Type className="h-3 w-3" />{active.metadata.characterCount} chars
              </span>
            )}
            {active.metadata.hashtags?.length ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                <Hash className="h-3 w-3" />{active.metadata.hashtags.length} tags
              </span>
            ) : null}
          </div>
        </SidebarCard>
      )}

      <SidebarCard title="Export pack" icon={<Download className="h-3 w-3" />}>
        <div className="flex gap-2">
          <a href={bundleMd} download className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-violet-300 hover:text-violet-600">
            <Download className="h-3.5 w-3.5" /> .MD
          </a>
          <a href={bundleHtml} download className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-violet-300 hover:text-violet-600">
            <Download className="h-3.5 w-3.5" /> .HTML
          </a>
        </div>
      </SidebarCard>
    </div>
  );
}
