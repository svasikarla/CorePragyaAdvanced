"use client";

import { useMvpDocsStore } from "@/store/mvp-docs-store";
import {
  DOC_LABELS,
  DOC_DESCRIPTIONS,
  PRODUCT_DOC_TYPES,
  ENGINEERING_DOC_TYPES,
} from "@/types/mvp-docs";
import type { DocType } from "@/types/mvp-docs";
import type { Provider } from "@/types/research";
import { RESEARCH_MODELS } from "@/lib/research/models";
import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

interface Props {
  onSubmit: (token: string) => void;
  accessToken: string | null;
  isLoading: boolean;
}

function DocGroupGrid({
  title,
  docTypes,
  selected,
  onToggle,
  onSelectAll,
}: {
  title: string;
  docTypes: DocType[];
  selected: DocType[];
  onToggle: (d: DocType) => void;
  onSelectAll: () => void;
}) {
  const allSelected = docTypes.every((d) => selected.includes(d));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h4>
        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          {allSelected ? "Clear group" : "Select all"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {docTypes.map((d, i) => {
          const isSelected = selected.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onToggle(d)}
              style={{ animationDelay: `${i * 30}ms` }}
              className={`group/card relative rounded-xl border px-3 py-2.5 text-left transition-all duration-200 animate-count-up hover:-translate-y-0.5 ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold leading-snug">{DOC_LABELS[d]}</div>
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500 text-white scale-100"
                      : "border-slate-300 text-transparent group-hover/card:border-indigo-300"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{DOC_DESCRIPTIONS[d]}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MvpDocsForm({ onSubmit, accessToken, isLoading }: Props) {
  const { config, setConfig } = useMvpDocsStore();
  const [activeProvider, setActiveProvider] = useState<Provider>(config.provider);

  const handleProviderChange = (provider: Provider) => {
    setActiveProvider(provider);
    const firstModel = RESEARCH_MODELS[provider][0].id;
    setConfig({ provider, model: firstModel });
  };

  const toggleDoc = (doc: DocType) => {
    const current = config.targetDocs;
    if (current.includes(doc)) {
      if (current.length === 1) return; // keep at least one
      setConfig({ targetDocs: current.filter((d) => d !== doc) });
    } else {
      setConfig({ targetDocs: [...current, doc] });
    }
  };

  const toggleGroup = (groupDocs: DocType[]) => {
    const allSelected = groupDocs.every((d) => config.targetDocs.includes(d));
    if (allSelected) {
      const remaining = config.targetDocs.filter((d) => !groupDocs.includes(d));
      setConfig({ targetDocs: remaining.length ? remaining : [groupDocs[0]] });
    } else {
      const merged = Array.from(new Set([...config.targetDocs, ...groupDocs]));
      setConfig({ targetDocs: merged });
    }
  };

  const canSubmit =
    config.productBrief.trim().length >= 20 &&
    config.targetDocs.length > 0 &&
    accessToken &&
    !isLoading;

  return (
    <div className="space-y-7 animate-in fade-in duration-500">
      {/* Product Name */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Product Name <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={config.productName}
          onChange={(e) => setConfig({ productName: e.target.value })}
          placeholder="e.g. PragyaDocs"
          maxLength={120}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Product Brief */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Product Brief <span className="text-red-500">*</span>
        </label>
        <textarea
          value={config.productBrief}
          onChange={(e) => setConfig({ productBrief: e.target.value })}
          placeholder="Describe the product: the problem, who it's for, the core idea, and any known constraints. The richer the brief, the better the generated docs."
          rows={6}
          maxLength={4000}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-400">Min 20 characters — the single source for every document</span>
          <span className="text-xs text-slate-400">{config.productBrief.length}/4000</span>
        </div>
      </div>

      {/* Additional Context */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Additional Context <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={config.additionalContext}
          onChange={(e) => setConfig({ additionalContext: e.target.value })}
          placeholder="e.g. 'Internal tool, must integrate with existing Supabase stack'"
          maxLength={1500}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Document selection */}
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Documents to Generate <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-400 mb-3">
            {config.targetDocs.length} selected — one AI agent drafts each document in parallel, then a consistency checker reviews the bundle.
          </p>
        </div>
        <DocGroupGrid
          title="Product & Business — The Why & What"
          docTypes={PRODUCT_DOC_TYPES}
          selected={config.targetDocs}
          onToggle={toggleDoc}
          onSelectAll={() => toggleGroup(PRODUCT_DOC_TYPES)}
        />
        <DocGroupGrid
          title="Engineering & Technical — The How"
          docTypes={ENGINEERING_DOC_TYPES}
          selected={config.targetDocs}
          onToggle={toggleDoc}
          onSelectAll={() => toggleGroup(ENGINEERING_DOC_TYPES)}
        />
      </div>

      {/* Target Audience */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Target Audience <span className="text-slate-400 font-normal">(who the product serves)</span>
        </label>
        <input
          type="text"
          value={config.targetAudience}
          onChange={(e) => setConfig({ targetAudience: e.target.value })}
          placeholder="e.g. Early-stage founders, internal platform teams"
          maxLength={200}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* KB toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={config.searchMyKB}
          onChange={(e) => setConfig({ searchMyKB: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
        />
        <span className="text-sm text-slate-700">Ground docs in my Knowledge Base</span>
      </label>

      {/* AI Model */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">AI Model</label>
        <div className="flex gap-1 mb-3 border-b border-slate-200">
          {(["anthropic", "openai", "groq"] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProviderChange(p)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeProvider === p
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {RESEARCH_MODELS[activeProvider].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setConfig({ model: m.id })}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                config.model === m.id
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {m.label}
              <span
                className={`rounded px-1 py-0.5 text-[10px] font-medium uppercase ${
                  m.tier === "powerful"
                    ? "bg-indigo-100 text-indigo-700"
                    : m.tier === "fast"
                    ? "bg-green-100 text-green-700"
                    : m.tier === "reasoning"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {m.tier}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Tip: generating many documents at once works best with a powerful model.
        </p>
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => accessToken && onSubmit(accessToken)}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting documentation build…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
            Generate {config.targetDocs.length} Document{config.targetDocs.length !== 1 ? "s" : ""}
          </>
        )}
      </button>
    </div>
  );
}
