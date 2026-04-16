"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useResearchStore } from "@/store/research-store";
import ReportSection from "./ReportSection";
import SourceIndex from "./SourceIndex";
import DownloadButton from "./DownloadButton";
import { reportToMarkdown } from "@/lib/research/export/markdown";

export default function ReportViewer() {
  const { job } = useResearchStore();
  const [view, setView] = useState<"rendered" | "raw">("rendered");

  if (!job?.report) {
    return (
      <div className="flex items-center justify-center h-48">
        <p style={{ color: "var(--cp-research-muted)" }}>
          Report not available yet. Run a research job first.
        </p>
      </div>
    );
  }

  const report = job.report;
  const markdown = reportToMarkdown(report);

  return (
    <div className="space-y-6">
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
                  view === v ? "#ffffff" : "var(--cp-research-text-secondary)",
                border: "1px solid var(--cp-research-border)",
              }}
            >
              {v === "rendered" ? "Rendered" : "Raw Markdown"}
            </button>
          ))}
        </div>
        <DownloadButton />
      </div>

      {view === "rendered" ? (
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
              {report.model_used} · {new Date(report.generated_at).toLocaleString()} ·{" "}
              {report.config.audience}
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
                  <p
                    className="text-sm"
                    style={{ color: "var(--cp-research-text)" }}
                  >
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

          {/* Source index */}
          <SourceIndex sources={report.source_index} />
        </div>
      ) : (
        /* Raw markdown view */
        <div
          className="rounded-lg p-5 prose max-w-none text-sm overflow-auto"
          style={{
            backgroundColor: "var(--cp-research-panel)",
            border: "1px solid var(--cp-research-border)",
            color: "var(--cp-research-text)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
