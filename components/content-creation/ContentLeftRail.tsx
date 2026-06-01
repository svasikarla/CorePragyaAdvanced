"use client";

import type { ContentCreationJob, ContentCreationConfig } from "@/types/content-creation";
import { PLATFORM_LABELS } from "@/types/content-creation";
import { useContentCreationStore } from "@/store/content-creation-store";
import { JourneyRail, OutlineList, computeAgentSteps } from "@/components/agents-ui/sidebar-primitives";
import type { JourneyStep } from "@/components/agents-ui/sidebar-primitives";
import { Settings2, Cpu, FileText, FileEdit, ListChecks } from "lucide-react";

type Tab = "config" | "agents" | "content";

interface Props {
  activeTab: Tab;
  job: ContentCreationJob | null;
  config: ContentCreationConfig;
}

export function ContentLeftRail({ activeTab, job, config }: Props) {
  const { activePlatform, setActivePlatform } = useContentCreationStore();
  const pieces = job?.content_pieces ?? [];
  const outputReady = job?.status === "done" && pieces.length > 0;

  const s = computeAgentSteps({
    activeTab,
    outputTab: "content",
    hasJob: !!job,
    status: job?.status,
    outputReady,
  });

  const steps: JourneyStep[] = [
    {
      key: "config",
      label: "Configure",
      sub: `${config.targetPlatforms.length} platform${config.targetPlatforms.length !== 1 ? "s" : ""}`,
      state: s.config,
      Icon: Settings2,
    },
    {
      key: "agents",
      label: "Generate",
      sub:
        job?.status === "running"
          ? "In progress…"
          : job?.status === "done"
          ? "Complete"
          : job?.status === "error"
          ? "Failed"
          : "Pending",
      state: s.agents,
      Icon: Cpu,
      spinning: job?.status === "running",
    },
    {
      key: "content",
      label: "Content",
      sub: pieces.length ? `${pieces.length} ready` : "Pending",
      state: s.output,
      Icon: FileEdit,
    },
  ];

  const showOutline = activeTab === "content" && pieces.length > 0;
  const platforms = showOutline ? pieces.map((p) => p.platform) : config.targetPlatforms;
  const items = platforms.map((p) => ({ key: p, label: PLATFORM_LABELS[p], dotClass: "bg-violet-400" }));

  return (
    <div className="space-y-6">
      <JourneyRail steps={steps} />
      <OutlineList
        title={showOutline ? "Pieces" : "Platforms"}
        icon={showOutline ? <FileText className="h-3 w-3" /> : <ListChecks className="h-3 w-3" />}
        items={items}
        activeKey={showOutline ? activePlatform : undefined}
        onSelect={showOutline ? (k) => setActivePlatform(k as typeof platforms[number]) : undefined}
      />
    </div>
  );
}
