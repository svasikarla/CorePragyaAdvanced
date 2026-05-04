import { describe, it, expect } from "vitest";
import { TECH_RESEARCH_MODELS } from "@/lib/tech-research/models";

describe("TECH_RESEARCH_MODELS", () => {
  it("exports all three providers", () => {
    expect(TECH_RESEARCH_MODELS).toHaveProperty("anthropic");
    expect(TECH_RESEARCH_MODELS).toHaveProperty("openai");
    expect(TECH_RESEARCH_MODELS).toHaveProperty("groq");
  });

  it("each provider has at least one model", () => {
    expect(TECH_RESEARCH_MODELS.anthropic.length).toBeGreaterThanOrEqual(1);
    expect(TECH_RESEARCH_MODELS.openai.length).toBeGreaterThanOrEqual(1);
    expect(TECH_RESEARCH_MODELS.groq.length).toBeGreaterThanOrEqual(1);
  });

  it("every model has id, label, and tier fields", () => {
    const allModels = [
      ...TECH_RESEARCH_MODELS.anthropic,
      ...TECH_RESEARCH_MODELS.openai,
      ...TECH_RESEARCH_MODELS.groq,
    ];
    for (const model of allModels) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("label");
      expect(model).toHaveProperty("tier");
      expect(typeof model.id).toBe("string");
      expect(typeof model.label).toBe("string");
      expect(model.id.length).toBeGreaterThan(0);
    }
  });

  it("tier values are valid enum members", () => {
    const validTiers = new Set(["powerful", "balanced", "fast", "reasoning"]);
    const allModels = [
      ...TECH_RESEARCH_MODELS.anthropic,
      ...TECH_RESEARCH_MODELS.openai,
      ...TECH_RESEARCH_MODELS.groq,
    ];
    for (const model of allModels) {
      expect(validTiers.has(model.tier)).toBe(true);
    }
  });

  it("anthropic models include claude-sonnet identifier", () => {
    const ids = TECH_RESEARCH_MODELS.anthropic.map((m) => m.id);
    expect(ids.some((id) => id.includes("claude"))).toBe(true);
  });

  it("model IDs are unique across all providers", () => {
    const allIds = [
      ...TECH_RESEARCH_MODELS.anthropic,
      ...TECH_RESEARCH_MODELS.openai,
      ...TECH_RESEARCH_MODELS.groq,
    ].map((m) => m.id);
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
  });

  it("first anthropic model is usable as a default", () => {
    const first = TECH_RESEARCH_MODELS.anthropic[0];
    expect(first).toBeDefined();
    expect(first!.id).toBeTruthy();
  });
});
