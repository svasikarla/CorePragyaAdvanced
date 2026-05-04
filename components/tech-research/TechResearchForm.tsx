"use client";

import { useState } from "react";
import { useTechResearchStore } from "@/store/tech-research-store";
import { TECH_RESEARCH_MODELS } from "@/lib/tech-research/models";
import type { FocusArea, EvaluationCriteria } from "@/types/tech-research";
import type { Provider, DepthTier, OutputFormat } from "@/types/research";

const FOCUS_AREAS: { value: FocusArea; label: string }[] = [
  { value: "general", label: "General" },
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "database", label: "Database" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "security", label: "Security" },
  { value: "mobile", label: "Mobile" },
  { value: "ai_ml", label: "AI / ML" },
];

const DEPTH_OPTIONS: { value: DepthTier; label: string; time: string; candidates: string }[] = [
  { value: "tier1", label: "Quick", time: "~5 min", candidates: "4 candidates" },
  { value: "tier2", label: "Standard", time: "~12 min", candidates: "6 candidates" },
  { value: "tier3", label: "Deep", time: "~22 min", candidates: "8 candidates" },
];

const CRITERIA_LABELS: { key: keyof EvaluationCriteria; label: string; description: string }[] = [
  { key: "performance", label: "Performance", description: "Speed, throughput, latency" },
  { key: "developer_experience", label: "Developer Experience", description: "Docs, TypeScript, ease of use" },
  { key: "maturity", label: "Maturity", description: "Stability, community, track record" },
  { key: "cost", label: "Cost", description: "License, hosting, scaling costs" },
  { key: "security", label: "Security", description: "CVEs, audits, compliance" },
];

interface Props {
  onSubmit: (token: string) => void;
  accessToken: string | null;
  isLoading: boolean;
}

export function TechResearchForm({ onSubmit, accessToken, isLoading }: Props) {
  const { config, setConfig } = useTechResearchStore();
  const [activeProvider, setActiveProvider] = useState<Provider>(config.provider);

  const handleProviderChange = (provider: Provider) => {
    setActiveProvider(provider);
    const firstModel = TECH_RESEARCH_MODELS[provider][0].id;
    setConfig({ provider, model: firstModel });
  };

  const handleCriteriaChange = (key: keyof EvaluationCriteria, value: number) => {
    setConfig({ criteria: { ...config.criteria, [key]: value } });
  };

  const canSubmit =
    config.requirement.trim().length >= 10 && accessToken && !isLoading;

  return (
    <div className="space-y-6">
      {/* Requirement */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Requirement Statement
          <span className="text-red-500 ml-1">*</span>
        </label>
        <textarea
          value={config.requirement}
          onChange={(e) => setConfig({ requirement: e.target.value })}
          placeholder="Describe your technical requirement in plain English. e.g. 'We need real-time collaborative editing for our Next.js web app with conflict resolution and offline support.'"
          rows={4}
          maxLength={1000}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-400">Minimum 10 characters</span>
          <span className="text-xs text-slate-400">
            {config.requirement.length}/1000
          </span>
        </div>
      </div>

      {/* Current Tech Stack */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Current Tech Stack
        </label>
        <input
          type="text"
          value={config.current_stack}
          onChange={(e) => setConfig({ current_stack: e.target.value })}
          placeholder="e.g. Next.js 15, Supabase, TypeScript, Tailwind CSS, Node.js"
          maxLength={500}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <p className="mt-1 text-xs text-slate-400">
          Helps the evaluator check compatibility and generate stack-specific code examples.
        </p>
      </div>

      {/* Constraints */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Constraints <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          value={config.constraints}
          onChange={(e) => setConfig({ constraints: e.target.value })}
          placeholder="e.g. OSS only, team of 2 engineers, 3-week implementation window, EU data residency"
          maxLength={500}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Evaluation Criteria Weights */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">
          Evaluation Criteria Weights
        </label>
        <div className="space-y-3">
          {CRITERIA_LABELS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center gap-3">
              <div className="w-44 shrink-0">
                <div className="text-sm font-medium text-slate-700">{label}</div>
                <div className="text-xs text-slate-400">{description}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handleCriteriaChange(key, v)}
                    className={`w-8 h-8 rounded-md text-sm font-semibold transition-colors ${
                      config.criteria[key] >= v
                        ? "bg-sky-500 text-white"
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500 w-12">
                {["", "Low", "Low", "Medium", "High", "Critical"][config.criteria[key]]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Focus Area + Depth */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Focus Area
          </label>
          <select
            value={config.focus_area}
            onChange={(e) => setConfig({ focus_area: e.target.value as FocusArea })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {FOCUS_AREAS.map((fa) => (
              <option key={fa.value} value={fa.value}>
                {fa.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Research Depth
          </label>
          <div className="flex gap-2">
            {DEPTH_OPTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setConfig({ depth: d.value })}
                className={`flex-1 rounded-lg border px-2 py-2 text-center transition-colors ${
                  config.depth === d.value
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-semibold">{d.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{d.time}</div>
                <div className="text-[10px] text-slate-400">{d.candidates}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LLM Provider */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          AI Model
        </label>
        {/* Provider tabs */}
        <div className="flex gap-1 mb-3 border-b border-slate-200">
          {(["anthropic", "openai", "groq"] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProviderChange(p)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeProvider === p
                  ? "border-sky-500 text-sky-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {/* Model chips */}
        <div className="flex flex-wrap gap-2">
          {TECH_RESEARCH_MODELS[activeProvider].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setConfig({ model: m.id })}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                config.model === m.id
                  ? "border-sky-500 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {m.label}
              <span
                className={`rounded px-1 py-0.5 text-[10px] font-medium uppercase ${
                  m.tier === "powerful"
                    ? "bg-violet-100 text-violet-700"
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
      </div>

      {/* Output Format + KB toggle */}
      <div className="flex items-center gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Export Format
          </label>
          <div className="flex gap-2">
            {(["md", "html", "docx"] as OutputFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setConfig({ format: f })}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium uppercase transition-colors ${
                  config.format === f
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer mt-5">
          <input
            type="checkbox"
            checked={config.searchMyKB ?? false}
            onChange={(e) => setConfig({ searchMyKB: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
          />
          <span className="text-sm text-slate-700">Search my Knowledge Base</span>
        </label>
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => accessToken && onSubmit(accessToken)}
        className="w-full rounded-xl bg-sky-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading ? "Starting research…" : "Start Technical Research"}
      </button>
    </div>
  );
}
