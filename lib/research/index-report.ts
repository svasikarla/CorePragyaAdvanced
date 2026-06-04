import type { Report } from "@/types/research";
import { reportToMarkdown } from "@/lib/research/export/markdown";
import { indexArtifactToKB } from "@/lib/shared/index-to-kb";

// Maps a finished research Report into a single KB entry (one entry per report)
// and indexes it for RAG + graph retrieval.
export async function indexResearchReport(
  jobId: string,
  report: Report,
  userId: string
): Promise<{ kbId: string; chunks: number }> {
  return indexArtifactToKB({
    userId,
    originFeature: "research",
    originJobId: jobId,
    originArtifactKey: "report",
    sourceType: "research",
    sourceRef: `/research/history/${jobId}`,
    title: report.topic || "Research report",
    category: "Research",
    summaryText: report.executive_summary || report.topic || "",
    summaryJson: {
      key_points: report.sections?.map((s) => s.title) ?? [],
      main_ideas: report.cross_cutting_insights ?? [],
      insights: report.recommended_actions ?? [],
    },
    rawText: reportToMarkdown(report),
  });
}
