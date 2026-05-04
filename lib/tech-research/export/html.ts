import { marked } from "marked";
import type { TechReport } from "@/types/tech-research";
import { techReportToMarkdown } from "./markdown";

export async function techReportToHTML(report: TechReport): Promise<string> {
  const md = techReportToMarkdown(report);
  const body = await marked(md);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tech Research: ${escapeHtml(report.requirement.slice(0, 80))}</title>
<style>
  :root {
    --accent: #0ea5e9;
    --accent-dark: #0369a1;
    --text: #0f172a;
    --muted: #64748b;
    --border: #e2e8f0;
    --bg-code: #0f172a;
    --bg-highlight: #f0f9ff;
    --green: #16a34a;
    --amber: #d97706;
    --red: #dc2626;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.75;
    color: var(--text);
    max-width: 980px;
    margin: 0 auto;
    padding: 3rem 2rem;
  }
  h1 { font-size: 1.75rem; border-bottom: 3px solid var(--accent); padding-bottom: .5rem; }
  h2 { color: var(--accent-dark); margin-top: 2.5rem; font-size: 1.25rem; }
  h3 { color: var(--text); margin-top: 1.5rem; font-size: 1.05rem; }
  h4 { color: var(--muted); font-size: 0.95rem; margin-top: 1rem; }
  p { margin: 0.75rem 0; }
  ul, ol { padding-left: 1.5rem; }
  li { margin: 0.25rem 0; }
  pre {
    background: var(--bg-code);
    color: #e2e8f0;
    padding: 1rem 1.25rem;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 13px;
    margin: 1rem 0;
    line-height: 1.6;
  }
  code {
    background: #f1f5f9;
    color: #0369a1;
    padding: 0.15em 0.4em;
    border-radius: 3px;
    font-size: 0.88em;
    font-family: 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
  }
  pre code { background: none; color: inherit; padding: 0; font-size: inherit; }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
    margin: 1.5rem 0;
  }
  th {
    background: var(--accent);
    color: white;
    padding: 8px 12px;
    text-align: left;
    font-weight: 600;
  }
  td {
    padding: 7px 12px;
    border-bottom: 1px solid var(--border);
    word-break: break-word;
  }
  tr:hover td { background: var(--bg-highlight); }
  blockquote {
    border-left: 4px solid var(--accent);
    padding: .5rem 1rem;
    background: var(--bg-highlight);
    margin: 1rem 0;
    border-radius: 0 4px 4px 0;
  }
  hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
  strong { color: var(--text); }
  @media print {
    body { padding: 1rem; }
    pre { background: #f8fafc; color: var(--text); border: 1px solid var(--border); }
  }
</style>
</head>
<body>${body}</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
