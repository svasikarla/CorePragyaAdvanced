import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { EvidencePackage, Report, ResearchConfig } from "@/types/research";
import { SYNTHESIZER_SYSTEM } from "./prompts";

const AUDIENCE_INSTRUCTIONS: Record<string, string> = {
  executive: "Senior executives: crisp, outcomes-focused, minimal jargon, emphasise ROI and risk",
  technical: "Technical practitioners: precise, detailed, implementation-focused with specifics",
  analyst: "Research analysts: balanced, sourced, nuanced with multiple perspectives and caveats",
  client: "Client stakeholders: consultative, trust-building, clear next steps and recommendations",
  board: "Board members: governance-focused, risk-aware, high-level strategic implications only",
};

type SynthesizedReport = Omit<
  Report,
  "topic" | "config" | "source_index" | "generated_at" | "model_used"
>;

export async function runSynthesizer(
  evidence: EvidencePackage,
  config: ResearchConfig
): Promise<Report> {
  const evidenceSummary = evidence.findings
    .map(
      (f) =>
        `## ${f.sub_topic}\nCoverage: ${f.coverage}\n` +
        `Key assertions:\n${f.key_assertions.map((a) => `- ${a.claim} (${a.source})`).join("\n")}\n` +
        `Data points:\n${f.data_points.map((d) => `- ${d.fact} (${d.source})`).join("\n")}\n` +
        (f.notable_quotes.length > 0
          ? `Notable quotes:\n${f.notable_quotes.map((q) => `- "${q.text}" — ${q.source}`).join("\n")}\n`
          : "")
    )
    .join("\n\n");

  const contradictions =
    evidence.contradictions.length > 0
      ? evidence.contradictions.map((c) => `${c.claim}: ${c.note}`).join("; ")
      : "None identified";

  const prompt = `Research topic: "${config.topic}"
Audience: ${AUDIENCE_INSTRUCTIONS[config.audience] ?? config.audience}
Depth: ${config.depth}

Evidence package:
${evidenceSummary}

Cross-cutting observations: ${evidence.cross_cutting_insights.join("; ") || "None"}
Contradictions: ${contradictions}
Gaps: ${evidence.gaps_identified.join("; ") || "None identified"}

Write a complete research report synthesising this evidence.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: SYNTHESIZER_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 8000,
  });

  const synthesized = parseJSON<SynthesizedReport>(raw);

  return {
    ...synthesized,
    topic: config.topic,
    config,
    source_index: evidence.raw_source_list,
    generated_at: new Date().toISOString(),
    model_used: config.model,
  };
}
