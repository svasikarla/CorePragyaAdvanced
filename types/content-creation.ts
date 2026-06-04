import type { Provider, AgentState } from "./research";

// ── Platform & Tone ───────────────────────────────────────────────────────────

export type Platform =
  | "medium"
  | "linkedin_post"
  | "linkedin_article"
  | "blog"
  | "twitter_thread"
  | "substack"
  | "devto";

export type ContentTone =
  | "professional"
  | "casual"
  | "technical"
  | "educational"
  | "conversational"
  | "storytelling";

// ── Configuration ─────────────────────────────────────────────────────────────

export interface ContentCreationConfig {
  topic: string;
  additionalContext: string;
  targetPlatforms: Platform[];
  tone: ContentTone;
  targetAudience: string;
  keywords: string;        // Comma-separated seeds for SEO / hashtags
  includeCode: boolean;
  searchMyKB: boolean;
  indexToKB?: boolean; // save generated pieces back into the Knowledge Base (opt-in)
  provider: Provider;
  model: string;
}

// ── Phase outputs ─────────────────────────────────────────────────────────────

export interface TopicAnalysis {
  summary: string;
  target_audience: string;
  key_concepts: string[];
  unique_angles: string[];
  tone_recommendation: ContentTone;
  estimated_complexity: "beginner" | "intermediate" | "advanced";
  suggested_keywords: string[];
}

export interface ContentResearch {
  key_facts: string[];
  statistics: string[];
  examples: string[];
  common_misconceptions: string[];
  expert_perspectives: string[];
  supporting_context: string;
}

export interface PlatformOutline {
  platform: Platform;
  hook: string;
  sections: Array<{ title: string; key_points: string[] }>;
  cta: string;
}

export interface ContentOutline {
  core_message: string;
  platform_outlines: PlatformOutline[];
}

// ── Content piece (one per platform) ─────────────────────────────────────────

export interface PlatformMetadata {
  hashtags?: string[];
  tags?: string[];
  seoTitle?: string;
  metaDescription?: string;
  readingTimeMinutes?: number;
  characterCount?: number;
  tweetCount?: number;
  imagePrompts?: string[];
  callToAction?: string;
  subtitle?: string;
  subjectLine?: string;
  previewText?: string;
}

export interface ContentPiece {
  platform: Platform;
  title: string;
  content: string;
  metadata: PlatformMetadata;
}

// ── Job ───────────────────────────────────────────────────────────────────────

export interface ContentCreationJob {
  id: string;
  user_id: string;
  status: "queued" | "running" | "done" | "error";
  config: ContentCreationConfig;
  agents: AgentState[];
  topic_analysis?: TopicAnalysis;
  research?: ContentResearch;
  outline?: ContentOutline;
  content_pieces?: ContentPiece[];
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentJobSummary {
  id: string;
  user_id: string;
  status: ContentCreationJob["status"];
  config: ContentCreationConfig;
  agents: AgentState[];
  error?: string;
  created_at: string;
  updated_at: string;
}

// ── Platform display helpers ──────────────────────────────────────────────────

export const PLATFORM_LABELS: Record<Platform, string> = {
  medium: "Medium",
  linkedin_post: "LinkedIn Post",
  linkedin_article: "LinkedIn Article",
  blog: "Blog Post",
  twitter_thread: "X Thread",
  substack: "Substack",
  devto: "Dev.to",
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  medium: "bg-green-50 text-green-700 border-green-200",
  linkedin_post: "bg-blue-50 text-blue-700 border-blue-200",
  linkedin_article: "bg-blue-50 text-blue-700 border-blue-200",
  blog: "bg-violet-50 text-violet-700 border-violet-200",
  twitter_thread: "bg-slate-50 text-slate-700 border-slate-200",
  substack: "bg-orange-50 text-orange-700 border-orange-200",
  devto: "bg-pink-50 text-pink-700 border-pink-200",
};
