"use client";

import { RESEARCH_MODELS } from "@/lib/research/models";
import { useResearchStore } from "@/store/research-store";
import type { Provider } from "@/types/research";

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  groq: "Groq (Fast)",
};

const TIER_COLOURS: Record<string, string> = {
  powerful: "#7c3aed",
  balanced: "#2563eb",
  fast: "#059669",
  reasoning: "#d97706",
};

export default function LLMSelector() {
  const { config, setConfig } = useResearchStore();

  const providers = Object.keys(RESEARCH_MODELS) as Provider[];

  return (
    <div className="space-y-4">
      {/* Provider tabs */}
      <div>
        <label
          className="block text-xs font-medium mb-2"
          style={{ color: "var(--cp-research-text-secondary)" }}
        >
          Provider
        </label>
        <div className="flex gap-2 flex-wrap">
          {providers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setConfig({ provider: p, model: RESEARCH_MODELS[p][0].id });
              }}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor:
                  config.provider === p
                    ? "var(--cp-research-accent)"
                    : "var(--cp-research-panel)",
                color:
                  config.provider === p
                    ? "#ffffff"
                    : "var(--cp-research-text-secondary)",
                border: "1px solid var(--cp-research-border)",
              }}
            >
              {PROVIDER_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Model chips */}
      <div>
        <label
          className="block text-xs font-medium mb-2"
          style={{ color: "var(--cp-research-text-secondary)" }}
        >
          Model
        </label>
        <div className="flex flex-wrap gap-2">
          {RESEARCH_MODELS[config.provider].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setConfig({ model: m.id })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
              style={{
                backgroundColor:
                  config.model === m.id
                    ? "var(--cp-research-panel)"
                    : "transparent",
                color:
                  config.model === m.id
                    ? "var(--cp-research-text)"
                    : "var(--cp-research-muted)",
                border: `1px solid ${config.model === m.id ? "var(--cp-research-accent)" : "var(--cp-research-border)"}`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: TIER_COLOURS[m.tier] ?? "#64748b" }}
              />
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
