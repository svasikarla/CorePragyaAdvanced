"use client";

import type { ResearchJob, ResearchConfig } from "@/types/research";
import { JourneyRail, OutlineList, computeAgentSteps } from "@/components/agents-ui/sidebar-primitives";
import type { JourneyStep } from "@/components/agents-ui/sidebar-primitives";
import { Settings2, FlaskConical, FileText, ListChecks } from "lucide-react";

type Tab = "config" | "agents" | "report";

interface Props {
  activeTab: Tab;
  job: ResearchJob | null;
  config: ResearchConfig;
}

const DEPTH_LABEL: Record<string, string> = { tier1: "Quick", tier2: "Standard", tier3: "Deep" };

// Static preview of the report structure (shown before the report exists).
const DELIVERABLE_PREVIEW = [
  "Executive Summary",
  "Key Findings",
  "Cross-Cutting Insights",
  "Recommended Actions",
  "Sources",
];

export function ResearchLeftRail({ activeTab, job, config }: Props) {
  const report = job?.report;
  const outputReady = !!report;

  const s = computeAgentSteps({
    activeTab,
    outputTab: "report",
    hasJob: !!job,
    status: job?.status,
    outputReady,
  });

  const steps: JourneyStep[] = [
    { key: "config", label: "Configure", sub: `${DEPTH_LABEL[config.depth] ?? config.depth} depth`, state: s.config, Icon: Settings2 },
    {
      key: "agents",
      label: "Research",
      sub: job?.status === "running" ? "In progress…" : job?.status === "done" ? "Complete" : job?.status === "error" ? "Failed" : "Pending",
      state: s.agents,
      Icon: FlaskConical,
      spinning: job?.status === "running",
    },
    { key: "report", label: "Report", sub: report ? `${report.sections.length} sections` : "Pending", state: s.output, Icon: FileText },
  ];

  const showToc = activeTab === "report" && !!report;
  const items = showToc
    ? [
        { key: "rsec-exec", label: "Executive Summary", dotClass: "bg-indigo-500" },
        ...report!.sections.map((sec, i) => ({ key: `rsec-${i}`, label: sec.title, dotClass: "bg-indigo-400" })),
      ]
    : DELIVERABLE_PREVIEW.map((label, i) => ({ key: `prev-${i}`, label, dotClass: "bg-slate-300" }));

  function scrollTo(key: string) {
    document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      <JourneyRail steps={steps} />
      <OutlineList
        title={showToc ? "Contents" : "Deliverable"}
        icon={showToc ? <FileText className="h-3 w-3" /> : <ListChecks className="h-3 w-3" />}
        items={items}
        onSelect={showToc ? scrollTo : undefined}
      />
    </div>
  );
}
