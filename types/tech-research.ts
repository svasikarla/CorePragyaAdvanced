// ── Re-export shared primitives ───────────────────────────────────────────────

export type { Provider, DepthTier, OutputFormat, AgentStatus } from "./research";

// ── Enumerations ──────────────────────────────────────────────────────────────

export type FocusArea =
  | "frontend"
  | "backend"
  | "database"
  | "infrastructure"
  | "security"
  | "mobile"
  | "ai_ml"
  | "general";

// ── Configuration ─────────────────────────────────────────────────────────────

export interface EvaluationCriteria {
  performance: number;       // 1–5 weighting
  developer_experience: number;
  maturity: number;
  cost: number;
  security: number;
}

export interface TechResearchConfig {
  requirement: string;       // The requirement statement (min 10, max 1000 chars)
  current_stack: string;     // Existing tech stack (e.g. "Next.js 15, Supabase, TypeScript")
  constraints: string;       // Budget/team/timeline constraints (optional, max 500)
  criteria: EvaluationCriteria;
  provider: import("./research").Provider;
  model: string;
  depth: import("./research").DepthTier;
  format: import("./research").OutputFormat;
  focus_area: FocusArea;
  searchMyKB?: boolean;
  indexToKB?: boolean; // save the finished report back into the Knowledge Base
}

// ── Phase 1: Requirement analysis ─────────────────────────────────────────────

export interface FunctionalRequirement {
  description: string;
  priority: "must_have" | "should_have" | "nice_to_have";
}

export interface NonFunctionalRequirement {
  category: "performance" | "scalability" | "security" | "reliability" | "maintainability" | "cost";
  description: string;
  measurable_target?: string;
}

export interface TechConstraint {
  type: "stack_compatibility" | "budget" | "team_expertise" | "timeline" | "licensing" | "regulatory";
  description: string;
}

export interface RequirementAnalysis {
  summary: string;
  functional: FunctionalRequirement[];
  non_functional: NonFunctionalRequirement[];
  constraints: TechConstraint[];
  open_questions: string[];
  search_keywords: string[];
}

// ── Phase 2: Solution landscape ───────────────────────────────────────────────

export interface TechCandidate {
  name: string;
  category: "library" | "framework" | "service" | "protocol" | "pattern" | "platform";
  approach: "open_source" | "commercial" | "build_from_scratch" | "hybrid";
  description: string;
  primary_search_queries: string[];
  website?: string;
}

export interface SolutionLandscape {
  candidates: TechCandidate[];
  build_vs_buy_note: string;
  excluded_approaches: Array<{ name: string; reason: string }>;
}

// ── Phase 3: Technology evaluation ───────────────────────────────────────────

export interface TechMetrics {
  github_stars?: number;
  npm_weekly_downloads?: number;
  last_release?: string;
  license?: string;
  bundle_size?: string;
  latest_version?: string;
}

export interface CriterionScore {
  criterion: keyof EvaluationCriteria;
  score: number;          // 1–5
  rationale: string;
  evidence: string;       // Source citation
}

export interface TechEvaluation {
  candidate_name: string;
  metrics: TechMetrics;
  scores: CriterionScore[];
  weighted_total: number;
  pros: string[];
  cons: string[];
  stack_compatibility_note: string;
  known_gotchas: string[];
  migration_complexity: "low" | "medium" | "high";
  community_health: "thriving" | "stable" | "declining" | "unknown";
  security_cves: string;
  sources: import("./research").SourceItem[];
}

// ── Phase 4: Trade-off analysis ───────────────────────────────────────────────

export interface MatrixRow {
  candidate: string;
  scores: Record<keyof EvaluationCriteria, number>;
  weighted_total: number;
  rank: number;
}

export interface TradeoffMatrix {
  criteria_weights: EvaluationCriteria;
  rows: MatrixRow[];
  winner: string;
  runner_up: string;
  confidence: "high" | "medium" | "low";
  key_differentiators: string[];
  non_obvious_tradeoffs: string[];
}

// ── Phase 5: Architecture blueprint ──────────────────────────────────────────

export interface ImplementationPhase {
  phase: number;
  title: string;
  duration_estimate: string;
  tasks: string[];
  deliverable: string;
}

export interface CodeSnippet {
  description: string;
  language: string;
  code: string;
}

export interface ArchitectureBlueprint {
  recommended_solution: string;
  rationale: string;
  integration_overview: string;
  folder_structure: string;
  key_interfaces: string[];
  configuration_notes: string[];
  code_snippets: CodeSnippet[];
  phases: ImplementationPhase[];
  risks: Array<{ risk: string; mitigation: string }>;
  success_metrics: string[];
}

// ── Final report ──────────────────────────────────────────────────────────────

export interface TechReport {
  requirement: string;
  config: TechResearchConfig;
  verdict: string;                          // One-sentence recommendation
  executive_summary: string;
  requirement_analysis: RequirementAnalysis;
  solution_landscape: SolutionLandscape;
  evaluations: TechEvaluation[];
  tradeoff_matrix: TradeoffMatrix;
  architecture_blueprint: ArchitectureBlueprint;
  compatibility_warnings: string[];
  source_index: import("./research").SourceItem[];
  generated_at: string;
  model_used: string;
}

// ── Agent & job state ─────────────────────────────────────────────────────────

export interface TechResearchJob {
  id: string;
  user_id: string;
  status: "queued" | "running" | "done" | "error";
  config: TechResearchConfig;
  agents: import("./research").AgentState[];
  requirement_analysis?: RequirementAnalysis;
  solution_landscape?: SolutionLandscape;
  evaluations?: TechEvaluation[];
  tradeoff_matrix?: TradeoffMatrix;
  report?: TechReport;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface TechJobSummary {
  id: string;
  user_id: string;
  status: TechResearchJob["status"];
  config: TechResearchConfig;
  agents: import("./research").AgentState[];
  error?: string;
  created_at: string;
  updated_at: string;
}
