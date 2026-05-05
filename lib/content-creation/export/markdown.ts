import type { ContentCreationJob, ContentPiece, Platform } from "@/types/content-creation";
import { PLATFORM_LABELS } from "@/types/content-creation";

function pieceToMarkdown(piece: ContentPiece): string {
  const meta = piece.metadata;
  const lines: string[] = [];

  lines.push(`# ${PLATFORM_LABELS[piece.platform]}: ${piece.title}`);
  lines.push("");

  // Metadata block
  const metaItems: string[] = [];
  if (meta.subtitle) metaItems.push(`**Subtitle:** ${meta.subtitle}`);
  if (meta.subjectLine) metaItems.push(`**Subject Line:** ${meta.subjectLine}`);
  if (meta.previewText) metaItems.push(`**Preview Text:** ${meta.previewText}`);
  if (meta.seoTitle) metaItems.push(`**SEO Title:** ${meta.seoTitle}`);
  if (meta.metaDescription) metaItems.push(`**Meta Description:** ${meta.metaDescription}`);
  if (meta.readingTimeMinutes) metaItems.push(`**Reading Time:** ${meta.readingTimeMinutes} min`);
  if (meta.characterCount) metaItems.push(`**Character Count:** ${meta.characterCount}`);
  if (meta.tweetCount) metaItems.push(`**Tweet Count:** ${meta.tweetCount}`);
  if (meta.hashtags?.length) metaItems.push(`**Hashtags:** ${meta.hashtags.join(" ")}`);
  if (meta.tags?.length) metaItems.push(`**Tags:** ${meta.tags.join(", ")}`);
  if (meta.callToAction) metaItems.push(`**CTA:** ${meta.callToAction}`);
  if (meta.imagePrompts?.length) {
    metaItems.push(`**Image Prompts:**\n${meta.imagePrompts.map((p) => `- ${p}`).join("\n")}`);
  }

  if (metaItems.length > 0) {
    lines.push("---");
    lines.push(...metaItems);
    lines.push("---");
    lines.push("");
  }

  lines.push(piece.content);
  lines.push("");

  return lines.join("\n");
}

export function jobToMarkdown(job: ContentCreationJob, platforms?: Platform[]): string {
  const pieces = job.content_pieces ?? [];
  const filtered = platforms
    ? pieces.filter((p) => platforms.includes(p.platform))
    : pieces;

  const header = [
    `# Content: ${job.config.topic}`,
    "",
    `**Topic:** ${job.config.topic}`,
    `**Tone:** ${job.config.tone}`,
    `**Audience:** ${job.config.targetAudience || "General"}`,
    `**Platforms:** ${job.config.targetPlatforms.map((p) => PLATFORM_LABELS[p]).join(", ")}`,
    `**Generated:** ${new Date(job.created_at).toLocaleDateString()}`,
    "",
    "---",
    "",
  ].join("\n");

  const content = filtered.map(pieceToMarkdown).join("\n\n---\n\n");

  return header + content;
}
