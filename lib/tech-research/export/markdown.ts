import type { TechReport } from "@/types/tech-research";

export function techReportToMarkdown(report: TechReport): string {
  const lines: string[] = [];

  lines.push(`# Technical Research Report`);
  lines.push(`## Requirement: ${report.requirement}`);
  lines.push("");
  lines.push(
    `**Verdict:** ${report.verdict}`
  );
  lines.push(
    `**Model:** ${report.model_used} | **Generated:** ${new Date(report.generated_at).toLocaleString()}`
  );
  lines.push(`**Stack:** ${report.config.current_stack}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Executive Summary
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(report.executive_summary);
  lines.push("");

  // Requirement Analysis
  const ra = report.requirement_analysis;
  lines.push("## Requirement Analysis");
  lines.push("");
  lines.push(`*${ra.summary}*`);
  lines.push("");
  lines.push("**Must-have requirements:**");
  ra.functional
    .filter((f) => f.priority === "must_have")
    .forEach((f) => lines.push(`- ${f.description}`));
  lines.push("");
  if (ra.constraints.length > 0) {
    lines.push("**Constraints:**");
    ra.constraints.forEach((c) => lines.push(`- [${c.type}] ${c.description}`));
    lines.push("");
  }
  if (ra.open_questions.length > 0) {
    lines.push("**Open Questions:**");
    ra.open_questions.forEach((q) => lines.push(`- ${q}`));
    lines.push("");
  }

  // Trade-off Matrix
  const matrix = report.tradeoff_matrix;
  lines.push("## Trade-off Matrix");
  lines.push("");
  lines.push(
    `**Winner:** ${matrix.winner} | **Runner-up:** ${matrix.runner_up} | **Confidence:** ${matrix.confidence}`
  );
  lines.push("");

  // Table header
  const criteriaKeys = Object.keys(matrix.criteria_weights);
  lines.push(
    `| Rank | Candidate | ${criteriaKeys.map((k) => k.replace(/_/g, " ")).join(" | ")} | **Weighted Score** |`
  );
  lines.push(
    `|------|-----------|${criteriaKeys.map(() => "---").join("|")}|---|`
  );
  matrix.rows.forEach((row) => {
    const scores = criteriaKeys.map((k) => row.scores[k as keyof typeof row.scores] ?? "-");
    lines.push(
      `| ${row.rank} | **${row.candidate}** | ${scores.join(" | ")} | **${row.weighted_total}** |`
    );
  });
  lines.push("");

  if (matrix.non_obvious_tradeoffs.length > 0) {
    lines.push("**Non-obvious trade-offs:**");
    matrix.non_obvious_tradeoffs.forEach((t) => lines.push(`- ${t}`));
    lines.push("");
  }

  // Architecture Blueprint
  const bp = report.architecture_blueprint;
  lines.push("## Architecture Blueprint");
  lines.push("");
  lines.push(`### Recommendation: ${bp.recommended_solution}`);
  lines.push("");
  lines.push(bp.rationale);
  lines.push("");
  lines.push("### Integration Overview");
  lines.push("");
  lines.push(bp.integration_overview);
  lines.push("");

  if (bp.folder_structure) {
    lines.push("### Folder Structure");
    lines.push("");
    lines.push("```");
    lines.push(bp.folder_structure);
    lines.push("```");
    lines.push("");
  }

  if (bp.code_snippets.length > 0) {
    lines.push("### Code Examples");
    lines.push("");
    bp.code_snippets.forEach((snippet) => {
      lines.push(`#### ${snippet.description}`);
      lines.push("");
      lines.push(`\`\`\`${snippet.language}`);
      lines.push(snippet.code);
      lines.push("```");
      lines.push("");
    });
  }

  if (bp.phases.length > 0) {
    lines.push("### Implementation Roadmap");
    lines.push("");
    bp.phases.forEach((phase) => {
      lines.push(`**Phase ${phase.phase}: ${phase.title}** *(${phase.duration_estimate})*`);
      phase.tasks.forEach((t) => lines.push(`- ${t}`));
      lines.push(`*Deliverable: ${phase.deliverable}*`);
      lines.push("");
    });
  }

  if (bp.risks.length > 0) {
    lines.push("### Risks & Mitigations");
    lines.push("");
    bp.risks.forEach((r) => {
      lines.push(`- **Risk:** ${r.risk}`);
      lines.push(`  **Mitigation:** ${r.mitigation}`);
    });
    lines.push("");
  }

  // Compatibility warnings
  if (report.compatibility_warnings.length > 0) {
    lines.push("## Compatibility Warnings");
    lines.push("");
    report.compatibility_warnings.forEach((w) => lines.push(`- ⚠️ ${w}`));
    lines.push("");
  }

  // Evaluations summary
  if (report.evaluations.length > 0) {
    lines.push("## Candidate Evaluations");
    lines.push("");
    report.evaluations.forEach((e) => {
      lines.push(`### ${e.candidate_name} — Score: ${e.weighted_total}`);
      lines.push(`*Community: ${e.community_health} | Migration: ${e.migration_complexity} | License: ${e.metrics.license ?? "unknown"}*`);
      lines.push("");
      if (e.pros.length > 0) {
        lines.push("**Pros:**");
        e.pros.forEach((p) => lines.push(`- ${p}`));
      }
      if (e.cons.length > 0) {
        lines.push("**Cons:**");
        e.cons.forEach((c) => lines.push(`- ${c}`));
      }
      lines.push("");
    });
  }

  // Source index
  if (report.source_index.length > 0) {
    lines.push("## Source Index");
    lines.push("");
    lines.push("| # | Title | URL | Date | Type |");
    lines.push("|---|---|---|---|---|");
    report.source_index.forEach((s, i) => {
      lines.push(`| ${i + 1} | ${s.title} | ${s.url} | ${s.date} | ${s.type} |`);
    });
    lines.push("");
  }

  return lines.join("\n");
}
