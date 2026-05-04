import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from "docx";
import type { TechReport } from "@/types/tech-research";

const ACCENT = "0EA5E9";
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function heading2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, color: ACCENT, bold: true })],
  });
}

function heading3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun(text)],
  });
}

function spacer(): Paragraph {
  return new Paragraph({ children: [new TextRun("")] });
}

export async function techReportToDocx(report: TechReport): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Technical Research Report", color: ACCENT, bold: true })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Verdict: ${report.verdict}`, bold: true, size: 24 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Model: ${report.model_used}  |  Generated: ${new Date(report.generated_at).toLocaleString()}`,
          italics: true,
          color: "666666",
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Stack: ${report.config.current_stack}`,
          italics: true,
          color: "666666",
          size: 20,
        }),
      ],
    }),
    spacer()
  );

  // Executive Summary
  children.push(
    heading2("Executive Summary"),
    new Paragraph({ children: [new TextRun(report.executive_summary)] }),
    spacer()
  );

  // Requirement Analysis
  const ra = report.requirement_analysis;
  children.push(heading2("Requirement Analysis"));
  children.push(new Paragraph({ children: [new TextRun({ text: ra.summary, italics: true })] }));
  children.push(spacer());

  if (ra.functional.length > 0) {
    children.push(heading3("Functional Requirements"));
    ra.functional.forEach((f) =>
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({ text: `[${f.priority}] `, bold: true }),
            new TextRun(f.description),
          ],
        })
      )
    );
    children.push(spacer());
  }

  if (ra.constraints.length > 0) {
    children.push(heading3("Constraints"));
    ra.constraints.forEach((c) =>
      children.push(bullet(`[${c.type}] ${c.description}`))
    );
    children.push(spacer());
  }

  // Trade-off Matrix Table
  const matrix = report.tradeoff_matrix;
  const criteriaKeys = Object.keys(matrix.criteria_weights);
  children.push(heading2("Trade-off Matrix"));
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Winner: ", bold: true }),
        new TextRun({ text: matrix.winner, color: "16A34A" }),
        new TextRun({ text: "  |  Runner-up: " }),
        new TextRun(matrix.runner_up),
        new TextRun({ text: `  |  Confidence: ${matrix.confidence}`, italics: true }),
      ],
    })
  );
  children.push(spacer());

  // Matrix table
  const headerRow = new TableRow({
    children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, color: ACCENT },
        borders: CELL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: "Candidate", color: "FFFFFF", bold: true })] })],
      }),
      ...criteriaKeys.map((k) =>
        new TableCell({
          shading: { type: ShadingType.SOLID, color: ACCENT },
          borders: CELL_BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: k.replace(/_/g, " "), color: "FFFFFF", bold: true })] })],
        })
      ),
      new TableCell({
        shading: { type: ShadingType.SOLID, color: ACCENT },
        borders: CELL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: "Score", color: "FFFFFF", bold: true })] })],
      }),
    ],
  });

  const dataRows = matrix.rows.map(
    (row) =>
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDERS,
            children: [new Paragraph({ children: [new TextRun({ text: row.candidate, bold: row.candidate === matrix.winner })] })],
          }),
          ...criteriaKeys.map((k) =>
            new TableCell({
              borders: CELL_BORDERS,
              children: [new Paragraph({ children: [new TextRun(String(row.scores[k as keyof typeof row.scores] ?? "-"))] })],
            })
          ),
          new TableCell({
            borders: CELL_BORDERS,
            children: [new Paragraph({ children: [new TextRun({ text: String(row.weighted_total), bold: true })] })],
          }),
        ],
      })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    }),
    spacer()
  );

  // Architecture Blueprint
  const bp = report.architecture_blueprint;
  children.push(heading2("Architecture Blueprint"));
  children.push(heading3(`Recommended: ${bp.recommended_solution}`));
  children.push(new Paragraph({ children: [new TextRun(bp.rationale)] }));
  children.push(spacer());
  children.push(heading3("Integration Overview"));
  children.push(new Paragraph({ children: [new TextRun(bp.integration_overview)] }));
  children.push(spacer());

  if (bp.phases.length > 0) {
    children.push(heading3("Implementation Roadmap"));
    bp.phases.forEach((phase) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Phase ${phase.phase}: ${phase.title} `, bold: true }),
            new TextRun({ text: `(${phase.duration_estimate})`, italics: true, color: "666666" }),
          ],
        })
      );
      phase.tasks.forEach((t) => children.push(bullet(t)));
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Deliverable: ", bold: true }),
            new TextRun({ text: phase.deliverable, italics: true }),
          ],
        })
      );
    });
    children.push(spacer());
  }

  if (bp.risks.length > 0) {
    children.push(heading3("Risks & Mitigations"));
    bp.risks.forEach((r) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({ text: "Risk: ", bold: true }),
            new TextRun(r.risk),
          ],
        }),
        new Paragraph({
          indent: { left: 360 },
          children: [
            new TextRun({ text: "Mitigation: ", bold: true }),
            new TextRun(r.mitigation),
          ],
        })
      );
    });
    children.push(spacer());
  }

  // Compatibility warnings
  if (report.compatibility_warnings.length > 0) {
    children.push(heading2("Compatibility Warnings"));
    report.compatibility_warnings.forEach((w) => children.push(bullet(w)));
    children.push(spacer());
  }

  // Source Index
  if (report.source_index.length > 0) {
    children.push(heading2("Source Index"));
    report.source_index.slice(0, 30).forEach((s, i) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${i + 1}. `, bold: true }),
            new TextRun({ text: s.title }),
            new TextRun({ text: `  ${s.url}`, color: "0EA5E9", size: 18 }),
          ],
        })
      );
    });
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
