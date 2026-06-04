import { getLLMProvider } from "@/lib/ai-clients";
import type { RefineContext, RefinedVariant } from "@/types/prompt-refiner";

const REFINER_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an expert prompt engineer. Your job is to rewrite a user's raw prompt into TWO high-quality, ready-to-use prompts that apply prompt-engineering best practices.

Apply, where appropriate, these techniques:
- ROLE / PERSONA: give the model a clear identity and expertise.
- PURPOSE / TASK: state the objective unambiguously.
- CONTEXT: include relevant background the model needs.
- OUTPUT FORMAT: specify structure, length, and style of the answer.
- EXAMPLES: add a short illustrative example or few-shot pattern when it helps.
- CONSTRAINTS: list do's, don'ts, tone, and edge-case handling.
- REASONING: ask for step-by-step thinking when the task warrants it.

Produce TWO genuinely different variants:
- Variant 1: "Concise & Direct" — tightly structured, minimal, production-ready.
- Variant 2: "Detailed & Structured" — richer, with role, context, format spec, and an example.

Preserve the user's original intent. Do NOT answer the prompt itself — only rewrite it.

Return ONLY valid JSON (no markdown fences, no prose) matching exactly:
{
  "variants": [
    {
      "title": "Concise & Direct",
      "prompt": "<the full refined prompt text>",
      "techniques": ["Role", "Output format", "Constraints"],
      "rationale": "<1-2 sentences on why this version works>"
    },
    {
      "title": "Detailed & Structured",
      "prompt": "<the full refined prompt text>",
      "techniques": ["Role", "Purpose", "Context", "Examples", "Output format", "Constraints"],
      "rationale": "<1-2 sentences on why this version works>"
    }
  ]
}`;

function buildUserMessage(prompt: string, context?: RefineContext): string {
  const hints: string[] = [];
  if (context?.role) hints.push(`- Preferred role/persona: ${context.role}`);
  if (context?.outputFormat) hints.push(`- Desired output format: ${context.outputFormat}`);
  if (context?.audience) hints.push(`- Audience / tone: ${context.audience}`);
  if (context?.targetModel) hints.push(`- Target model: ${context.targetModel}`);

  return [
    "Refine the following prompt.",
    "",
    "RAW PROMPT:",
    `"""${prompt.trim()}"""`,
    hints.length ? "\nOPTIONAL HINTS (incorporate when sensible):\n" + hints.join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Strip accidental ```json fences and parse the model's JSON response. */
function parseVariants(raw: string): RefinedVariant[] {
  let text = raw.trim();
  // Remove surrounding code fences if the model added them.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Fall back to slicing from the first { to the last } if there's stray prose.
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
  }

  const parsed = JSON.parse(text) as { variants?: unknown };
  if (!parsed.variants || !Array.isArray(parsed.variants)) {
    throw new Error("Model response did not contain a variants array");
  }

  return parsed.variants.map((v): RefinedVariant => {
    const variant = v as Partial<RefinedVariant>;
    return {
      title: typeof variant.title === "string" ? variant.title : "Refined prompt",
      prompt: typeof variant.prompt === "string" ? variant.prompt : "",
      techniques: Array.isArray(variant.techniques)
        ? variant.techniques.filter((t): t is string => typeof t === "string")
        : [],
      rationale: typeof variant.rationale === "string" ? variant.rationale : "",
    };
  });
}

export interface RefineResult {
  variants: RefinedVariant[];
  model: string;
}

/**
 * Refine a raw prompt into two best-practice variants using the configured LLM.
 * Throws if the model output cannot be parsed.
 */
export async function refinePrompt(
  prompt: string,
  context?: RefineContext
): Promise<RefineResult> {
  const llm = getLLMProvider();
  const response = await llm.createCompletion({
    model: REFINER_MODEL,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(prompt, context) }],
    temperature: 0.4,
    max_tokens: 2000,
  });

  const variants = parseVariants(response.content);
  if (variants.length === 0) {
    throw new Error("No refined variants were produced");
  }

  return { variants, model: REFINER_MODEL };
}
