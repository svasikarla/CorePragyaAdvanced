"use client";

import { useEffect, useRef } from "react";
import { useMvpDocsStore } from "@/store/mvp-docs-store";
import type { MvpDocsJob, MvpDocument, ConsistencyReport } from "@/types/mvp-docs";
import type { AgentStatus } from "@/types/research";

export function useMvpDocsSSE(
  jobId: string | null,
  accessToken: string | null
) {
  const { setJob, updateAgent, updateJobStatus, setActiveTab } = useMvpDocsStore();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId || !accessToken) return;

    const url = `/api/mvp-docs/status/${jobId}?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("init", (e) => {
      const data = JSON.parse(e.data) as MvpDocsJob;
      setJob(data);
      if (data.status === "done") {
        setActiveTab("documents");
        es.close();
      } else if (data.status === "error") {
        es.close();
      }
    });

    es.addEventListener("poll", (e) => {
      const data = JSON.parse(e.data) as MvpDocsJob;
      setJob(data);
      if (data.status === "done") {
        setActiveTab("documents");
        es.close();
      } else if (data.status === "error") {
        es.close();
      }
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data) as { status: MvpDocsJob["status"] };
      updateJobStatus(data.status);
    });

    es.addEventListener("agent_update", (e) => {
      const data = JSON.parse(e.data) as {
        agentId: string;
        status: string;
        note?: string;
      };
      updateAgent(data.agentId, {
        status: data.status as AgentStatus,
        note: data.note,
      });
    });

    es.addEventListener("documents_ready", (e) => {
      const data = JSON.parse(e.data) as { count: number };
      console.log(`[MvpDocsSSE] ${data.count} documents ready`);
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data) as {
        documents: MvpDocument[];
        consistency_report?: ConsistencyReport;
      };
      useMvpDocsStore.setState((state) =>
        state.job
          ? {
              job: {
                ...state.job,
                status: "done",
                documents: data.documents,
                consistency_report: data.consistency_report,
              },
            }
          : state
      );
      setActiveTab("documents");
      es.close();
    });

    es.addEventListener("error", (e) => {
      const rawData = (e as MessageEvent).data;

      if (rawData) {
        let message = "MVP documentation job failed.";
        try {
          const parsed = JSON.parse(rawData);
          message = parsed.message || message;
        } catch {
          message = String(rawData) || message;
        }
        updateJobStatus("error", message);
        es.close();
        return;
      }

      const currentJob = useMvpDocsStore.getState().job;
      if (currentJob?.status === "done" || currentJob?.status === "error") {
        es.close();
        return;
      }

      updateJobStatus(
        "error",
        "Connection to the MVP docs service was lost. Check that ANTHROPIC_API_KEY is set, then retry."
      );
      es.close();
    });

    es.onerror = () => {
      const state = useMvpDocsStore.getState();
      if (state.job?.status !== "running" && state.job?.status !== "queued") {
        es.close();
      }
    };

    return () => es.close();
  }, [jobId, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return esRef;
}
