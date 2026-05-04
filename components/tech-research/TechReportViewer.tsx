"use client";

import { useState } from "react";
import type { TechReport } from "@/types/tech-research";
import { TradeoffMatrix } from "./TradeoffMatrix";
import { ArchitectureBlueprint } from "./ArchitectureBlueprint";
import { techReportToMarkdown } from "@/lib/tech-research/export/markdown";
import { Code, FileText, Download, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  report: TechReport;
  jobId: string;
  accessToken: string | null;
}

export function TechReportViewer({ report, jobId, accessToken }: Props) {
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [isDownloading, setIsDownloading] = useState(false);

  const raw = techReportToMarkdown(report);

  async function handleDownload(format: "md" | "html" | "docx") {
    if (!accessToken) return;
    setIsDownloading(true);
    try {
      const res = await fetch(
        `/api/tech-research/report/${jobId}/download?format=${format}&token=${encodeURIComponent(accessToken)}`
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tech-research.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 sticky top-0 bg-white z-10 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5">
          <button
            onClick={() => setViewMode("rendered")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "rendered"
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Rendered
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "raw"
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            Markdown
          </button>
        </div>

        <div className="flex items-center gap-2">
          {(["md", "html", "docx"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleDownload(fmt)}
              disabled={isDownloading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-600 transition-colors disabled:opacity-40"
            >
              <Download className="h-3 w-3" />
              .{fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "raw" ? (
        <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 bg-slate-50 rounded-xl p-4 border border-slate-200 overflow-auto max-h-[75vh]">
          {raw}
        </pre>
      ) : (
        <div className="space-y-6">
          {/* Verdict */}
          <div className="rounded-xl bg-sky-50 border border-sky-200 px-5 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-sky-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-semibold uppercase text-sky-500 tracking-wide mb-1">
                  Recommendation
                </div>
                <div className="text-base font-semibold text-sky-900">{report.verdict}</div>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">Executive Summary</h2>
            <p className="text-sm text-slate-700 leading-relaxed">{report.executive_summary}</p>
          </section>

          {/* Requirement Analysis */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-3">Requirement Analysis</h2>
            <p className="text-sm text-slate-600 italic mb-3">{report.requirement_analysis.summary}</p>
            <div className="grid gap-2">
              {report.requirement_analysis.functional.map((f, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                    f.priority === "must_have"
                      ? "bg-red-50 text-red-800"
                      : f.priority === "should_have"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="text-xs font-semibold uppercase mt-0.5 shrink-0 opacity-60">
                    {f.priority.replace(/_/g, " ")}
                  </span>
                  <span>{f.description}</span>
                </div>
              ))}
            </div>
            {report.requirement_analysis.open_questions.length > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <div className="text-xs font-semibold text-amber-700 mb-1">Open Questions</div>
                <ul className="space-y-1">
                  {report.requirement_analysis.open_questions.map((q, i) => (
                    <li key={i} className="text-sm text-amber-800">• {q}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Trade-off Matrix */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-3">Trade-off Matrix</h2>
            <TradeoffMatrix matrix={report.tradeoff_matrix} />
          </section>

          {/* Architecture Blueprint */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-3">Architecture Blueprint</h2>
            <ArchitectureBlueprint blueprint={report.architecture_blueprint} />
          </section>

          {/* Compatibility Warnings */}
          {report.compatibility_warnings.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Compatibility Warnings
              </h2>
              <ul className="space-y-2">
                {report.compatibility_warnings.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                    {w}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Source Index */}
          {report.source_index.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-slate-800 mb-3">Source Index</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Title</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.source_index.map((s, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-600 hover:underline"
                          >
                            {s.title}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{s.date}</td>
                        <td className="px-3 py-2">
                          <span className="rounded px-1.5 py-0.5 bg-slate-100 text-slate-600 uppercase font-medium text-[10px]">
                            {s.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
