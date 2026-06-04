import type { MvpDocument } from "@/types/mvp-docs";
import { DOC_LABELS } from "@/types/mvp-docs";
import { indexArtifactToKB } from "@/lib/shared/index-to-kb";

// One KB entry per generated document (artifact). Per-doc failures are non-fatal.
export async function indexMvpDocuments(
  jobId: string,
  documents: MvpDocument[],
  productName: string,
  userId: string
): Promise<number> {
  let indexed = 0;
  for (const doc of documents) {
    try {
      await indexArtifactToKB({
        userId,
        originFeature: "mvp_docs",
        originJobId: jobId,
        originArtifactKey: doc.docType,
        sourceType: "mvp_docs",
        sourceRef: `/mvp-docs/history/${jobId}`,
        title: `${productName ? `${productName} — ` : ""}${doc.title || DOC_LABELS[doc.docType]}`,
        category: "MVP Docs",
        summaryText: doc.metadata?.summary || doc.title || DOC_LABELS[doc.docType],
        summaryJson: { key_points: doc.metadata?.sections ?? [], doc_type: doc.docType },
        rawText: `# ${doc.title || DOC_LABELS[doc.docType]}\n\n${doc.content}`,
      });
      indexed++;
    } catch (e) {
      console.error(`[mvp-docs] index doc ${doc.docType} failed:`, (e as Error).message);
    }
  }
  return indexed;
}
