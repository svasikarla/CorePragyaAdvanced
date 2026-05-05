"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Download,
  Loader2,
  History,
  AlertCircle,
  Brain,
  ChevronRight,
  FileDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import ReportSection from "@/components/research/ReportSection";
import SourceIndex from "@/components/research/SourceIndex";
import ReportChatPanel, { type ReportChatPanelHandle } from "@/components/research/ReportChatPanel";
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
  const [downloadingWithChat, setDownloadingWithChat] = useState(false);

  const chatRef = useRef<ReportChatPanelHandle>(null);
  const report = job.report;

  // ── Download original report ───────────────────────────────────────────────
  async function handleDownload() {
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
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

  // ── Download report + chat appendix ───────────────────────────────────────
  const handleExportWithChat = useCallback((appendixMd: string) => {
    if (!report) return;
    setDownloadingWithChat(true);
    try {
      const reportMd = reportToMarkdown(report);
      const combined = `${reportMd}\n\n---\n\n${appendixMd}`;
      const blob = new Blob([combined], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `research-with-chat-${job.id}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingWithChat(false);
    }
  }, [report, job.id]);

  // ── Handle "Explore" click on a section ───────────────────────────────────
  const handleRefineSection = useCallback((prompt: string) => {
    chatRef.current?.openWithPrompt(prompt);
  }, []);

  // ── Starter prompts derived from the report ────────────────────────────────
  const starterPrompts = report
    ? [
        `What is the single most important insight from this report on "${report.topic}"?`,
        report.gaps_limitations.length > 0
          ? `The report identified these gaps: ${report.gaps_limitations[0]}. What research would address them?`
          : `What aspects of "${report.topic}" does this report not cover?`,
        report.recommended_actions.length > 0
          ? `Can you help me implement this recommendation: "${report.recommended_actions[0]}"?`
          : `What actions should I take based on the report's conclusions?`,
        report.contradictions_caveats
          ? `The report noted these caveats: "${report.contradictions_caveats.slice(0, 120)}…" — can you explain further?`
          : `Are there counterarguments to the report's main conclusions?`,
      ]
    : [];

  return (
    <div style={RESEARCH_THEME} className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
            >
              <Brain size={14} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <ChevronRight size={13} className="text-slate-300 shrink-0" />
            <Link
              href="/research"
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors hidden sm:inline shrink-0"
            >
              Research
            </Link>
            <ChevronRight size={13} className="text-slate-300 shrink-0 hidden sm:inline" />
            <Link
              href="/research/history"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
            >
              <History size={12} />
              <span className="hidden md:inline">History</span>
            </Link>
            <ChevronRight size={13} className="text-slate-300 shrink-0" />
            <h1 className="text-sm font-semibold text-slate-800 truncate">
              {job.config.topic}
            </h1>
          </div>

          <Link
            href="/research/history"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 shrink-0"
          >
            <ArrowLeft size={13} />
            Back
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {!report ? (
          <NoReport job={job} />
        ) : (
          <>
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
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

                <div className="flex items-center gap-2">
                  {/* Export with chat appendix */}
                  <button
                    onClick={() => {
                      // Trigger chat export from the panel — opens chat if needed
                      if (!chatRef.current?.isOpen) {
                        chatRef.current?.openWithPrompt("");
                        setTimeout(() => {
                          document
                            .querySelector<HTMLButtonElement>("[data-export-appendix]")
                            ?.click();
                        }, 300);
                      }
                    }}
                    disabled={downloadingWithChat}
                    title="Download report + chat exploration as Markdown"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-opacity disabled:opacity-50"
                    style={{
                      border: "1px solid var(--cp-research-border)",
                      color: "var(--cp-research-text-secondary)",
                      backgroundColor: "var(--cp-research-panel)",
                    }}
                  >
                    {downloadingWithChat ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <FileDown size={12} />
                    )}
                    + Chat
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-opacity disabled:opacity-50"
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
              </div>

              {view === "rendered" ? (
                <RenderedReport report={report} onRefineSection={handleRefineSection} />
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

            {/* Chat panel — always present below the report */}
            <ReportChatPanel
              ref={chatRef}
              jobId={job.id}
              topic={job.config.topic}
              accessToken={accessToken}
              starterPrompts={starterPrompts}
              onExportAppendix={handleExportWithChat}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Rendered report ────────────────────────────────────────────────────────────

function RenderedReport({
  report,
  onRefineSection,
}: {
  report: NonNullable<ResearchJob["report"]>;
  onRefineSection: (prompt: string) => void;
}) {
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
        <h2 className="text-xl font-bold" style={{ color: "var(--cp-research-text)" }}>
          {report.topic}
        </h2>
        <p className="text-xs" style={{ color: "var(--cp-research-muted)" }}>
          {report.model_used} · {new Date(report.generated_at).toLocaleString()} · {report.config.audience}
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
        <p className="text-sm leading-relaxed" style={{ color: "var(--cp-research-text)" }}>
          {report.executive_summary}
        </p>
      </div>

      {/* Sections — each has an Explore button */}
      <div className="space-y-4">
        {report.sections.map((section, i) => (
          <ReportSection
            key={i}
            section={section}
            onRefine={onRefineSection}
          />
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
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--cp-research-accent)" }}>
            Cross-Cutting Insights
          </h3>
          <ul className="space-y-1.5">
            {report.cross_cutting_insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: "var(--cp-research-accent)" }}
                />
                <span style={{ color: "var(--cp-research-text)" }}>{insight}</span>
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
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--cp-research-accent)" }}>
            Recommended Actions
          </h3>
          <ol className="space-y-2">
            {report.recommended_actions.map((action, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: "var(--cp-research-accent)", color: "#ffffff" }}
                >
                  {i + 1}
                </span>
                <span style={{ color: "var(--cp-research-text)" }}>{action}</span>
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
              <h3 className="text-sm font-semibold mt-2" style={{ color: "#d97706" }}>
                Gaps & Limitations
              </h3>
              <ul className="space-y-1">
                {report.gaps_limitations.map((g, i) => (
                  <li key={i} className="text-sm" style={{ color: "var(--cp-research-text)" }}>
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

// ── No report state ────────────────────────────────────────────────────────────

function NoReport({ job }: { job: ResearchJob }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-10 shadow-sm flex flex-col items-center text-center">
      <div className="p-4 rounded-full bg-slate-100 mb-4">
        <AlertCircle size={28} className="text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">No report available</h3>
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
        <Link href="/research" className="mt-4 text-xs font-medium text-indigo-600 hover:underline">
          Monitor live progress →
        </Link>
      )}
    </div>
  );
}
