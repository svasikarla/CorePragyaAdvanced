import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type {
  ContentCreationConfig,
  TopicAnalysis,
  ContentResearch,
  ContentOutline,
  ContentPiece,
  Platform,
  PlatformMetadata,
} from "@/types/content-creation";
import { PLATFORM_WRITER_SYSTEMS, buildContentWriterUser } from "./prompts";

interface WriterOutput {
  title: string;
  content: string;
  metadata: PlatformMetadata;
}

export async function runContentWriter(
  platform: Platform,
  topicAnalysis: TopicAnalysis,
  research: ContentResearch,
  outline: ContentOutline,
  config: ContentCreationConfig,
  kbContext: string
): Promise<ContentPiece> {
  const platformOutline = outline.platform_outlines.find((o) => o.platform === platform);

  const userMessage = buildContentWriterUser(
    platform,
    config.tone,
    config.topic,
    config.targetAudience,
    config.keywords,
    config.includeCode,
    topicAnalysis,
    research,
    platformOutline ?? outline,
    kbContext
  );

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: PLATFORM_WRITER_SYSTEMS[platform],
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 6000,
    temperature: 0.6,
  });

  const parsed = parseJSON<WriterOutput>(raw);

  // Ensure character count is set
  if (!parsed.metadata.characterCount) {
    parsed.metadata.characterCount = parsed.content.length;
  }

  // Estimate reading time if missing (avg 200 wpm)
  if (!parsed.metadata.readingTimeMinutes) {
    const wordCount = parsed.content.split(/\s+/).length;
    parsed.metadata.readingTimeMinutes = Math.ceil(wordCount / 200);
  }

  return {
    platform,
    title: parsed.title,
    content: parsed.content,
    metadata: parsed.metadata,
  };
}
