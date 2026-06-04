"use client";

import { useState } from "react";
import { Search, Loader2, Database, BookmarkPlus } from "lucide-react";
import { useResearchStore } from "@/store/research-store";
import { supabase } from "@/lib/supabase/client";
import LLMSelector from "./LLMSelector";

const DEPTH_OPTIONS = [
  { value: "tier1", label: "Quick Overview", desc: "3 sub-topics, ~2 min" },
  { value: "tier2", label: "Standard", desc: "3-4 sub-topics, ~4 min" },
  { value: "tier3", label: "Deep Dive", desc: "5 sub-topics, ~7 min" },
] as const;

const AUDIENCE_OPTIONS = [
  { value: "executive", label: "Executive" },
  { value: "technical", label: "Technical" },
  { value: "analyst", label: "Analyst" },
  { value: "client", label: "Client" },
  { value: "board", label: "Board" },
] as const;

const FORMAT_OPTIONS = [
  { value: "md", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "docx", label: "Word Doc" },
] as const;

export default function ResearchForm() {
  const { config, setConfig, setJob, setJobId, setActiveTab } = useResearchStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config.topic.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in to run research.");

      const res = await fetch("/api/research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start research");
      }

      setJobId(data.jobId);
      setJob({
        id: data.jobId,
        user_id: session.user.id,
        status: "queued",
        config,
        agents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setActiveTab("agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Topic */}
      <div>
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: "var(--cp-research-text)" }}
        >
          Research Topic
        </label>
        <textarea
          value={config.topic}
          onChange={(e) => setConfig({ topic: e.target.value })}
          placeholder="e.g. AI adoption in Indian electric utilities 2024–2025"
          rows={3}
          className="w-full px-4 py-3 rounded-lg resize-none text-sm outline-none transition-colors"
          style={{
            backgroundColor: "var(--cp-research-panel)",
            border: "1px solid var(--cp-research-border)",
            color: "var(--cp-research-text)",
          }}
          onFocus={(e) =>
            (e.target.style.borderColor = "var(--cp-research-accent)")
          }
          onBlur={(e) =>
            (e.target.style.borderColor = "var(--cp-research-border)")
          }
        />
        <p className="text-xs mt-1" style={{ color: "var(--cp-research-muted)" }}>
          {config.topic.length}/500
        </p>
      </div>

      {/* LLM selector */}
      <LLMSelector />

      {/* Depth */}
      <div>
        <label
          className="block text-xs font-medium mb-2"
          style={{ color: "var(--cp-research-text-secondary)" }}
        >
          Research Depth
        </label>
        <div className="grid grid-cols-3 gap-2">
          {DEPTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setConfig({ depth: opt.value })}
              className="px-3 py-2.5 rounded text-left transition-colors"
              style={{
                backgroundColor:
                  config.depth === opt.value
                    ? "var(--cp-research-panel)"
                    : "transparent",
                border: `1px solid ${config.depth === opt.value ? "var(--cp-research-accent)" : "var(--cp-research-border)"}`,
              }}
            >
              <div
                className="text-sm font-medium"
                style={{ color: "var(--cp-research-text)" }}
              >
                {opt.label}
              </div>
              <div
                className="text-xs mt-0.5"
                style={{ color: "var(--cp-research-muted)" }}
              >
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Search My KB toggle */}
      <div
        className="flex items-center justify-between rounded-lg px-4 py-3 cursor-pointer select-none"
        style={{
          backgroundColor: config.searchMyKB ? "rgba(79,70,229,0.06)" : "var(--cp-research-panel)",
          border: `1px solid ${config.searchMyKB ? "var(--cp-research-accent)" : "var(--cp-research-border)"}`,
        }}
        onClick={() => setConfig({ searchMyKB: !config.searchMyKB })}
      >
        <div className="flex items-center gap-3">
          <Database size={15} style={{ color: config.searchMyKB ? "var(--cp-research-accent)" : "var(--cp-research-muted)" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--cp-research-text)" }}>
              Search my Knowledge Base first
            </p>
            <p className="text-xs" style={{ color: "var(--cp-research-muted)" }}>
              Blend your saved knowledge with web results
            </p>
          </div>
        </div>
        <div
          className="relative shrink-0 h-5 w-9 rounded-full transition-colors"
          style={{ backgroundColor: config.searchMyKB ? "var(--cp-research-accent)" : "var(--cp-research-border)" }}
        >
          <div
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
            style={{ transform: config.searchMyKB ? "translateX(16px)" : "translateX(2px)" }}
          />
        </div>
      </div>

      {/* Save to Knowledge Base toggle */}
      <div
        className="flex items-center justify-between rounded-lg px-4 py-3 cursor-pointer select-none"
        style={{
          backgroundColor: config.indexToKB ? "rgba(79,70,229,0.06)" : "var(--cp-research-panel)",
          border: `1px solid ${config.indexToKB ? "var(--cp-research-accent)" : "var(--cp-research-border)"}`,
        }}
        onClick={() => setConfig({ indexToKB: !config.indexToKB })}
      >
        <div className="flex items-center gap-3">
          <BookmarkPlus size={15} style={{ color: config.indexToKB ? "var(--cp-research-accent)" : "var(--cp-research-muted)" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--cp-research-text)" }}>
              Save results to my Knowledge Base
            </p>
            <p className="text-xs" style={{ color: "var(--cp-research-muted)" }}>
              Index the report so it's searchable and shows in your graph
            </p>
          </div>
        </div>
        <div
          className="relative shrink-0 h-5 w-9 rounded-full transition-colors"
          style={{ backgroundColor: config.indexToKB ? "var(--cp-research-accent)" : "var(--cp-research-border)" }}
        >
          <div
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
            style={{ transform: config.indexToKB ? "translateX(16px)" : "translateX(2px)" }}
          />
        </div>
      </div>

      {/* Audience & Format */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            className="block text-xs font-medium mb-2"
            style={{ color: "var(--cp-research-text-secondary)" }}
          >
            Audience
          </label>
          <select
            value={config.audience}
            onChange={(e) =>
              setConfig({ audience: e.target.value as typeof config.audience })
            }
            className="w-full px-3 py-2 rounded text-sm outline-none"
            style={{
              backgroundColor: "var(--cp-research-panel)",
              border: "1px solid var(--cp-research-border)",
              color: "var(--cp-research-text)",
            }}
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="block text-xs font-medium mb-2"
            style={{ color: "var(--cp-research-text-secondary)" }}
          >
            Export Format
          </label>
          <select
            value={config.format}
            onChange={(e) =>
              setConfig({ format: e.target.value as typeof config.format })
            }
            className="w-full px-3 py-2 rounded text-sm outline-none"
            style={{
              backgroundColor: "var(--cp-research-panel)",
              border: "1px solid var(--cp-research-border)",
              color: "var(--cp-research-text)",
            }}
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p
          className="text-sm px-3 py-2 rounded"
          style={{
            backgroundColor: "rgba(239,68,68,0.08)",
            color: "#dc2626",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !config.topic.trim()}
        className="w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
        style={{
          backgroundColor: "var(--cp-research-accent)",
          color: "#ffffff",
        }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Starting research…
          </>
        ) : (
          <>
            <Search size={16} />
            Start Research
          </>
        )}
      </button>
    </form>
  );
}
