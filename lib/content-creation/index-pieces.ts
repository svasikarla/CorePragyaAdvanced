import type { ContentPiece } from "@/types/content-creation";
import { PLATFORM_LABELS } from "@/types/content-creation";
import { indexArtifactToKB } from "@/lib/shared/index-to-kb";

// One KB entry per content piece (opt-in — default off, since content repackages
// existing KB and re-indexing it risks an echo loop). Per-piece failures are non-fatal.
export async function indexContentPieces(
  jobId: string,
  pieces: ContentPiece[],
  topic: string,
  userId: string
): Promise<number> {
  let indexed = 0;
  for (const piece of pieces) {
    try {
      await indexArtifactToKB({
        userId,
        originFeature: "content",
        originJobId: jobId,
        originArtifactKey: piece.platform,
        sourceType: "content",
        sourceRef: `/content-creation/history/${jobId}`,
        title: `${PLATFORM_LABELS[piece.platform]}: ${piece.title || topic}`.slice(0, 140),
        category: "Content",
        summaryText: (piece.metadata?.metaDescription || piece.title || topic).slice(0, 300),
        summaryJson: {
          key_points: piece.metadata?.tags ?? piece.metadata?.hashtags ?? [],
          platform: piece.platform,
        },
        rawText: piece.content,
      });
      indexed++;
    } catch (e) {
      console.error(`[content-creation] index piece ${piece.platform} failed:`, (e as Error).message);
    }
  }
  return indexed;
}
