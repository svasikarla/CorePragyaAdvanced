import { describe, it, expect } from "vitest";
import {
  REQUIREMENT_ANALYZER_SYSTEM,
  SOLUTION_SCANNER_SYSTEM,
  TECHNOLOGY_EVALUATOR_SYSTEM,
  TRADEOFF_ANALYST_SYSTEM,
  ARCHITECTURE_SYNTHESIZER_SYSTEM,
} from "@/lib/tech-research/agents/prompts";

describe("REQUIREMENT_ANALYZER_SYSTEM", () => {
  it("instructs JSON-only output", () => {
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("Respond ONLY with valid JSON");
  });
  it("defines functional/non_functional/constraints/open_questions/search_keywords schema", () => {
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("functional");
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("non_functional");
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("constraints");
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("open_questions");
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("search_keywords");
  });
  it("defines priority values", () => {
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("must_have");
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("should_have");
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("nice_to_have");
  });
  it("defines constraint type categories", () => {
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("stack_compatibility");
    expect(REQUIREMENT_ANALYZER_SYSTEM).toContain("licensing");
  });
  it("is a non-empty string", () => {
    expect(typeof REQUIREMENT_ANALYZER_SYSTEM).toBe("string");
    expect(REQUIREMENT_ANALYZER_SYSTEM.length).toBeGreaterThan(500);
  });
});

describe("SOLUTION_SCANNER_SYSTEM", () => {
  it("instructs JSON-only output", () => {
    expect(SOLUTION_SCANNER_SYSTEM).toContain("Respond ONLY with valid JSON");
  });
  it("defines candidates array schema", () => {
    expect(SOLUTION_SCANNER_SYSTEM).toContain("candidates");
    expect(SOLUTION_SCANNER_SYSTEM).toContain("build_vs_buy_note");
    expect(SOLUTION_SCANNER_SYSTEM).toContain("excluded_approaches");
  });
  it("defines candidate category options", () => {
    expect(SOLUTION_SCANNER_SYSTEM).toContain("library");
    expect(SOLUTION_SCANNER_SYSTEM).toContain("framework");
    expect(SOLUTION_SCANNER_SYSTEM).toContain("service");
    expect(SOLUTION_SCANNER_SYSTEM).toContain("pattern");
  });
  it("defines approach options", () => {
    expect(SOLUTION_SCANNER_SYSTEM).toContain("open_source");
    expect(SOLUTION_SCANNER_SYSTEM).toContain("commercial");
    expect(SOLUTION_SCANNER_SYSTEM).toContain("build_from_scratch");
  });
  it("defines primary_search_queries field", () => {
    expect(SOLUTION_SCANNER_SYSTEM).toContain("primary_search_queries");
  });
});

describe("TECHNOLOGY_EVALUATOR_SYSTEM", () => {
  it("instructs JSON-only output", () => {
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("Respond ONLY with valid JSON");
  });
  it("defines scoring rubric for all 5 criteria", () => {
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("performance");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("developer_experience");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("maturity");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("cost");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("security");
  });
  it("defines scores array with criterion field", () => {
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("scores");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("criterion");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("rationale");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("evidence");
  });
  it("defines community_health values", () => {
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("thriving");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("stable");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("declining");
  });
  it("defines migration_complexity values", () => {
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("low");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("medium");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("high");
  });
  it("defines metrics fields including github_stars and license", () => {
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("github_stars");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("license");
    expect(TECHNOLOGY_EVALUATOR_SYSTEM).toContain("latest_version");
  });
});

describe("TRADEOFF_ANALYST_SYSTEM", () => {
  it("instructs JSON-only output", () => {
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("Respond ONLY with valid JSON");
  });
  it("defines matrix schema with rows, winner, runner_up", () => {
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("rows");
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("winner");
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("runner_up");
  });
  it("defines confidence levels", () => {
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("high");
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("medium");
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("low");
  });
  it("defines key_differentiators and non_obvious_tradeoffs", () => {
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("key_differentiators");
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("non_obvious_tradeoffs");
  });
  it("describes weighted scoring formula", () => {
    expect(TRADEOFF_ANALYST_SYSTEM).toContain("weighted_total");
  });
});

describe("ARCHITECTURE_SYNTHESIZER_SYSTEM", () => {
  it("instructs JSON-only output", () => {
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("Respond ONLY with valid JSON");
  });
  it("defines blueprint sections", () => {
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("integration_overview");
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("folder_structure");
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("key_interfaces");
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("code_snippets");
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("phases");
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("risks");
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("success_metrics");
  });
  it("defines phase structure", () => {
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("duration_estimate");
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("deliverable");
  });
  it("defines code snippet language field", () => {
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("typescript");
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("language");
  });
  it("defines risk mitigation structure", () => {
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("mitigation");
    expect(ARCHITECTURE_SYNTHESIZER_SYSTEM).toContain("risk");
  });
});
