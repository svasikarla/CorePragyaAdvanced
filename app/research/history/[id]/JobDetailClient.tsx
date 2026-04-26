"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Download,
  Loader2,
  History,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import ReportSection from "@/components/research/ReportSection";
import SourceIndex from "@/components/research/SourceIndex";
import { reportToMarkdown } from "@/lib/research/export/markdown";
import type { ResearchJob } from "@/types/research";

interface Props {
  job: ResearchJob;
  accessToken: string | null;
}

const FORMAT_LABELS: Record<string, string> = {
  md: "Markdown",
  html: "HTML",
  docx: "Word Doc",
};

const RESEARCH_THEME: React.CSSProperties = {
  ["--cp-research-bg" as string]: "#f8fafc",
  ["--cp-research-surface" as string]: "#ffffff",
  ["--cp-research-panel" as string]: "#f1f5f9",
  ["--cp-research-border" as string]: "#e2e8f0",
  ["--cp-research-text" as string]: "#1e293b",
  ["--cp-research-text-secondary" as string]: "#475569",
  ["--cp-research-muted" as string]: "#94a3b8",
  ["--cp-research-accent" as string]: "#4f46e5",
};

export default function JobDetailClient({ job, accessToken }: Props) {
  const [view, setView] = useState<"rendered" | "raw">("rendered");
  const [downloading, setDownloading] = useState(false);

  const report = job.report;

  async function handleDownload() {
    setDownloading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) return;

      const res = await fetch(`/api/research/report/${job.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "research-report";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={RESEARCH_THEME} className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/research/history"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors shrink-0"
            >
              <ArrowLeft size={14} />
              History
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-semibold text-slate-800 truncate">
              {job.config.topic}
            </h1>
          </div>

          <Link
            href="/research/history"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 shrink-0"
          >
            <History size={13} />
            All history
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {!report ? (
          <NoReport job={job} />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {(["rendered", "raw"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className="px-3 py-1.5 text-xs rounded font-medium"
                    style={{
                      backgroundColor:
                        view === v
                          ? "var(--cp-research-accent)"
                          : "var(--cp-research-panel)",
                      color:
                        view === v
                          ? "#ffffff"
                          : "var(--cp-research-text-secondary)",
                      border: "1px solid var(--cp-research-border)",
                    }}
                  >
                    {v === "rendered" ? "Rendered" : "Raw Markdown"}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: "var(--cp-research-accent)",
                  color: "#ffffff",
                }}
              >
                {downloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Download {FORMAT_LABELS[job.config.format] ?? ""}
              </button>
            </div>

            {view === "rendered" ? (
              <RenderedReport report={report} />
            ) : (
              <div
                className="rounded-lg p-5 prose max-w-none text-sm overflow-auto"
                style={{
                  backgroundColor: "var(--cp-research-panel)",
                  border: "1px solid var(--cp-research-border)",
                  color: "var(--cp-research-text)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                <ReactMarkdown>{reportToMarkdown(report)}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RenderedReport({ report }: { report: NonNullable<ResearchJob["report"]> }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="px-6 py-5 rounded-lg space-y-2"
        style={{
          backgroundColor: "var(--cp-research-surface)",
          border: "1px solid var(--cp-research-border)",
        }}
      >
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--cp-research-text)" }}
        >
          {report.topic}
        </h2>
        <p className="text-xs" style={{ color: "var(--cp-research-muted)" }}>
          {report.model_used} · {new Date(report.generated_at).toLocaleString()}{" "}
          · {report.config.audience}
        </p>
      </div>

      {/* Executive summary */}
      <div
        className="px-5 py-4 rounded-lg"
        style={{
          backgroundColor: "var(--cp-research-panel)",
          borderLeft: "4px solid var(--cp-research-accent)",
        }}
      >
        <p
          className="text-xs font-semibold uppercase mb-2"
          style={{ color: "var(--cp-research-accent)" }}
        >
          Executive Summary
        </p>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--cp-research-text)" }}
        >
          {report.executive_summary}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {report.sections.map((section, i) => (
          <ReportSection key={i} section={section} />
        ))}
      </div>

      {/* Cross-cutting insights */}
      {report.cross_cutting_insights.length > 0 && (
        <div
          className="px-5 py-4 rounded-lg"
          style={{
            backgroundColor: "var(--cp-research-surface)",
            border: "1px solid var(--cp-research-border)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--cp-research-accent)" }}
          >
            Cross-Cutting Insights
          </h3>
          <ul className="space-y-1.5">
            {report.cross_cutting_insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: "var(--cp-research-accent)" }}
                />
                <span style={{ color: "var(--cp-research-text)" }}>
                  {insight}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended actions */}
      {report.recommended_actions.length > 0 && (
        <div
          className="px-5 py-4 rounded-lg"
          style={{
            backgroundColor: "var(--cp-research-surface)",
            border: "1px solid var(--cp-research-border)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--cp-research-accent)" }}
          >
            Recommended Actions
          </h3>
          <ol className="space-y-2">
            {report.recommended_actions.map((action, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: "var(--cp-research-accent)",
                    color: "#ffffff",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ color: "var(--cp-research-text)" }}>
                  {action}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Caveats & gaps */}
      {(report.contradictions_caveats || report.gaps_limitations.length > 0) && (
        <div
          className="px-5 py-4 rounded-lg space-y-3"
          style={{
            backgroundColor: "var(--cp-research-panel)",
            border: "1px solid rgba(245,158,11,0.3)",
          }}
        >
          {report.contradictions_caveats && (
            <>
              <h3 className="text-sm font-semibold" style={{ color: "#d97706" }}>
                Contradictions & Caveats
              </h3>
              <p className="text-sm" style={{ color: "var(--cp-research-text)" }}>
                {report.contradictions_caveats}
              </p>
            </>
          )}
          {report.gaps_limitations.length > 0 && (
            <>
              <h3
                className="text-sm font-semibold mt-2"
                style={{ color: "#d97706" }}
              >
                Gaps & Limitations
              </h3>
              <ul className="space-y-1">
                {report.gaps_limitations.map((g, i) => (
                  <li
                    key={i}
                    className="text-sm"
                    style={{ color: "var(--cp-research-text)" }}
                  >
                    • {g}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <SourceIndex sources={report.source_index} />
    </div>
  );
}

function NoReport({ job }: { job: ResearchJob }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-10 shadow-sm flex flex-col items-center text-center">
      <div className="p-4 rounded-full bg-slate-100 mb-4">
        <AlertCircle size={28} className="text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">
        No report available
      </h3>
      <p className="text-xs text-slate-400 mb-1 max-w-xs">
        This job{" "}
        {job.status === "error"
          ? "encountered an error before completing."
          : job.status === "running" || job.status === "queued"
          ? "is still in progress."
          : "did not produce a report."}
      </p>
      {job.error && (
        <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-1.5 mt-2 max-w-sm">
          {job.error}
        </p>
      )}
      {(job.status === "running" || job.status === "queued") && (
        <Link
          href="/research"
          className="mt-4 text-xs font-medium text-indigo-600 hover:underline"
        >
          Monitor live progress →
        </Link>
      )}
    </div>
  );
}
