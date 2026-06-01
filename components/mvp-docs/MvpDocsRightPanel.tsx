"use client";

import type { MvpDocsJob, MvpDocsConfig } from "@/types/mvp-docs";
import { DOC_GROUP, DOC_LABELS } from "@/types/mvp-docs";
import { useMvpDocsStore } from "@/store/mvp-docs-store";
import { RESEARCH_MODELS } from "@/lib/research/models";
import {
  FileStack, Layers, Cpu, ListChecks, Sparkles, Download, Clock, AlignLeft,
  ShieldCheck, Lightbulb, Database,
} from "lucide-react";

type Tab = "config" | "agents" | "documents";

interface Props {
  activeTab: Tab;
  job: MvpDocsJob | null;
  config: MvpDocsConfig;
  accessToken: string | null;
}

function modelLabel(provider: string, model: string): string {
  const list = RESEARCH_MODELS[provider as keyof typeof RESEARCH_MODELS] ?? [];
  return (list as readonly { id: string; label: string }[]).find((m) => m.id === model)?.label ?? model;
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
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

function Pipeline({ activePhase }: { activePhase: 0 | 1 | 2 | 3 }) {
  const phases = [
    { Icon: ListChecks, label: "Analyze brief", sub: "Shared source of truth" },
    { Icon: Cpu, label: "Draft documents", sub: "One agent per doc, in parallel" },
    { Icon: ShieldCheck, label: "Consistency check", sub: "Cross-document review" },
  ];
  return (
    <ol className="space-y-2.5">
      {phases.map((p, i) => {
        const done = activePhase > i + 1;
        const current = activePhase === i + 1;
        return (
          <li key={p.label} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                current ? "bg-indigo-600 text-white" : done ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
              }`}
            >
              <p.Icon className="h-3.5 w-3.5" />
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

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-center">
      <div className="text-lg font-bold tabular-nums text-slate-800">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

export function MvpDocsRightPanel({ activeTab, job, config, accessToken }: Props) {
  const { activeDocType } = useMvpDocsStore();

  // ── Configure ──────────────────────────────────────────────────────────────
  if (activeTab === "config") {
    const productCount = config.targetDocs.filter((d) => DOC_GROUP[d] === "product").length;
    const engCount = config.targetDocs.filter((d) => DOC_GROUP[d] === "engineering").length;
    return (
      <div className="space-y-4">
        <Card title="Selection" icon={<FileStack className="h-3 w-3" />}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Total" value={config.targetDocs.length} />
            <Stat label="Product" value={productCount} />
            <Stat label="Eng" value={engCount} />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <Cpu className="h-3.5 w-3.5 text-slate-400" />
            <span className="capitalize">{config.provider}</span>
            <span className="text-slate-300">·</span>
            <span className="truncate">{modelLabel(config.provider, config.model)}</span>
          </div>
          {config.searchMyKB && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <Database className="h-3.5 w-3.5" />
              Grounded in your Knowledge Base
            </div>
          )}
        </Card>

        <Card title="How it works" icon={<Layers className="h-3 w-3" />}>
          <Pipeline activePhase={0} />
        </Card>

        <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/60 p-3 text-xs text-amber-700">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>A richer brief yields sharper, more consistent docs. Name the problem, the users, and any constraints.</span>
        </div>
      </div>
    );
  }

  // ── Generate (Live Progress) ───────────────────────────────────────────────
  if (activeTab === "agents") {
    const brief = job?.brief_analysis;
    let activePhase: 0 | 1 | 2 | 3 = 1;
    if (job?.status === "done") activePhase = 3;
    else if (brief) {
      const consistencyAgent = job?.agents.find((a) => a.id === "consistency-checker");
      activePhase = consistencyAgent?.status === "running" || consistencyAgent?.status === "done" ? 3 : 2;
    }
    return (
      <div className="space-y-4">
        <Card title="Pipeline" icon={<Layers className="h-3 w-3" />}>
          <Pipeline activePhase={activePhase} />
        </Card>

        {brief ? (
          <Card title="Brief analysis" icon={<ListChecks className="h-3 w-3" />}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Features" value={brief.core_features.length} />
              <Stat label="Personas" value={brief.target_users.length} />
              <Stat label="Constraints" value={brief.key_constraints.length} />
              <Stat label="Out of scope" value={brief.out_of_scope.length} />
            </div>
            {brief.product_summary && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 line-clamp-4">{brief.product_summary}</p>
            )}
          </Card>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5" />
            Brief analysis will appear here as the first agent finishes.
          </div>
        )}
      </div>
    );
  }

  // ── Review (Documents) ─────────────────────────────────────────────────────
  const documents = job?.documents ?? [];
  const active = documents.find((d) => d.docType === activeDocType) ?? documents[0];
  const report = job?.consistency_report;
  const consistencyColor =
    report?.overall_consistency === "high"
      ? "text-green-600"
      : report?.overall_consistency === "medium"
      ? "text-amber-600"
      : "text-red-600";

  const bundleMd = `/api/mvp-docs/export/${job?.id}?format=md&token=${encodeURIComponent(accessToken ?? "")}`;
  const bundleHtml = `/api/mvp-docs/export/${job?.id}?format=html&token=${encodeURIComponent(accessToken ?? "")}`;

  return (
    <div className="space-y-4">
      <Card title="Bundle" icon={<FileStack className="h-3 w-3" />}>
        <p className="text-sm font-semibold text-slate-800 truncate">{config.productName || "Untitled product"}</p>
        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Documents</dt>
            <dd className="font-semibold text-slate-700">{documents.length}</dd>
          </div>
          {report && (
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Consistency</dt>
              <dd className={`font-bold ${consistencyColor}`}>{report.overall_consistency.toUpperCase()}</dd>
            </div>
          )}
          {config.targetAudience && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400 shrink-0">Audience</dt>
              <dd className="font-medium text-slate-600 truncate text-right">{config.targetAudience}</dd>
            </div>
          )}
          {job?.created_at && (
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Generated</dt>
              <dd className="font-medium text-slate-600">{new Date(job.created_at).toLocaleDateString()}</dd>
            </div>
          )}
        </dl>
      </Card>

      {active && (
        <Card title="Active document" icon={<AlignLeft className="h-3 w-3" />}>
          <p className="text-sm font-semibold text-slate-800">{DOC_LABELS[active.docType]}</p>
          {active.metadata.summary && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-4">{active.metadata.summary}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {active.metadata.wordCount != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                <Clock className="h-3 w-3" />
                {active.metadata.wordCount} words
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
              <FileStack className="h-3 w-3" />
              {documents.length} in bundle
            </span>
          </div>
        </Card>
      )}

      <Card title="Export bundle" icon={<Download className="h-3 w-3" />}>
        <div className="flex gap-2">
          <a href={bundleMd} download className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600">
            <Download className="h-3.5 w-3.5" /> .MD
          </a>
          <a href={bundleHtml} download className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600">
            <Download className="h-3.5 w-3.5" /> .HTML
          </a>
        </div>
      </Card>
    </div>
  );
}
