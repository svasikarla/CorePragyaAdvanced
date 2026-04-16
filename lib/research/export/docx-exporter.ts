import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  LevelFormat,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from "docx";
import type { Report } from "@/types/research";

const ACCENT = "4F46E5";
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

export async function reportToDocx(report: Report): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({ text: `Research Report: ${report.topic}`, color: ACCENT, bold: true }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Model: ${report.model_used}  |  Generated: ${new Date(report.generated_at).toLocaleString()}  |  Audience: ${report.config.audience}`,
          italics: true,
          color: "666666",
          size: 20,
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun("")] })
  );

  // Executive Summary
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Executive Summary", color: ACCENT })],
    }),
    new Paragraph({ children: [new TextRun(report.executive_summary)] }),
    new Paragraph({ children: [new TextRun("")] })
  );

  // Sections
  report.sections.forEach((section) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: section.title, color: ACCENT })],
      }),
      new Paragraph({
        children: [new TextRun({ text: section.assertion, italics: true })],
      })
    );

    section.findings.forEach((f) => {
      children.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun(f)],
        })
      );
    });

    if (section.data_point) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Key data point: ", bold: true, color: ACCENT }),
            new TextRun(section.data_point),
          ],
          indent: { left: 720 },
        })
      );
    }

    if (section.implication) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Implication: ", bold: true }),
            new TextRun(section.implication),
          ],
        })
      );
    }

    children.push(new Paragraph({ children: [new TextRun("")] }));
  });

  // Cross-cutting insights
  if (report.cross_cutting_insights.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Cross-Cutting Insights", color: ACCENT })],
      })
    );
    report.cross_cutting_insights.forEach((insight) => {
      children.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun(insight)],
        })
      );
    });
    children.push(new Paragraph({ children: [new TextRun("")] }));
  }

  // Recommended Actions
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Recommended Actions", color: ACCENT })],
    })
  );
  report.recommended_actions.forEach((action) => {
    children.push(
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        children: [new TextRun(action)],
      })
    );
  });
  children.push(new Paragraph({ children: [new TextRun("")] }));

  // Contradictions & Caveats
  if (report.contradictions_caveats) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Contradictions & Caveats", color: ACCENT })],
      }),
      new Paragraph({ children: [new TextRun(report.contradictions_caveats)] }),
      new Paragraph({ children: [new TextRun("")] })
    );
  }

  // Gaps & Limitations
  if (report.gaps_limitations.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Gaps & Limitations", color: ACCENT })],
      })
    );
    report.gaps_limitations.forEach((g) => {
      children.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun(g)],
        })
      );
    });
    children.push(new Paragraph({ children: [new TextRun("")] }));
  }

  // Source Index table
  if (report.source_index.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Source Index", color: ACCENT })],
      })
    );

    const headerRow = new TableRow({
      children: ["#", "Title", "URL", "Date", "Type"].map(
        (h) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })],
              }),
            ],
            shading: { type: ShadingType.SOLID, color: ACCENT },
            borders: CELL_BORDERS,
          })
      ),
    });

    const dataRows = report.source_index.slice(0, 50).map((s, i) =>
      new TableRow({
        children: [String(i + 1), s.title, s.url, s.date, s.type].map(
          (v) =>
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: v, size: 18 })] }),
              ],
              borders: CELL_BORDERS,
            })
        ),
      })
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows],
      })
    );
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
