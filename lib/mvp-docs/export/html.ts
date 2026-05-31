import type { MvpDocsJob, MvpDocument, DocType } from "@/types/mvp-docs";
import { DOC_LABELS, DOC_GROUP_LABELS, DOC_GROUP } from "@/types/mvp-docs";

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
    // Tables (GitHub-style) — convert simple pipe tables.
    // [ \t] (not \s) for trailing whitespace so a following "## heading" keeps its newline.
    .replace(/(^\|.+\|[ \t]*$\n^\|[-:| \t]+\|[ \t]*$\n(?:^\|.+\|[ \t]*$\n?)+)/gm, (block) => tableToHtml(block))
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    // H1-H4
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr>")
    // Lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    // Paragraphs
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[hbpoult])(.+)$/gm, (m) => m)
    .replace(/^(.+)$/, "<p>$1</p>");
}

function tableToHtml(block: string): string {
  const rows = block.trim().split("\n").filter(Boolean);
  if (rows.length < 2) return block;
  const cells = (row: string) =>
    row.split("|").slice(1, -1).map((c) => c.trim());
  const head = cells(rows[0]);
  const bodyRows = rows.slice(2);
  const thead = `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${bodyRows
    .map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

function documentToHtml(doc: MvpDocument): string {
  return `
<section class="doc" id="${doc.docType}">
  <div class="doc-header">
    <span class="doc-kicker">${escapeHtml(DOC_GROUP_LABELS[DOC_GROUP[doc.docType]])}</span>
    <h2>${escapeHtml(doc.title)}</h2>
    ${doc.metadata.summary ? `<p class="doc-summary">${escapeHtml(doc.metadata.summary)}</p>` : ""}
  </div>
  <div class="doc-content">
${markdownToHtml(doc.content)}
  </div>
</section>`;
}

export function jobToHtml(job: MvpDocsJob, docTypes?: DocType[]): string {
  const documents = job.documents ?? [];
  const filtered = docTypes
    ? documents.filter((d) => docTypes.includes(d.docType))
    : documents;

  const toc = filtered
    .map((d) => `<li><a href="#${d.docType}">${escapeHtml(DOC_LABELS[d.docType])}</a> — ${escapeHtml(d.title)}</li>`)
    .join("");

  const report = job.consistency_report;
  const reportHtml = report
    ? `
<section class="doc consistency">
  <div class="doc-header"><h2>Cross-Document Consistency Report</h2>
  <p class="doc-summary">Overall consistency: <strong>${report.overall_consistency.toUpperCase()}</strong></p></div>
  <div class="doc-content">
    ${report.contradictions.length ? `<h3>Contradictions</h3><ul>${report.contradictions.map((c) => `<li><strong>${escapeHtml(c.docs.join(" ↔ "))}:</strong> ${escapeHtml(c.issue)}<br><em>Recommendation:</em> ${escapeHtml(c.recommendation)}</li>`).join("")}</ul>` : ""}
    ${report.coverage_gaps.length ? `<h3>Coverage Gaps</h3><ul>${report.coverage_gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>` : ""}
    ${report.strengths.length ? `<h3>Strengths</h3><ul>${report.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
  </div>
</section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(job.config.productName || "MVP Documentation")} — MVP Documentation Bundle</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1e293b; line-height: 1.6; }
    h1, h2, h3, h4 { line-height: 1.3; }
    .report-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 1.5rem; margin-bottom: 2rem; }
    .report-header h1 { font-size: 1.85rem; margin: 0 0 0.5rem; }
    .report-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .report-meta span { background: #f1f5f9; border-radius: 9999px; padding: 0.25rem 0.75rem; font-size: 0.8rem; color: #475569; }
    .toc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem 1.5rem; margin-bottom: 2rem; }
    .toc h2 { font-size: 1rem; margin: 0 0 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
    .toc ol { margin: 0; padding-left: 1.25rem; }
    .toc a { color: #4338ca; text-decoration: none; font-weight: 600; }
    .doc { border: 1px solid #e2e8f0; border-radius: 0.75rem; margin-bottom: 2rem; overflow: hidden; }
    .doc-header { background: #f8fafc; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
    .doc-kicker { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6366f1; font-weight: 700; }
    .doc-header h2 { margin: 0.25rem 0 0; font-size: 1.4rem; color: #0f172a; }
    .doc-summary { margin: 0.5rem 0 0; color: #64748b; font-size: 0.9rem; }
    .doc-content { padding: 1.25rem 1.5rem 1.75rem; }
    .doc-content h2 { font-size: 1.2rem; margin-top: 1.5rem; }
    .doc-content h3 { font-size: 1.05rem; margin-top: 1.25rem; }
    .doc-content p { margin: 0.75rem 0; }
    .doc-content blockquote { border-left: 3px solid #6366f1; margin: 1rem 0; padding-left: 1rem; color: #475569; font-style: italic; }
    .doc-content pre { background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.85rem; }
    .doc-content code { font-family: 'Fira Code', monospace; font-size: 0.875em; }
    .doc-content :not(pre) > code { background: #eef2ff; color: #4338ca; padding: 0.15em 0.4em; border-radius: 0.25rem; }
    .doc-content table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.85rem; }
    .doc-content th, .doc-content td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
    .doc-content th { background: #f1f5f9; font-weight: 600; }
    .doc-content ul, .doc-content ol { padding-left: 1.5rem; }
    .doc-content li { margin: 0.375rem 0; }
    .consistency .doc-header { background: #fefce8; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(job.config.productName || "MVP Documentation Bundle")}</h1>
    <div class="report-meta">
      <span>MVP Documentation Bundle</span>
      ${job.config.targetAudience ? `<span>Audience: ${escapeHtml(job.config.targetAudience)}</span>` : ""}
      <span>${filtered.length} documents</span>
      <span>Generated: ${new Date(job.created_at).toLocaleDateString()}</span>
    </div>
  </div>
  <nav class="toc"><h2>Contents</h2><ol>${toc}</ol></nav>
  ${filtered.map(documentToHtml).join("\n")}
  ${reportHtml}
</body>
</html>`;
}
