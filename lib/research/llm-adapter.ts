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
  temperature?: number;
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
    temperature: params.temperature ?? 0.2,
    max_tokens: params.max_tokens ?? 4096,
  });

  return response.content;
}

/**
 * Safely parse JSON from LLM output.
 * Handles ```json ... ``` fencing, leading prose, truncated output, and nested objects.
 */
export function parseJSON<T>(text: string): T {
  // Strip markdown code fences
  const stripped = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  // 1. Direct parse
  try {
    return JSON.parse(stripped) as T;
  } catch { /* fall through */ }

  // 2. Extract first top-level JSON object or array
  const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    try {
      return JSON.parse(match[0]) as T;
    } catch { /* fall through */ }
  }

  // 3. Attempt repair: if output is truncated mid-JSON, close all open brackets
  try {
    const repaired = repairTruncatedJSON(stripped);
    return JSON.parse(repaired) as T;
  } catch { /* fall through */ }

  throw new Error(
    `Could not parse JSON from LLM response. First 600 chars:\n${text.slice(0, 600)}`
  );
}

/**
 * Best-effort repair of truncated JSON by closing unclosed brackets/braces.
 * Handles the common case where a large LLM output is cut off mid-object.
 */
function repairTruncatedJSON(text: string): string {
  // Find the start of the JSON object
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found");

  let s = text.slice(start);

  // Track bracket depth to close what's open
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  // If we're mid-string, close it
  if (inString) s += '"';

  // Close any open arrays/objects in reverse order
  s += stack.reverse().join("");

  return s;
}
