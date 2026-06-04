// ── Enumerations ─────────────────────────────────────────────────────────────

export type Provider = "anthropic" | "openai" | "groq";
export type DepthTier = "tier1" | "tier2" | "tier3";
export type AudienceType =
  | "executive"
  | "technical"
  | "analyst"
  | "client"
  | "board";
export type OutputFormat = "md" | "html" | "docx";
export type AgentStatus = "idle" | "running" | "done" | "error";

// ── Configuration ─────────────────────────────────────────────────────────────

export interface ResearchConfig {
  topic: string;
  provider: Provider;
  model: string;
  depth: DepthTier;
  audience: AudienceType;
  format: OutputFormat;
  searchMyKB?: boolean;
  indexToKB?: boolean; // save the finished report back into the Knowledge Base
}

// ── Orchestrator output ───────────────────────────────────────────────────────

export interface SubTopic {
  question: string;
  primary_queries: string[];
  fallback_queries: string[];
  source_priority: string[];
  recency_requirement: "critical" | "preferred" | "not_required";
}

// ── Evidence structures ───────────────────────────────────────────────────────

export interface SourceItem {
  title: string;
  url: string;
  date: string;
  type: "primary" | "secondary" | "tertiary";
  credibility_note: string;
  relevance_score: "high" | "medium" | "low";
}

export interface SubTopicFindings {
  sub_topic: string;
  coverage: "adequate" | "partial" | "thin";
  key_assertions: Array<{ claim: string; source: string }>;
  data_points: Array<{ fact: string; source: string }>;
  notable_quotes: Array<{ text: string; source: string }>;
  gaps: string[];
  sources: SourceItem[];
}

export interface Contradiction {
  claim: string;
  source_a: string;
  source_b: string;
  resolution: "newer_wins" | "primary_wins" | "unresolved";
  note: string;
}

export interface EvidencePackage {
  sub_topics_covered: number;
  total_sources: number;
  primary_sources: number;
  date_range: { earliest: string; latest: string };
  gaps_identified: string[];
  findings: SubTopicFindings[];
  cross_cutting_insights: string[];
  contradictions: Contradiction[];
  raw_source_list: SourceItem[];
}

// ── Report structures ─────────────────────────────────────────────────────────

export interface ReportSection {
  title: string;
  assertion: string;
  findings: string[];
  data_point?: string;
  implication?: string;
}

export interface Report {
  topic: string;
  config: ResearchConfig;
  executive_summary: string;
  sections: ReportSection[];
  cross_cutting_insights: string[];
  contradictions_caveats: string;
  gaps_limitations: string[];
  recommended_actions: string[];
  source_index: SourceItem[];
  generated_at: string;
  model_used: string;
}

// ── Agent & job state ─────────────────────────────────────────────────────────

export interface AgentState {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  progress?: number;
  note?: string;
  started_at?: string;
  completed_at?: string;
}

export interface ResearchJob {
  id: string;
  user_id: string;
  status: "queued" | "running" | "done" | "error";
  config: ResearchConfig;
  agents: AgentState[];
  evidence_package?: EvidencePackage;
  report?: Report;
  error?: string;
  created_at: string;
  updated_at: string;
}

/** Lightweight job row used in history listings (no report/evidence_package). */
export interface JobSummary {
  id: string;
  user_id: string;
  status: ResearchJob["status"];
  config: ResearchConfig;
  agents: AgentState[];
  error?: string;
  created_at: string;
  updated_at: string;
}
