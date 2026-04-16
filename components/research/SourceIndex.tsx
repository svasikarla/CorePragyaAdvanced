"use client";

import type { SourceItem } from "@/types/research";
import { ExternalLink } from "lucide-react";

interface Props {
  sources: SourceItem[];
}

const TYPE_COLOURS: Record<string, string> = {
  primary: "#16a34a",
  secondary: "#2563eb",
  tertiary: "#94a3b8",
};

export default function SourceIndex({ sources }: Props) {
  if (sources.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--cp-research-text)" }}
      >
        Sources ({sources.length})
      </h3>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--cp-research-border)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--cp-research-border)",
                backgroundColor: "var(--cp-research-panel)",
              }}
            >
              {["#", "Title", "Date", "Type"].map((h) => (
                <th
                  key={h}
                  className="text-left py-2 px-3 font-medium"
                  style={{ color: "var(--cp-research-text-secondary)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((s, i) => (
              <tr
                key={i}
                style={{ borderBottom: "1px solid var(--cp-research-border)" }}
              >
                <td
                  className="py-2 px-3"
                  style={{ color: "var(--cp-research-muted)" }}
                >
                  {i + 1}
                </td>
                <td className="py-2 px-3 max-w-xs">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:underline"
                    style={{ color: "var(--cp-research-accent)" }}
                  >
                    <span className="truncate">{s.title || s.url}</span>
                    <ExternalLink size={10} className="shrink-0" />
                  </a>
                </td>
                <td
                  className="py-2 px-3"
                  style={{ color: "var(--cp-research-muted)" }}
                >
                  {s.date}
                </td>
                <td className="py-2 px-3">
                  <span
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: `${TYPE_COLOURS[s.type] ?? "#94a3b8"}18`,
                      color: TYPE_COLOURS[s.type] ?? "#94a3b8",
                    }}
                  >
                    {s.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
