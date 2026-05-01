import { callLLM, parseJSON } from "@/lib/research/llm-adapter";
import type { EvidencePackage, Report, ResearchConfig } from "@/types/research";
import { SYNTHESIZER_SYSTEM } from "./prompts";

const AUDIENCE_INSTRUCTIONS: Record<string, string> = {
  executive: "Senior C-suite executives. Lead with strategic impact and financial implications. Use plain language. 3–4 findings per section. Each recommended action must name an owner type and a timeframe.",
  technical: "Engineering and architecture practitioners. Include implementation specifics, version numbers, benchmarks, code-level implications. 5–7 findings per section. Recommended actions should reference specific tools or frameworks.",
  analyst:   "Research and strategy analysts. Provide multi-perspective nuance, quantify uncertainty, note methodology limitations. 4–6 findings per section. Recommended actions should include how to measure success.",
  client:    "External client stakeholders. Consultative and reassuring tone. Explain acronyms. Focus on practical next steps and business value. 3–5 findings per section. Recommended actions should be client-facing.",
  board:     "Board of directors. Governance-first framing. Risk vs opportunity balance. Maximum 3 sections with 3 findings each. Recommended actions should reference board-level decisions or oversight mechanisms.",
};

// Token budget per depth tier — deeper research = more content
const MAX_TOKENS: Record<string, number> = {
  tier1: 6000,
  tier2: 9000,
  tier3: 12000,
};

// Section count target per depth tier
const SECTION_COUNT: Record<string, number> = {
  tier1: 3,
  tier2: 4,
  tier3: 5,
};

type SynthesizedReport = Omit<
  Report,
  "topic" | "config" | "source_index" | "generated_at" | "model_used"
>;

export async function runSynthesizer(
  evidence: EvidencePackage,
  config: ResearchConfig,
  kbContext: string = "",
  domainContext: string = ""
): Promise<Report> {
  const today = new Date().toISOString().split("T")[0];
  const targetSections = SECTION_COUNT[config.depth] ?? 4;
  const maxTokens = MAX_TOKENS[config.depth] ?? 9000;

  const evidenceSummary = evidence.findings
    .map(
      (f) =>
        `## ${f.sub_topic}\nCoverage: ${f.coverage}\n` +
        `Key assertions:\n${f.key_assertions.map((a) => `- ${a.claim} [Source: ${a.source}]`).join("\n")}\n` +
        (f.data_points.length > 0
          ? `Data points:\n${f.data_points.map((d) => `- ${d.fact} [Source: ${d.source}]`).join("\n")}\n`
          : "") +
        (f.notable_quotes.length > 0
          ? `Notable quotes:\n${f.notable_quotes.map((q) => `- "${q.text}" — ${q.source}`).join("\n")}\n`
          : "") +
        (f.gaps.length > 0 ? `Gaps: ${f.gaps.join("; ")}\n` : "")
    )
    .join("\n\n");

  const contradictions =
    evidence.contradictions.length > 0
      ? evidence.contradictions.map((c) => `${c.claim}: ${c.note} (${c.resolution})`).join("; ")
      : "No explicit contradictions identified — note coverage gaps where they exist.";

  const kbSection = kbContext
    ? `\n## Personal Knowledge Base (user's prior research — treat as first-party context, cite as [KB])\n${kbContext}\n`
    : "";

  const domainLine = domainContext
    ? `Domain context: ${domainContext}\n`
    : "";

  const prompt = `Research topic: "${config.topic}"
Today's date: ${today}
${domainLine}Audience: ${AUDIENCE_INSTRUCTIONS[config.audience] ?? config.audience}
Depth: ${config.depth} — write exactly ${targetSections} sections
${kbSection}
## Web Evidence Package
${evidenceSummary}

Cross-cutting observations from the evidence: ${evidence.cross_cutting_insights.join("; ") || "None noted"}
Contradictions in evidence: ${contradictions}
Identified gaps: ${evidence.gaps_identified.join("; ") || "None identified"}
Source quality: ${evidence.primary_sources} primary sources out of ${evidence.total_sources} total

Instructions:
1. Write exactly ${targetSections} sections — no more, no fewer
2. Every claim must include an inline [Source: X — Date] citation
3. Use the citation format exactly as shown — not footnotes, not endnotes
4. Do not invent data or sources not present in the evidence package above
5. If coverage for a sub-topic was "thin", acknowledge this explicitly in that section
${kbContext ? "6. Where the personal KB contains relevant context, integrate it and label as [KB]" : ""}

Write the complete research report now.`;

  const raw = await callLLM({
    provider: config.provider,
    model: config.model,
    system: SYNTHESIZER_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.4, // Higher than extraction agents — prose quality needs creativity
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
