"use client";

import { useState } from "react";
import type { ContentCreationJob, ContentPiece, Platform } from "@/types/content-creation";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/types/content-creation";
import { Copy, Check, Download, FileText, Code2, Clock, Hash, Tag, Pencil, X, Save, Loader2 } from "lucide-react";

interface Props {
  job: ContentCreationJob;
  accessToken: string | null;
}

function CharacterBar({ count, limit, label }: { count: number; limit: number; label: string }) {
  const pct = Math.min(100, Math.round((count / limit) * 100));
  const over = count > limit;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className={over ? "text-red-600 font-semibold" : "text-slate-500"}>
          {count.toLocaleString()} / {limit.toLocaleString()}
          {over && " — over limit!"}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-400" : "bg-violet-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
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
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

interface PiecePanelProps {
  piece: ContentPiece;
  jobId: string;
  accessToken: string | null;
  onSave: (platform: Platform, newContent: string) => Promise<void>;
}

function PiecePanel({ piece, jobId, accessToken, onSave }: PiecePanelProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const meta = piece.metadata;

  const downloadUrl = `/api/content-creation/export/${jobId}?platform=${piece.platform}&format=md&token=${encodeURIComponent(accessToken ?? "")}`;
  const downloadHtmlUrl = `/api/content-creation/export/${jobId}?platform=${piece.platform}&format=html&token=${encodeURIComponent(accessToken ?? "")}`;

  function handleStartEdit() {
    setEditContent(piece.content);
    setSaveError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setSaveError(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(piece.platform, editContent);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Metadata chips */}
      <div className="flex flex-wrap items-center gap-2">
        {meta.readingTimeMinutes && (
          <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            <Clock className="h-3 w-3" />
            {meta.readingTimeMinutes} min read
          </span>
        )}
        {meta.tweetCount && (
          <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            <FileText className="h-3 w-3" />
            {meta.tweetCount} tweets
          </span>
        )}
        {meta.hashtags?.map((h) => (
          <span key={h} className="flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 rounded-full px-2.5 py-1">
            <Hash className="h-3 w-3" />
            {h.replace(/^#/, "")}
          </span>
        ))}
        {meta.tags?.map((t) => (
          <span key={t} className="flex items-center gap-0.5 text-xs text-violet-600 bg-violet-50 rounded-full px-2.5 py-1">
            <Tag className="h-3 w-3" />
            {t}
          </span>
        ))}
      </div>

      {/* Extra metadata */}
      {(meta.subtitle || meta.subjectLine || meta.previewText || meta.seoTitle || meta.metaDescription || meta.callToAction) && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1.5 text-xs text-slate-600">
          {meta.subtitle && <div><span className="font-semibold">Subtitle:</span> {meta.subtitle}</div>}
          {meta.subjectLine && <div><span className="font-semibold">Subject Line:</span> {meta.subjectLine}</div>}
          {meta.previewText && <div><span className="font-semibold">Preview Text:</span> {meta.previewText}</div>}
          {meta.seoTitle && <div><span className="font-semibold">SEO Title:</span> {meta.seoTitle}</div>}
          {meta.metaDescription && <div><span className="font-semibold">Meta Description:</span> {meta.metaDescription}</div>}
          {meta.callToAction && <div><span className="font-semibold">CTA:</span> {meta.callToAction}</div>}
          {meta.imagePrompts?.length && (
            <div>
              <span className="font-semibold">Image Prompts:</span>
              <ul className="mt-0.5 space-y-0.5 pl-3 list-disc">
                {meta.imagePrompts.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* LinkedIn character bar */}
      {(piece.platform === "linkedin_post") && meta.characterCount && (
        <CharacterBar count={meta.characterCount} limit={3000} label="LinkedIn post length" />
      )}

      {/* Actions bar */}
      {!isEditing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <CopyButton text={piece.content} />
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors"
          >
            <Code2 className="h-3.5 w-3.5" />
            {showRaw ? "Rendered" : "Raw Markdown"}
          </button>
          <a
            href={downloadUrl}
            download
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            .MD
          </a>
          <a
            href={downloadHtmlUrl}
            download
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            .HTML
          </a>
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors ml-auto"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 disabled:opacity-50 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          {saveError && (
            <span className="text-xs text-red-600">{saveError}</span>
          )}
        </div>
      )}

      {/* Content / Edit area */}
      {isEditing ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={24}
          className="w-full rounded-lg border border-violet-300 bg-white p-4 text-sm font-mono leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
        />
      ) : showRaw ? (
        <pre className="rounded-lg bg-slate-900 text-slate-200 p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
          {piece.content}
        </pre>
      ) : (
        <div className="content-preview text-sm leading-relaxed text-slate-700 space-y-3 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-slate-700 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-violet-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_code]:text-violet-700 [&_code]:bg-violet-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-slate-900 [&_pre]:text-slate-200 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_strong]:font-semibold [&_strong]:text-slate-800 [&_hr]:border-slate-200 [&_hr]:my-4">
          <div
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(piece.content),
            }}
          />
        </div>
      )}
    </div>
  );
}

// Lightweight markdown-to-HTML for preview
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Restore needed HTML after escaping
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang ?? ""}">${code.trim()}</code></pre>`
    )
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/^&gt; (.+)$/gm, "<blockquote><p>$1</p></blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[h1-6bpuoli]|<pre|<block)(.+)/gm, (line) => line)
    .replace(/\n/g, "<br>")
    .replace(/^(.+)$/, "<p>$1</p>");
}

export function ContentPlatformViewer({ job, accessToken }: Props) {
  const [pieces, setPieces] = useState<ContentPiece[]>(job.content_pieces ?? []);
  const [activePlatform, setActivePlatform] = useState<Platform>(
    pieces[0]?.platform ?? job.config.targetPlatforms[0]
  );

  if (pieces.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No content generated yet.
      </div>
    );
  }

  const activePiece = pieces.find((p) => p.platform === activePlatform) ?? pieces[0];

  const allDownloadUrl = `/api/content-creation/export/${job.id}?format=md&token=${encodeURIComponent(accessToken ?? "")}`;
  const allDownloadHtmlUrl = `/api/content-creation/export/${job.id}?format=html&token=${encodeURIComponent(accessToken ?? "")}`;

  async function handleSavePiece(platform: Platform, newContent: string) {
    const updatedPieces = pieces.map((p) =>
      p.platform === platform ? { ...p, content: newContent } : p
    );
    const res = await fetch(`/api/content-creation/jobs/${job.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ content_pieces: updatedPieces }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Save failed");
    }
    setPieces(updatedPieces);
  }

  return (
    <div className="space-y-4">
      {/* Download all */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{pieces.length} platform{pieces.length !== 1 ? "s" : ""} generated</p>
        <div className="flex gap-2">
          <a
            href={allDownloadUrl}
            download
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            All .MD
          </a>
          <a
            href={allDownloadHtmlUrl}
            download
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            All .HTML
          </a>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {pieces.map((p) => (
          <button
            key={p.platform}
            onClick={() => setActivePlatform(p.platform)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              activePlatform === p.platform
                ? PLATFORM_COLORS[p.platform]
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
          >
            {PLATFORM_LABELS[p.platform]}
          </button>
        ))}
      </div>

      {/* Active piece */}
      {activePiece && (
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-3">{activePiece.title}</h3>
          <PiecePanel piece={activePiece} jobId={job.id} accessToken={accessToken} onSave={handleSavePiece} />
        </div>
      )}
    </div>
  );
}
