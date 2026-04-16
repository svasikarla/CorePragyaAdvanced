/**
 * LLM adapter for the research module.
 *
 * Routes calls to CorePragya's existing LLMProvider classes, avoiding any
 * direct dependency on AI SDK versions. No new SDK imports needed.
 */

import { AnthropicProvider, OpenAIProvider, GroqProvider } from "@/lib/llm-provider";
import type { Provider } from "@/types/research";

export interface LLMCallParams {
  provider: Provider;
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  max_tokens?: number;
}

export async function callLLM(params: LLMCallParams): Promise<string> {
  let llmProvider;

  switch (params.provider) {
    case "anthropic":
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
      }
      llmProvider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
      break;
    case "openai":
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured on the server.");
      }
      llmProvider = new OpenAIProvider(process.env.OPENAI_API_KEY);
      break;
    case "groq":
      if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is not configured on the server.");
      }
      llmProvider = new GroqProvider(process.env.GROQ_API_KEY);
      break;
    default:
      throw new Error(`Unknown provider: ${params.provider}`);
  }

  const response = await llmProvider.createCompletion({
    model: params.model,
    system: params.system,
    messages: params.messages,
    temperature: 0.2,
    max_tokens: params.max_tokens ?? 4096,
  });

  return response.content;
}

/**
 * Safely parse JSON from LLM output.
 * Handles ```json ... ``` fencing and leading/trailing prose.
 */
export function parseJSON<T>(text: string): T {
  // Strip markdown code fences
  const stripped = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  // Extract first JSON object or array
  const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) {
    throw new Error(
      `No JSON found in LLM response. Response was:\n${text.slice(0, 300)}`
    );
  }
  return JSON.parse(match[0]) as T;
}
