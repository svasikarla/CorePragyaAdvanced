import type { ContentCreationJob, ContentPiece, Platform } from "@/types/content-creation";
import { PLATFORM_LABELS } from "@/types/content-creation";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtml(md: string): string {
  return md
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang ?? "text"}">${escapeHtml(code.trim())}</code></pre>`
    )
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // H1-H4
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr>")
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Twitter thread tweet separator
    .replace(/\n---\n/g, '<hr class="tweet-separator">')
    // Paragraphs (blank line = paragraph break)
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[hbplc])(.+)$/gm, (m) => m)
    // Wrap in paragraph
    .replace(/^(.+)$/, "<p>$1</p>");
}

function pieceToHtml(piece: ContentPiece): string {
  const meta = piece.metadata;
  const platformClass = piece.platform.replace(/_/g, "-");

  const metaBadges: string[] = [];
  if (meta.readingTimeMinutes) metaBadges.push(`<span class="badge">${meta.readingTimeMinutes} min read</span>`);
  if (meta.characterCount) metaBadges.push(`<span class="badge">${meta.characterCount} chars</span>`);
  if (meta.tweetCount) metaBadges.push(`<span class="badge">${meta.tweetCount} tweets</span>`);
  if (meta.hashtags?.length) {
    metaBadges.push(`<span class="badge hashtags">${meta.hashtags.join(" ")}</span>`);
  }
  if (meta.tags?.length) {
    metaBadges.push(`<span class="badge tags">Tags: ${meta.tags.join(", ")}</span>`);
  }

  const metaExtras: string[] = [];
  if (meta.subtitle) metaExtras.push(`<div class="meta-item"><strong>Subtitle:</strong> ${escapeHtml(meta.subtitle)}</div>`);
  if (meta.subjectLine) metaExtras.push(`<div class="meta-item"><strong>Subject Line:</strong> ${escapeHtml(meta.subjectLine)}</div>`);
  if (meta.previewText) metaExtras.push(`<div class="meta-item"><strong>Preview Text:</strong> ${escapeHtml(meta.previewText)}</div>`);
  if (meta.seoTitle) metaExtras.push(`<div class="meta-item"><strong>SEO Title:</strong> ${escapeHtml(meta.seoTitle)}</div>`);
  if (meta.metaDescription) metaExtras.push(`<div class="meta-item"><strong>Meta Description:</strong> ${escapeHtml(meta.metaDescription)}</div>`);
  if (meta.callToAction) metaExtras.push(`<div class="meta-item"><strong>CTA:</strong> ${escapeHtml(meta.callToAction)}</div>`);
  if (meta.imagePrompts?.length) {
    metaExtras.push(
      `<div class="meta-item"><strong>Image Prompts:</strong><ul>${meta.imagePrompts.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul></div>`
    );
  }

  return `
<section class="content-piece platform-${platformClass}">
  <div class="platform-header">
    <h2>${escapeHtml(PLATFORM_LABELS[piece.platform])}</h2>
    <div class="meta-badges">${metaBadges.join("")}</div>
  </div>
  <h3 class="piece-title">${escapeHtml(piece.title)}</h3>
  ${metaExtras.length > 0 ? `<div class="meta-extras">${metaExtras.join("")}</div>` : ""}
  <div class="piece-content">
${markdownToHtml(piece.content)}
  </div>
</section>`;
}

export function jobToHtml(job: ContentCreationJob, platforms?: Platform[]): string {
  const pieces = job.content_pieces ?? [];
  const filtered = platforms
    ? pieces.filter((p) => platforms.includes(p.platform))
    : pieces;

  const platformList = job.config.targetPlatforms
    .map((p) => PLATFORM_LABELS[p])
    .join(", ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(job.config.topic)} — Content Pack</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 860px; margin: 0 auto; padding: 2rem; color: #1e293b; line-height: 1.6; }
    h1, h2, h3, h4 { line-height: 1.3; }
    .report-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 1.5rem; margin-bottom: 2rem; }
    .report-header h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
    .report-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .report-meta span { background: #f1f5f9; border-radius: 9999px; padding: 0.25rem 0.75rem; font-size: 0.8rem; color: #475569; }
    .content-piece { border: 1px solid #e2e8f0; border-radius: 0.75rem; margin-bottom: 2rem; overflow: hidden; }
    .platform-header { background: #f8fafc; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; }
    .platform-header h2 { margin: 0; font-size: 1rem; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
    .meta-badges { display: flex; flex-wrap: wrap; gap: 0.375rem; }
    .badge { background: #e0f2fe; color: #0369a1; border-radius: 9999px; padding: 0.2rem 0.6rem; font-size: 0.75rem; font-weight: 500; }
    .badge.hashtags { background: #f0fdf4; color: #15803d; }
    .badge.tags { background: #faf5ff; color: #7e22ce; }
    .piece-title { margin: 1rem 1.5rem 0.5rem; font-size: 1.25rem; color: #0f172a; }
    .meta-extras { margin: 0 1.5rem 1rem; padding: 0.75rem; background: #f8fafc; border-radius: 0.5rem; border: 1px solid #e2e8f0; }
    .meta-item { font-size: 0.85rem; margin-bottom: 0.375rem; color: #475569; }
    .piece-content { padding: 1rem 1.5rem 1.5rem; }
    .piece-content h1 { font-size: 1.5rem; }
    .piece-content h2 { font-size: 1.25rem; margin-top: 1.5rem; }
    .piece-content h3 { font-size: 1.1rem; margin-top: 1.25rem; }
    .piece-content p { margin: 0.75rem 0; }
    .piece-content blockquote { border-left: 3px solid #0ea5e9; margin: 1rem 0; padding-left: 1rem; color: #475569; font-style: italic; }
    .piece-content pre { background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; }
    .piece-content code { font-family: 'Fira Code', monospace; font-size: 0.875em; }
    .piece-content :not(pre) > code { background: #f1f5f9; padding: 0.15em 0.4em; border-radius: 0.25rem; }
    .piece-content li { margin: 0.375rem 0; }
    .piece-content ul, .piece-content ol { padding-left: 1.5rem; }
    hr.tweet-separator { border: none; border-top: 1px dashed #cbd5e1; margin: 1rem 0; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(job.config.topic)}</h1>
    <div class="report-meta">
      <span>Tone: ${escapeHtml(job.config.tone)}</span>
      <span>Audience: ${escapeHtml(job.config.targetAudience || "General")}</span>
      <span>Platforms: ${escapeHtml(platformList)}</span>
      <span>Generated: ${new Date(job.created_at).toLocaleDateString()}</span>
    </div>
  </div>
  ${filtered.map(pieceToHtml).join("\n")}
</body>
</html>`;
}
