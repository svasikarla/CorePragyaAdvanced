"use client";

import type { MvpDocsJob, MvpDocsConfig, DocType } from "@/types/mvp-docs";
import { DOC_LABELS, DOC_GROUP, PRODUCT_DOC_TYPES, ENGINEERING_DOC_TYPES } from "@/types/mvp-docs";
import { useMvpDocsStore } from "@/store/mvp-docs-store";
import { Check, Loader2, AlertCircle, Settings2, Cpu, FileCheck2, Circle } from "lucide-react";

type Tab = "config" | "agents" | "documents";
type StepState = "current" | "done" | "error" | "idle";

interface Props {
  activeTab: Tab;
  job: MvpDocsJob | null;
  config: MvpDocsConfig;
}

const STEPS: { key: Tab; label: string; Icon: typeof Settings2 }[] = [
  { key: "config", label: "Configure", Icon: Settings2 },
  { key: "agents", label: "Generate", Icon: Cpu },
  { key: "documents", label: "Review", Icon: FileCheck2 },
];

function stepState(step: Tab, activeTab: Tab, job: MvpDocsJob | null): StepState {
  if (step === activeTab) return job?.status === "error" && step === "agents" ? "error" : "current";
  if (step === "config") return "done";
  if (step === "agents") {
    if (job?.status === "error") return "error";
    if (job?.status === "done") return "done";
    return "idle";
  }
  // documents
  return job?.status === "done" ? "done" : "idle";
}

export function MvpDocsLeftRail({ activeTab, job, config }: Props) {
  const { activeDocType, setActiveDocType } = useMvpDocsStore();
  const documents = job?.documents ?? [];

  // Outline (Review): clickable generated docs. Otherwise: the selected doc plan.
  const showOutline = activeTab === "documents" && documents.length > 0;
  const outlineTypes: DocType[] = showOutline
    ? documents.map((d) => d.docType)
    : config.targetDocs;

  const productTypes = outlineTypes.filter((d) => DOC_GROUP[d] === "product");
  const engineeringTypes = outlineTypes.filter((d) => DOC_GROUP[d] === "engineering");

  function OutlineGroup({ label, types }: { label: string; types: DocType[] }) {
    if (types.length === 0) return null;
    return (
      <div className="mb-3">
        <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <div className="space-y-0.5">
          {types.map((d) => {
            const isActive = showOutline && activeDocType === d;
            return (
              <button
                key={d}
                type="button"
                disabled={!showOutline}
                onClick={() => showOutline && setActiveDocType(d)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? "bg-indigo-50 font-semibold text-indigo-700"
                    : showOutline
                    ? "text-slate-600 hover:bg-slate-100"
                    : "text-slate-500"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    DOC_GROUP[d] === "product" ? "bg-indigo-400" : "bg-emerald-400"
                  }`}
                />
                <span className="truncate">{DOC_LABELS[d]}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Journey stepper */}
      <div>
        <h3 className="px-2 mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Journey</h3>
        <ol className="relative space-y-1">
          {STEPS.map((s, i) => {
            const state = stepState(s.key, activeTab, job);
            const isLast = i === STEPS.length - 1;
            return (
              <li key={s.key} className="relative flex items-center gap-3 px-2 py-1.5">
                {!isLast && (
                  <span
                    className={`absolute left-[19px] top-9 h-[calc(100%-12px)] w-px ${
                      state === "done" ? "bg-indigo-300" : "bg-slate-200"
                    }`}
                  />
                )}
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 transition-colors ${
                    state === "current"
                      ? "bg-indigo-600 text-white ring-indigo-600"
                      : state === "done"
                      ? "bg-indigo-100 text-indigo-600 ring-indigo-200"
                      : state === "error"
                      ? "bg-red-100 text-red-600 ring-red-200"
                      : "bg-white text-slate-300 ring-slate-200"
                  }`}
                >
                  {state === "done" ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : state === "current" && s.key === "agents" && job?.status === "running" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : state === "error" ? (
                    <AlertCircle className="h-3.5 w-3.5" />
                  ) : (
                    <s.Icon className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      state === "current"
                        ? "text-indigo-700"
                        : state === "done"
                        ? "text-slate-700"
                        : state === "error"
                        ? "text-red-600"
                        : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {s.key === "config" && `${config.targetDocs.length} docs selected`}
                    {s.key === "agents" &&
                      (job?.status === "running"
                        ? "In progress…"
                        : job?.status === "done"
                        ? "Complete"
                        : job?.status === "error"
                        ? "Failed"
                        : "Pending")}
                    {s.key === "documents" &&
                      (documents.length ? `${documents.length} ready` : "Pending")}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Outline / plan */}
      <div className="border-t border-slate-100 pt-4">
        <h3 className="px-2 mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {showOutline ? <FileCheck2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
          {showOutline ? "Outline" : "Document plan"}
        </h3>
        <OutlineGroup label="Product & Business" types={productTypes} />
        <OutlineGroup label="Engineering & Technical" types={engineeringTypes} />
      </div>
    </div>
  );
}
