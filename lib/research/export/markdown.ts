import type { Report } from "@/types/research";

export function reportToMarkdown(report: Report): string {
  const lines: string[] = [];

  lines.push(`# Research Report: ${report.topic}`);
  lines.push("");
  lines.push(
    `**Model:** ${report.model_used} | **Generated:** ${new Date(report.generated_at).toLocaleString()} | **Audience:** ${report.config.audience}`
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  // Executive Summary
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(report.executive_summary);
  lines.push("");

  // Sections
  report.sections.forEach((section) => {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(`*${section.assertion}*`);
    lines.push("");
    section.findings.forEach((f) => lines.push(`- ${f}`));
    if (section.data_point) {
      lines.push("");
      lines.push(`> **Key data point:** ${section.data_point}`);
    }
    if (section.implication) {
      lines.push("");
      lines.push(`**Implication:** ${section.implication}`);
    }
    lines.push("");
  });

  // Cross-cutting insights
  if (report.cross_cutting_insights.length > 0) {
    lines.push("## Cross-Cutting Insights");
    lines.push("");
    report.cross_cutting_insights.forEach((i) => lines.push(`- ${i}`));
    lines.push("");
  }

  // Recommended actions
  lines.push("## Recommended Actions");
  lines.push("");
  report.recommended_actions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  lines.push("");

  // Contradictions & caveats
  if (report.contradictions_caveats) {
    lines.push("## Contradictions & Caveats");
    lines.push("");
    lines.push(report.contradictions_caveats);
    lines.push("");
  }

  // Gaps & limitations
  if (report.gaps_limitations.length > 0) {
    lines.push("## Gaps & Limitations");
    lines.push("");
    report.gaps_limitations.forEach((g) => lines.push(`- ${g}`));
    lines.push("");
  }

  // Source index
  if (report.source_index.length > 0) {
    lines.push("## Source Index");
    lines.push("");
    lines.push("| # | Title | URL | Date | Type |");
    lines.push("|---|---|---|---|---|");
    report.source_index.forEach((s, i) => {
      lines.push(
        `| ${i + 1} | ${s.title} | ${s.url} | ${s.date} | ${s.type} |`
      );
    });
    lines.push("");
  }

  return lines.join("\n");
}
