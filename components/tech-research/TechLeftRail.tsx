"use client";

import type { TechResearchJob, TechResearchConfig } from "@/types/tech-research";
import { JourneyRail, OutlineList, computeAgentSteps } from "@/components/agents-ui/sidebar-primitives";
import type { JourneyStep, OutlineItem } from "@/components/agents-ui/sidebar-primitives";
import { Settings2, Cpu, FileText, ListChecks } from "lucide-react";

type Tab = "config" | "agents" | "report";

interface Props {
  activeTab: Tab;
  job: TechResearchJob | null;
  config: TechResearchConfig;
}

const FOCUS_LABEL: Record<string, string> = {
  frontend: "Frontend", backend: "Backend", database: "Database", infrastructure: "Infrastructure",
  security: "Security", mobile: "Mobile", ai_ml: "AI/ML", general: "General",
};

export function TechLeftRail({ activeTab, job, config }: Props) {
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
    { key: "config", label: "Configure", sub: `${FOCUS_LABEL[config.focus_area] ?? config.focus_area} focus`, state: s.config, Icon: Settings2 },
    {
      key: "agents",
      label: "Research",
      sub: job?.status === "running" ? "In progress…" : job?.status === "done" ? "Complete" : job?.status === "error" ? "Failed" : "Pending",
      state: s.agents,
      Icon: Cpu,
      spinning: job?.status === "running",
    },
    { key: "report", label: "Report", sub: report ? "Ready" : "Pending", state: s.output, Icon: FileText },
  ];

  const showToc = activeTab === "report" && !!report;
  let items: OutlineItem[];
  if (showToc) {
    items = [
      { key: "tsec-verdict", label: "Recommendation", dotClass: "bg-sky-500" },
      { key: "tsec-summary", label: "Executive Summary", dotClass: "bg-indigo-400" },
      { key: "tsec-requirements", label: "Requirement Analysis", dotClass: "bg-indigo-400" },
      { key: "tsec-tradeoff", label: "Trade-off Matrix", dotClass: "bg-indigo-400" },
      { key: "tsec-architecture", label: "Architecture Blueprint", dotClass: "bg-indigo-400" },
      ...(report!.compatibility_warnings.length ? [{ key: "tsec-warnings", label: "Compatibility Warnings", dotClass: "bg-amber-400" }] : []),
      ...(report!.source_index.length ? [{ key: "tsec-sources", label: "Source Index", dotClass: "bg-slate-400" }] : []),
    ];
  } else {
    items = ["Recommendation", "Requirement Analysis", "Trade-off Matrix", "Architecture Blueprint", "Sources"].map(
      (label, i) => ({ key: `prev-${i}`, label, dotClass: "bg-slate-300" })
    );
  }

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
