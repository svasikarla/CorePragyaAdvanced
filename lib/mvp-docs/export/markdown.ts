import type { MvpDocsJob, MvpDocument, DocType } from "@/types/mvp-docs";
import { DOC_LABELS } from "@/types/mvp-docs";

function documentToMarkdown(doc: MvpDocument): string {
  const lines: string[] = [];
  lines.push(`# ${doc.title}`);
  lines.push("");
  if (doc.metadata.summary) {
    lines.push(`> ${doc.metadata.summary}`);
    lines.push("");
  }
  lines.push(doc.content.trim());
  lines.push("");
  return lines.join("\n");
}

export function jobToMarkdown(job: MvpDocsJob, docTypes?: DocType[]): string {
  const documents = job.documents ?? [];
  const filtered = docTypes
    ? documents.filter((d) => docTypes.includes(d.docType))
    : documents;

  const tocLines = filtered.map((d, i) => `${i + 1}. **${DOC_LABELS[d.docType]}** — ${d.title}`);

  const header = [
    `# MVP Documentation Bundle: ${job.config.productName || "Untitled Product"}`,
    "",
    `**Generated:** ${new Date(job.created_at).toLocaleDateString()}`,
    `**Documents:** ${filtered.length}`,
    job.config.targetAudience ? `**Audience:** ${job.config.targetAudience}` : "",
    "",
    "## Contents",
    "",
    ...tocLines,
    "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  // Consistency report appendix
  const report = job.consistency_report;
  let appendix = "";
  if (report) {
    const cLines: string[] = [
      "",
      "---",
      "",
      "## Cross-Document Consistency Report",
      "",
      `**Overall consistency:** ${report.overall_consistency.toUpperCase()}`,
      "",
    ];
    if (report.contradictions.length) {
      cLines.push("### Contradictions");
      report.contradictions.forEach((c) => {
        cLines.push(`- **${c.docs.join(" ↔ ")}:** ${c.issue}`);
        cLines.push(`  - _Recommendation:_ ${c.recommendation}`);
      });
      cLines.push("");
    }
    if (report.coverage_gaps.length) {
      cLines.push("### Coverage Gaps");
      report.coverage_gaps.forEach((g) => cLines.push(`- ${g}`));
      cLines.push("");
    }
    if (report.strengths.length) {
      cLines.push("### Strengths");
      report.strengths.forEach((s) => cLines.push(`- ${s}`));
      cLines.push("");
    }
    appendix = cLines.join("\n");
  }

  const body = filtered.map(documentToMarkdown).join("\n\n---\n\n");

  return `${header}\n---\n\n${body}${appendix}`;
}
