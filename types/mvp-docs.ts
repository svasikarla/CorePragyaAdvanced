import type { Provider, AgentState } from "./research";

// ── Document types ──────────────────────────────────────────────────────────────

export type DocType =
  // Product & Business ("The Why & What")
  | "vision"
  | "prd"
  | "personas"
  | "gtm"
  | "success_metrics"
  | "competitive_analysis"
  | "roadmap"
  | "risk_log"
  // Engineering & Technical ("The How")
  | "system_architecture"
  | "data_model"
  | "api_contract"
  | "security_spec"
  | "testing_strategy"
  | "tech_stack"
  | "deployment"
  | "observability";

export type DocGroup = "product" | "engineering";

// ── Configuration ───────────────────────────────────────────────────────────────

export interface MvpDocsConfig {
  productBrief: string; // The product brief — the single input the whole bundle is derived from
  additionalContext: string;
  productName: string;
  targetDocs: DocType[];
  targetAudience: string; // Who the product serves
  searchMyKB: boolean;
  provider: Provider;
  model: string;
}

// ── Phase 1: Brief Analysis (shared source of truth) ────────────────────────────

export interface TargetUser {
  persona: string;
  job_to_be_done: string;
}

export interface BriefAnalysis {
  product_summary: string;
  problem_statement: string;
  target_users: TargetUser[];
  core_features: string[];
  out_of_scope: string[];
  key_constraints: string[];
  assumptions: string[];
  success_metrics: string[];
}

// ── Phase 2: Generated documents (one per DocType) ──────────────────────────────

export interface DocMetadata {
  summary?: string;
  sections?: string[]; // Section titles for a table of contents
  wordCount?: number;
}

export interface MvpDocument {
  docType: DocType;
  title: string;
  content: string; // Markdown
  metadata: DocMetadata;
}

// ── Phase 3: Cross-document consistency report ──────────────────────────────────

export interface Contradiction {
  docs: string[];
  issue: string;
  recommendation: string;
}

export interface ConsistencyReport {
  overall_consistency: "high" | "medium" | "low";
  contradictions: Contradiction[];
  coverage_gaps: string[];
  strengths: string[];
}

// ── Job ─────────────────────────────────────────────────────────────────────────

export interface MvpDocsJob {
  id: string;
  user_id: string;
  status: "queued" | "running" | "done" | "error";
  config: MvpDocsConfig;
  agents: AgentState[];
  brief_analysis?: BriefAnalysis;
  documents?: MvpDocument[];
  consistency_report?: ConsistencyReport;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface MvpDocsJobSummary {
  id: string;
  user_id: string;
  status: MvpDocsJob["status"];
  config: MvpDocsConfig;
  agents: AgentState[];
  error?: string;
  created_at: string;
  updated_at: string;
}

// ── Display helpers ─────────────────────────────────────────────────────────────

export const DOC_LABELS: Record<DocType, string> = {
  vision: "Vision & Strategy Brief",
  prd: "Product Requirements Document",
  personas: "User Personas & JTBD",
  gtm: "Go-To-Market Plan",
  success_metrics: "Success Metrics & KPIs",
  competitive_analysis: "Competitive Analysis",
  roadmap: "Product Roadmap",
  risk_log: "Risk Log",
  system_architecture: "System Architecture",
  data_model: "Data Model & ERD",
  api_contract: "API Contract",
  security_spec: "Security Specification",
  testing_strategy: "Testing Strategy",
  tech_stack: "Tech Stack Decision Record",
  deployment: "Deployment & Infrastructure",
  observability: "Observability & Monitoring",
};

export const DOC_DESCRIPTIONS: Record<DocType, string> = {
  vision: "The why — north star, positioning",
  prd: "Functional & non-functional requirements",
  personas: "Who it's for and their jobs-to-be-done",
  gtm: "Launch, channels, pricing motion",
  success_metrics: "How you measure MVP success",
  competitive_analysis: "Landscape & differentiation",
  roadmap: "MVP scope and what comes after",
  risk_log: "Risks, likelihood, mitigations",
  system_architecture: "Components, boundaries, data flow",
  data_model: "Entities, relationships, schema",
  api_contract: "Endpoints, payloads, error codes",
  security_spec: "AuthN/Z, data protection, threats",
  testing_strategy: "Test pyramid, coverage, CI gates",
  tech_stack: "Stack choices with rationale (ADR)",
  deployment: "Environments, CI/CD, infra",
  observability: "Logging, metrics, alerting, SLOs",
};

export const DOC_GROUP: Record<DocType, DocGroup> = {
  vision: "product",
  prd: "product",
  personas: "product",
  gtm: "product",
  success_metrics: "product",
  competitive_analysis: "product",
  roadmap: "product",
  risk_log: "product",
  system_architecture: "engineering",
  data_model: "engineering",
  api_contract: "engineering",
  security_spec: "engineering",
  testing_strategy: "engineering",
  tech_stack: "engineering",
  deployment: "engineering",
  observability: "engineering",
};

export const DOC_GROUP_LABELS: Record<DocGroup, string> = {
  product: "Product & Business — The Why & What",
  engineering: "Engineering & Technical — The How",
};

export const PRODUCT_DOC_TYPES: DocType[] = [
  "vision",
  "prd",
  "personas",
  "gtm",
  "success_metrics",
  "competitive_analysis",
  "roadmap",
  "risk_log",
];

export const ENGINEERING_DOC_TYPES: DocType[] = [
  "system_architecture",
  "data_model",
  "api_contract",
  "security_spec",
  "testing_strategy",
  "tech_stack",
  "deployment",
  "observability",
];

export const ALL_DOC_TYPES: DocType[] = [...PRODUCT_DOC_TYPES, ...ENGINEERING_DOC_TYPES];

export const DOC_GROUP_COLORS: Record<DocGroup, string> = {
  product: "bg-indigo-50 text-indigo-700 border-indigo-200",
  engineering: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
