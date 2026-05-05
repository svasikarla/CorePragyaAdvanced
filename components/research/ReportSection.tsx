"use client";

import { MessageSquarePlus } from "lucide-react";
import type { ReportSection as Section } from "@/types/research";

interface Props {
  section: Section;
  onRefine?: (prompt: string) => void;
}

export default function ReportSection({ section, onRefine }: Props) {
  function handleRefine() {
    if (!onRefine) return;
    const prompt =
      `Let's explore the section "${section.title}" in more depth.\n\n` +
      `Core assertion: ${section.assertion}\n\n` +
      `Can you elaborate on this, provide additional context, or suggest what further research would be most valuable here?`;
    onRefine(prompt);
  }

  return (
    <div
      className="group rounded-lg p-5 space-y-3 relative"
      style={{
        backgroundColor: "var(--cp-research-surface)",
        border: "1px solid var(--cp-research-border)",
      }}
    >
      {/* Section title row */}
      <div className="flex items-start justify-between gap-3">
        <h3
          className="text-base font-semibold flex-1"
          style={{ color: "var(--cp-research-accent)" }}
        >
          {section.title}
        </h3>

        {onRefine && (
          <button
            onClick={handleRefine}
            title="Explore this section in the chat"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            style={{
              color: "var(--cp-research-accent)",
              border: "1px solid var(--cp-research-border)",
              backgroundColor: "var(--cp-research-panel)",
            }}
          >
            <MessageSquarePlus size={12} />
            Explore
          </button>
        )}
      </div>

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
