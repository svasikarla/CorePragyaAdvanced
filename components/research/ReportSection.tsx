"use client";

import type { ReportSection as Section } from "@/types/research";

interface Props {
  section: Section;
}

export default function ReportSection({ section }: Props) {
  return (
    <div
      className="rounded-lg p-5 space-y-3"
      style={{
        backgroundColor: "var(--cp-research-surface)",
        border: "1px solid var(--cp-research-border)",
      }}
    >
      {/* Section title */}
      <h3
        className="text-base font-semibold"
        style={{ color: "var(--cp-research-accent)" }}
      >
        {section.title}
      </h3>

      {/* Assertion */}
      <p
        className="text-sm italic"
        style={{ color: "var(--cp-research-text-secondary)" }}
      >
        {section.assertion}
      </p>

      {/* Findings */}
      {section.findings.length > 0 && (
        <ul className="space-y-1.5">
          {section.findings.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "var(--cp-research-accent)" }}
              />
              <span style={{ color: "var(--cp-research-text)" }}>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Key data point */}
      {section.data_point && (
        <div
          className="px-4 py-2.5 rounded text-sm"
          style={{
            backgroundColor: "var(--cp-research-panel)",
            borderLeft: "3px solid var(--cp-research-accent)",
          }}
        >
          <span
            className="font-semibold"
            style={{ color: "var(--cp-research-accent)" }}
          >
            Key data point:{" "}
          </span>
          <span style={{ color: "var(--cp-research-text)" }}>
            {section.data_point}
          </span>
        </div>
      )}

      {/* Implication */}
      {section.implication && (
        <p
          className="text-sm"
          style={{ color: "var(--cp-research-text-secondary)" }}
        >
          <span
            className="font-medium"
            style={{ color: "var(--cp-research-text)" }}
          >
            Implication:{" "}
          </span>
          {section.implication}
        </p>
      )}
    </div>
  );
}
