import type { TechReport } from "@/types/tech-research";
import { techReportToMarkdown } from "@/lib/tech-research/export/markdown";
import { indexArtifactToKB } from "@/lib/shared/index-to-kb";

const FOCUS_CATEGORY: Record<string, string> = {
  frontend: "Technology",
  backend: "Technology",
  database: "Technology",
  infrastructure: "Technology",
  security: "Technology",
  mobile: "Technology",
  ai_ml: "AI",
  general: "Technology",
};

// One KB entry per tech-research report.
export async function indexTechReport(
  jobId: string,
  report: TechReport,
  userId: string
): Promise<{ kbId: string; chunks: number }> {
  return indexArtifactToKB({
    userId,
    originFeature: "tech_research",
    originJobId: jobId,
    originArtifactKey: "report",
    sourceType: "tech_research",
    sourceRef: `/tech-research/history/${jobId}`,
    title: report.requirement?.slice(0, 120) || "Technology evaluation",
    category: FOCUS_CATEGORY[report.config?.focus_area] ?? "Technology",
    summaryText: report.verdict || report.executive_summary || "",
    summaryJson: {
      key_points: [report.verdict, ...(report.compatibility_warnings ?? [])].filter(Boolean),
      main_ideas: report.tradeoff_matrix?.key_differentiators ?? [],
      insights: report.architecture_blueprint?.success_metrics ?? [],
    },
    rawText: techReportToMarkdown(report),
  });
}
