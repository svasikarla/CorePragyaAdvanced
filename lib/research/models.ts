export const RESEARCH_MODELS = {
  anthropic: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "balanced" as const },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6", tier: "powerful" as const },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", tier: "fast" as const },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o", tier: "powerful" as const },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", tier: "fast" as const },
    { id: "o3-mini", label: "o3 Mini", tier: "reasoning" as const },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", tier: "powerful" as const },
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", tier: "fast" as const },
    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", tier: "balanced" as const },
  ],
} as const;

export type ModelTier = "powerful" | "balanced" | "fast" | "reasoning";

export interface ModelInfo {
  id: string;
  label: string;
  tier: ModelTier;
}
