"use client";

import { useState } from "react";
import type { ArchitectureBlueprint as BlueprintType } from "@/types/tech-research";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  blueprint: BlueprintType;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5">
        <span className="text-xs font-mono text-slate-400">{language}</span>
        <button
          onClick={copy}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto text-xs leading-relaxed font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

export function ArchitectureBlueprint({ blueprint }: Props) {
  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-4">
        <div className="text-xs font-semibold uppercase text-slate-500 tracking-wide mb-1">
          Integration Overview
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{blueprint.integration_overview}</p>
      </div>

      {/* Folder structure */}
      {blueprint.folder_structure && (
        <Collapsible title="Folder Structure" defaultOpen>
          <CodeBlock language="text" code={blueprint.folder_structure} />
        </Collapsible>
      )}

      {/* Key interfaces */}
      {blueprint.key_interfaces.length > 0 && (
        <Collapsible title={`TypeScript Interfaces (${blueprint.key_interfaces.length})`}>
          <div className="space-y-3">
            {blueprint.key_interfaces.map((iface, i) => (
              <CodeBlock key={i} language="typescript" code={iface} />
            ))}
          </div>
        </Collapsible>
      )}

      {/* Code snippets */}
      {blueprint.code_snippets.length > 0 && (
        <Collapsible title={`Code Examples (${blueprint.code_snippets.length})`} defaultOpen>
          <div className="space-y-4">
            {blueprint.code_snippets.map((snippet, i) => (
              <div key={i}>
                <div className="text-xs font-semibold text-slate-600 mb-1.5">
                  {snippet.description}
                </div>
                <CodeBlock language={snippet.language} code={snippet.code} />
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Configuration notes */}
      {blueprint.configuration_notes.length > 0 && (
        <Collapsible title="Configuration Notes">
          <ul className="space-y-2">
            {blueprint.configuration_notes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        </Collapsible>
      )}

      {/* Implementation Roadmap */}
      {blueprint.phases.length > 0 && (
        <Collapsible title="Implementation Roadmap" defaultOpen>
          <div className="space-y-4">
            {blueprint.phases.map((phase) => (
              <div key={phase.phase} className="border-l-2 border-sky-300 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-sky-600 bg-sky-50 rounded px-2 py-0.5">
                    Phase {phase.phase}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{phase.title}</span>
                  <span className="text-xs text-slate-400">({phase.duration_estimate})</span>
                </div>
                <ul className="space-y-0.5 mb-1.5">
                  {phase.tasks.map((task, ti) => (
                    <li key={ti} className="text-sm text-slate-600 flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-slate-300 shrink-0" />
                      {task}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded px-2 py-1 w-fit">
                  <CheckCircle2 className="h-3 w-3" />
                  {phase.deliverable}
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Risks */}
      {blueprint.risks.length > 0 && (
        <Collapsible title={`Risks & Mitigations (${blueprint.risks.length})`}>
          <div className="space-y-3">
            {blueprint.risks.map((r, i) => (
              <div key={i} className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3">
                <div className="flex items-start gap-2 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-sm font-medium text-amber-800">{r.risk}</span>
                </div>
                <div className="text-sm text-amber-700 pl-5">
                  <span className="font-semibold">Mitigation:</span> {r.mitigation}
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Success Metrics */}
      {blueprint.success_metrics.length > 0 && (
        <Collapsible title="Success Metrics">
          <ul className="space-y-2">
            {blueprint.success_metrics.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                {m}
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
    </div>
  );
}
