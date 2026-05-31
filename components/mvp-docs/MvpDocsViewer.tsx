"use client";

import { useState } from "react";
import type { MvpDocsJob, MvpDocument, DocType, ConsistencyReport } from "@/types/mvp-docs";
import { DOC_LABELS, DOC_GROUP, DOC_GROUP_COLORS } from "@/types/mvp-docs";
import {
  Copy, Check, Download, Code2, Pencil, X, Save, Loader2,
  ShieldCheck, ShieldAlert, ShieldQuestion,
} from "lucide-react";

interface Props {
  job: MvpDocsJob;
  accessToken: string | null;
  readOnly?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ConsistencyPanel({ report }: { report: ConsistencyReport }) {
  const tone =
    report.overall_consistency === "high"
      ? { Icon: ShieldCheck, color: "text-green-600", bg: "bg-green-50 border-green-200" }
      : report.overall_consistency === "medium"
      ? { Icon: ShieldQuestion, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" }
      : { Icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50 border-red-200" };
  const { Icon } = tone;

  return (
    <div className={`rounded-2xl border p-5 animate-in fade-in slide-in-from-bottom-1 duration-500 ${tone.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-5 w-5 ${tone.color}`} />
        <h4 className="font-display text-sm font-semibold text-slate-800">
          Cross-Document Consistency: <span className={tone.color}>{report.overall_consistency.toUpperCase()}</span>
        </h4>
      </div>

      {report.contradictions.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-600 mb-1">Contradictions ({report.contradictions.length})</p>
          <ul className="space-y-2">
            {report.contradictions.map((c, i) => (
              <li key={i} className="text-xs text-slate-700 bg-white/60 rounded-lg p-2.5 border border-white">
                <span className="font-semibold">{c.docs.join(" ↔ ")}:</span> {c.issue}
                <div className="text-slate-500 mt-0.5"><span className="font-medium">Fix:</span> {c.recommendation}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.coverage_gaps.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-600 mb-1">Coverage Gaps</p>
          <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-600">
            {report.coverage_gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}

      {report.strengths.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Strengths</p>
          <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-600">
            {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

interface DocPanelProps {
  doc: MvpDocument;
  jobId: string;
  accessToken: string | null;
  readOnly?: boolean;
  onSave: (docType: DocType, newContent: string) => Promise<void>;
}

function DocPanel({ doc, jobId, accessToken, readOnly, onSave }: DocPanelProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const downloadUrl = `/api/mvp-docs/export/${jobId}?doc=${doc.docType}&format=md&token=${encodeURIComponent(accessToken ?? "")}`;
  const downloadHtmlUrl = `/api/mvp-docs/export/${jobId}?doc=${doc.docType}&format=html&token=${encodeURIComponent(accessToken ?? "")}`;

  function handleStartEdit() {
    setEditContent(doc.content);
    setSaveError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(doc.docType, editContent);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {doc.metadata.summary && (
        <p className="text-sm text-slate-500 italic border-l-2 border-indigo-200 pl-3">{doc.metadata.summary}</p>
      )}

      {/* Actions bar */}
      {!isEditing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <CopyButton text={doc.content} />
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors"
          >
            <Code2 className="h-3.5 w-3.5" />
            {showRaw ? "Rendered" : "Raw Markdown"}
          </button>
          <a href={downloadUrl} download className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors">
            <Download className="h-3.5 w-3.5" /> .MD
          </a>
          <a href={downloadHtmlUrl} download className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors">
            <Download className="h-3.5 w-3.5" /> .HTML
          </a>
          {!readOnly && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors ml-auto"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={() => { setIsEditing(false); setSaveError(null); }}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 disabled:opacity-50 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          {saveError && <span className="text-xs text-red-600">{saveError}</span>}
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={28}
          className="w-full rounded-lg border border-indigo-300 bg-white p-4 text-sm font-mono leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
      ) : showRaw ? (
        <pre className="rounded-lg bg-slate-900 text-slate-200 p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
          {doc.content}
        </pre>
      ) : (
        <div className="doc-preview text-[15px] leading-relaxed text-slate-700 space-y-3 [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mt-5 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-800 [&_h2]:mt-5 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-slate-100 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-slate-700 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_code]:text-indigo-700 [&_code]:bg-indigo-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-900 [&_pre]:text-slate-200 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_strong]:font-semibold [&_strong]:text-slate-800 [&_hr]:border-slate-200 [&_hr]:my-4 [&_table]:w-full [&_table]:my-3 [&_table]:text-xs [&_table]:border [&_table]:border-slate-200 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_td]:align-top">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }} />
        </div>
      )}
    </div>
  );
}

// Lightweight markdown-to-HTML for preview (handles GitHub-style tables).
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Tables first (operate on escaped text, pipes intact).
  // Trailing whitespace is [ \t] (not \s) so the blank line after a table keeps
  // its newline — otherwise a following "## heading" loses its line-start anchor.
  html = html.replace(
    /(^\|.+\|[ \t]*$\n^\|[-:| \t]+\|[ \t]*$\n(?:^\|.+\|[ \t]*$\n?)+)/gm,
    (block) => {
      const rows = block.trim().split("\n").filter(Boolean);
      const cells = (row: string) => row.split("|").slice(1, -1).map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2);
      const thead = `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`;
      return `<table>${thead}${tbody}</table>`;
    }
  );

  return html
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang ?? ""}">${code.trim()}</code></pre>`
    )
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/^&gt; (.+)$/gm, "<blockquote><p>$1</p></blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n+/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.+)$/, "<p>$1</p>");
}

export function MvpDocsViewer({ job, accessToken, readOnly }: Props) {
  const [documents, setDocuments] = useState<MvpDocument[]>(job.documents ?? []);
  const [activeDoc, setActiveDoc] = useState<DocType>(
    documents[0]?.docType ?? job.config.targetDocs[0]
  );

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No documents generated yet.
      </div>
    );
  }

  const active = documents.find((d) => d.docType === activeDoc) ?? documents[0];

  const allMdUrl = `/api/mvp-docs/export/${job.id}?format=md&token=${encodeURIComponent(accessToken ?? "")}`;
  const allHtmlUrl = `/api/mvp-docs/export/${job.id}?format=html&token=${encodeURIComponent(accessToken ?? "")}`;

  async function handleSaveDoc(docType: DocType, newContent: string) {
    const updated = documents.map((d) =>
      d.docType === docType ? { ...d, content: newContent } : d
    );
    const res = await fetch(`/api/mvp-docs/jobs/${job.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ documents: updated }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Save failed");
    }
    setDocuments(updated);
  }

  return (
    <div className="space-y-4">
      {/* Bundle download */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500">{documents.length} document{documents.length !== 1 ? "s" : ""} in this bundle</p>
        <div className="flex gap-2">
          <a href={allMdUrl} download className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
            <Download className="h-3.5 w-3.5" /> Bundle .MD
          </a>
          <a href={allHtmlUrl} download className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
            <Download className="h-3.5 w-3.5" /> Bundle .HTML
          </a>
        </div>
      </div>

      {/* Consistency report */}
      {job.consistency_report && <ConsistencyPanel report={job.consistency_report} />}

      {/* Doc tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {documents.map((d) => (
          <button
            key={d.docType}
            onClick={() => setActiveDoc(d.docType)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:-translate-y-px ${
              activeDoc === d.docType
                ? `${DOC_GROUP_COLORS[DOC_GROUP[d.docType]]} shadow-sm`
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
          >
            {DOC_LABELS[d.docType]}
          </button>
        ))}
      </div>

      {/* Active doc */}
      {active && (
        <div key={active.docType} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          <h3 className="font-display text-lg font-bold text-slate-800 mb-3">{active.title}</h3>
          <DocPanel
            doc={active}
            jobId={job.id}
            accessToken={accessToken}
            readOnly={readOnly}
            onSave={handleSaveDoc}
          />
        </div>
      )}
    </div>
  );
}
