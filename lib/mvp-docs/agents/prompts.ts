import type { DocType, BriefAnalysis, MvpDocsConfig } from "@/types/mvp-docs";
import { DOC_LABELS } from "@/types/mvp-docs";

// ── Phase 1: Brief Analyzer ─────────────────────────────────────────────────────

export const BRIEF_ANALYZER_SYSTEM = `You are a senior product strategist. You analyze a raw product brief and extract a rigorous, structured foundation that EVERY downstream document (PRD, architecture, GTM, etc.) will build on.

This analysis is the single source of truth for the whole document bundle, so it must be precise, decisive, and internally consistent. Where the brief is silent, make a reasonable, explicit assumption rather than leaving it vague — list those under "assumptions".

Rules:
- Be concrete and specific to THIS product; never produce generic boilerplate.
- target_users must pair a real persona with the job they hire the product to do.
- core_features are the MVP scope; out_of_scope is what you are deliberately deferring.
- success_metrics must be measurable.

Return ONLY valid JSON matching this schema:
{
  "product_summary": "2-3 sentence plain-language summary of what this product is",
  "problem_statement": "the core problem being solved, and for whom",
  "target_users": [{ "persona": "who they are", "job_to_be_done": "the job they hire the product for" }],
  "core_features": ["MVP feature 1", "MVP feature 2", ...],
  "out_of_scope": ["explicitly deferred item", ...],
  "key_constraints": ["technical/business/regulatory constraint", ...],
  "assumptions": ["assumption made where the brief was silent", ...],
  "success_metrics": ["measurable metric for MVP success", ...]
}`;

export function buildBriefAnalyzerUser(config: MvpDocsConfig): string {
  return `PRODUCT NAME: ${config.productName || "Unnamed product"}

PRODUCT BRIEF:
${config.productBrief}

ADDITIONAL CONTEXT: ${config.additionalContext || "None provided"}
TARGET AUDIENCE: ${config.targetAudience || "Not specified"}

Analyze this brief and produce the structured JSON foundation.`;
}

// ── Phase 2: Document Generator ─────────────────────────────────────────────────

export const DOC_GENERATOR_SYSTEM = `You are an expert product & engineering documentation specialist. You generate a single, polished, publication-ready MVP document.

You will receive a structured brief analysis (the shared source of truth), the product context, and specific guidance for exactly one document type. Produce only that document.

Rules:
- Ground every statement in the brief analysis. NEVER invent features, users, or scope that the brief analysis does not support.
- Stay internally consistent with the brief so this document agrees with its sibling documents (the PRD, data model, and API contract must not contradict each other).
- Be concrete and decision-oriented — no filler, no "TBD" where a reasonable decision can be made (mark genuine unknowns as open questions).
- Use clean GitHub-flavored Markdown: H2 (##) section headings, tables where they add clarity, fenced code blocks for schemas/contracts.
- Do not include a top-level H1 title inside content — the title is returned separately.

Return ONLY valid JSON:
{
  "title": "the document title",
  "content": "the full markdown document body (no H1)",
  "metadata": {
    "summary": "1-2 sentence summary of this document",
    "sections": ["Section heading 1", "Section heading 2", ...]
  }
}`;

// Per-document-type guidance. Each entry is appended to the shared system prompt.
export const DOC_GENERATOR_GUIDANCE: Record<DocType, string> = {
  vision: `Produce a VISION & STRATEGY BRIEF.
Sections: ## Vision Statement (one north-star sentence) · ## Problem & Opportunity · ## Target Users · ## Value Proposition · ## Positioning (for [user] who [need], the product is a [category] that [benefit], unlike [alternative]) · ## Strategic Pillars · ## What Success Looks Like.`,

  prd: `Produce a PRODUCT REQUIREMENTS DOCUMENT (PRD) following this exact 9-section structure:
## 1. Problem Statement
## 2. Jobs-To-Be-Done — a table | User | Situation | Motivation | Expected Outcome |
## 3. Functional Requirements — grouped, each tagged with MoSCoW priority (Must/Should/Could/Won't)
## 4. User Stories — each as "As a [user], I want [goal] so that [benefit]" with Given/When/Then acceptance criteria
## 5. Data & API Boundaries — a table | Entity/Endpoint | Owner | Consumed By | Notes |
## 6. Non-Functional Requirements (NFRs) — performance, scalability, accessibility, etc.
## 7. Assumptions & Dependencies
## 8. Risk Log — a table | Risk | Likelihood | Impact | Mitigation |
## 9. Revision History — a table | Version | Date | Author | Change | (seed with v0.1 initial draft)
This PRD is the schema other documents target — be exhaustive and unambiguous.`,

  personas: `Produce a USER PERSONAS & JOBS-TO-BE-DONE document.
For each target user from the brief: ## [Persona Name] with sub-points — Profile, Goals, Pain Points, Jobs-To-Be-Done (When… I want to… so I can…), and How the MVP Helps. End with a ## Persona Priority table ranking which persona the MVP optimizes for.`,

  gtm: `Produce a GO-TO-MARKET PLAN.
Sections: ## Target Segment & ICP · ## Positioning & Messaging · ## Pricing & Packaging (hypothesis) · ## Channels (acquisition) · ## Launch Plan (phased) · ## Key GTM Metrics (CAC, activation, etc.) · ## Risks & Assumptions.`,

  success_metrics: `Produce a SUCCESS METRICS & KPIs document.
Sections: ## North Star Metric · ## Input Metrics · ## Metrics table | Metric | Definition | Target | Measurement Source | · ## Activation & Retention Definitions · ## Guardrail Metrics · ## Instrumentation Notes. Tie targets back to the brief's success_metrics.`,

  competitive_analysis: `Produce a COMPETITIVE ANALYSIS.
Sections: ## Market Landscape · ## Competitor Comparison table | Competitor | Strengths | Weaknesses | Our Differentiation | · ## Positioning Map (described) · ## Differentiation Strategy · ## Threats & Defensibility. Be honest about alternatives including "do nothing".`,

  roadmap: `Produce a PRODUCT ROADMAP.
Sections: ## MVP Scope (Now) · ## Next (Post-MVP) · ## Later (Vision) · ## Roadmap table | Phase | Theme | Key Deliverables | Success Criteria | · ## Explicitly Out of Scope. Keep MVP scope tight and aligned with core_features.`,

  risk_log: `Produce a RISK LOG.
A thorough ## Risk Register table | ID | Risk | Category (Tech/Product/Market/Ops) | Likelihood (H/M/L) | Impact (H/M/L) | Mitigation | Owner |, followed by ## Top 3 Risks To Watch with short narratives.`,

  system_architecture: `Produce a SYSTEM ARCHITECTURE document.
Sections: ## Architecture Overview · ## Components & Responsibilities · ## Data Flow (describe request lifecycle for a key feature) · ## Architectural Boundaries & Interfaces · ## Key Technical Decisions · ## Scalability & Failure Modes. Include a fenced ASCII component diagram. This must agree with the data model and API contract.`,

  data_model: `Produce a DATA MODEL & ERD document.
Sections: ## Entities & Attributes (one sub-section per entity with a field table | Field | Type | Constraints | Notes |) · ## Relationships (described, with cardinality) · ## ERD (fenced ASCII/mermaid-style diagram) · ## Indexing & Integrity · ## Migration Notes. Entities must cover every feature in core_features and align with the PRD's Data & API Boundaries.`,

  api_contract: `Produce an API CONTRACT.
Sections: ## Conventions (base URL, auth, versioning, error envelope) · ## Endpoints — for each: method + path, purpose, request body (fenced JSON), success response (fenced JSON), and error codes table · ## Status Codes & Error Model · ## Rate Limiting. Endpoints must serve the PRD's functional requirements and operate on the data model's entities.`,

  security_spec: `Produce a SECURITY SPECIFICATION.
Sections: ## Authentication · ## Authorization (roles/permissions) · ## Data Protection (in transit/at rest, PII handling) · ## Threat Model table | Threat | Vector | Likelihood | Mitigation | (cover OWASP-relevant items) · ## Secrets & Key Management · ## Compliance Considerations.`,

  testing_strategy: `Produce a TESTING STRATEGY.
Sections: ## Test Pyramid (unit/integration/e2e split & rationale) · ## Coverage Targets table | Layer | Scope | Target | Tooling | · ## Critical Test Scenarios (tied to user stories) · ## CI Quality Gates · ## Test Data & Environments · ## Non-Functional Testing (perf, security, a11y).`,

  tech_stack: `Produce a TECH STACK DECISION RECORD (ADR-style).
Sections: ## Context · ## Stack Summary table | Layer | Choice | Rationale | Alternatives Considered | (frontend, backend, datastore, infra, auth, AI/ML if relevant) · ## Key Trade-offs · ## Consequences. Respect the brief's key_constraints.`,

  deployment: `Produce a DEPLOYMENT & INFRASTRUCTURE document.
Sections: ## Environments (dev/staging/prod) · ## CI/CD Pipeline (stages) · ## Infrastructure Components · ## Configuration & Secrets · ## Rollback & Disaster Recovery · ## Cost Considerations.`,

  observability: `Produce an OBSERVABILITY & MONITORING PLAN.
Sections: ## Logging Strategy · ## Metrics (the golden signals + product metrics) · ## Tracing · ## Alerting & On-Call (table | Alert | Condition | Severity | Response |) · ## SLOs & Error Budgets · ## Dashboards.`,
};

export function buildDocGeneratorUser(
  docType: DocType,
  brief: BriefAnalysis,
  config: MvpDocsConfig,
  kbContext: string
): string {
  return `PRODUCT NAME: ${config.productName || "Unnamed product"}
DOCUMENT TO PRODUCE: ${DOC_LABELS[docType]}
TARGET AUDIENCE: ${config.targetAudience || "Not specified"}
${config.additionalContext ? `ADDITIONAL CONTEXT: ${config.additionalContext}` : ""}

BRIEF ANALYSIS (SHARED SOURCE OF TRUTH — do not contradict):
${JSON.stringify(brief, null, 2)}

${kbContext ? `KNOWLEDGE BASE CONTEXT:\n${kbContext}\n` : ""}
DOCUMENT-SPECIFIC GUIDANCE:
${DOC_GENERATOR_GUIDANCE[docType]}

Produce the complete, publication-ready ${DOC_LABELS[docType]} now.`;
}

// ── Phase 3: Consistency Checker ────────────────────────────────────────────────

export const CONSISTENCY_CHECKER_SYSTEM = `You are a meticulous documentation reviewer. Given a set of generated MVP documents that were produced in parallel, your job is to surface where they DISAGREE with each other and where coverage is thin.

Focus especially on the places that break teams when undocumented or inconsistent:
- The PRD's Data & API Boundaries vs the Data Model's entities vs the API Contract's endpoints.
- Scope drift: features mentioned in one doc but absent from the roadmap/PRD.
- Conflicting claims about users, constraints, or success metrics.

Be specific — name the documents and the exact conflicting claim. If the bundle is genuinely coherent, say so honestly rather than inventing issues.

Return ONLY valid JSON:
{
  "overall_consistency": "high|medium|low",
  "contradictions": [{ "docs": ["Doc A", "Doc B"], "issue": "the specific conflict", "recommendation": "how to resolve it" }],
  "coverage_gaps": ["something the bundle should cover but doesn't"],
  "strengths": ["what is well-aligned across the bundle"]
}`;

export function buildConsistencyCheckerUser(
  docs: Array<{ label: string; summary: string; excerpt: string }>
): string {
  const body = docs
    .map(
      (d) =>
        `### ${d.label}\nSummary: ${d.summary}\nExcerpt:\n${d.excerpt}`
    )
    .join("\n\n");

  return `Review the following ${docs.length} MVP documents for cross-document consistency and coverage:\n\n${body}\n\nReturn the structured consistency report JSON.`;
}
