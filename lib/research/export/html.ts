import { marked } from "marked";
import type { Report } from "@/types/research";
import { reportToMarkdown } from "./markdown";

export async function reportToHTML(report: Report): Promise<string> {
  const md = reportToMarkdown(report);
  const body = await marked(md);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Research: ${escapeHtml(report.topic)}</title>
<style>
  :root {
    --accent: #4f46e5;
    --text: #1e293b;
    --muted: #64748b;
    --border: #e2e8f0;
    --bg-quote: #eef2ff;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.75;
    color: var(--text);
    max-width: 920px;
    margin: 0 auto;
    padding: 3rem 2rem;
  }
  h1 {
    font-size: 2rem;
    border-bottom: 3px solid var(--accent);
    padding-bottom: .5rem;
    margin-bottom: 0.25rem;
  }
  h2 {
    color: var(--accent);
    margin-top: 2.5rem;
    font-size: 1.3rem;
  }
  p { margin: 0.75rem 0; }
  ul, ol { padding-left: 1.5rem; }
  li { margin: 0.25rem 0; }
  blockquote {
    border-left: 4px solid var(--accent);
    padding: .5rem 1rem;
    background: var(--bg-quote);
    margin: 1rem 0;
    border-radius: 0 4px 4px 0;
  }
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
  }
  td {
    padding: 7px 12px;
    border-bottom: 1px solid var(--border);
    word-break: break-word;
  }
  tr:hover td { background: #f8f9ff; }
  code {
    background: #f1f5f9;
    padding: 0.1em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
  }
  hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
  @media print { body { padding: 1rem; } h2 { page-break-before: auto; } }
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
