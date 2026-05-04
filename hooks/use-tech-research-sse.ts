"use client";

import { useEffect, useRef } from "react";
import { useTechResearchStore } from "@/store/tech-research-store";
import type { TechResearchJob } from "@/types/tech-research";
import type { AgentStatus } from "@/types/research";

export function useTechResearchSSE(
  jobId: string | null,
  accessToken: string | null
) {
  const { setJob, updateAgent, updateJobStatus, setActiveTab } =
    useTechResearchStore();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId || !accessToken) return;

    const url = `/api/tech-research/status/${jobId}?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("init", (e) => {
      const data = JSON.parse(e.data) as TechResearchJob;
      setJob(data);
      if (data.status === "done") {
        setActiveTab("report");
        es.close(); // Stream is already closed server-side; stop reconnect loop
      } else if (data.status === "error") {
        es.close(); // Same — server already closed the stream
      }
    });

    es.addEventListener("poll", (e) => {
      const data = JSON.parse(e.data) as TechResearchJob;
      setJob(data);
      if (data.status === "done") {
        setActiveTab("report");
        es.close();
      } else if (data.status === "error") {
        es.close(); // Job failed — stop polling
      }
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data) as { status: TechResearchJob["status"] };
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

    es.addEventListener("evaluations_ready", (e) => {
      const data = JSON.parse(e.data) as { count: number };
      console.log(`[TechSSE] ${data.count} evaluations ready`);
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data) as { report: TechResearchJob["report"] };
      useTechResearchStore.setState((state) =>
        state.job
          ? { job: { ...state.job, status: "done", report: data.report } }
          : state
      );
      setActiveTab("report");
      es.close();
    });

    es.addEventListener("error", (e) => {
      const rawData = (e as MessageEvent).data;

      if (rawData) {
        // Server explicitly sent event:error with a message payload
        let message = "Research job failed.";
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

      // e.data is null — this is a connection-level event (stream closed, network drop, etc.)
      // Check the store: if the job already reached a terminal state the closure was expected.
      const currentJob = useTechResearchStore.getState().job;
      if (currentJob?.status === "done" || currentJob?.status === "error") {
        // Normal EOF after the job completed — not a failure; just clean up.
        es.close();
        return;
      }

      // The connection dropped while the job was still in progress.
      // Determine whether the server returned an HTTP error (4xx/5xx) or the network failed.
      // We do NOT fetch the SSE endpoint here — it returns text/event-stream, not JSON.
      // Instead surface a clear message and let the poll-timer fallback handle the retry.
      updateJobStatus(
        "error",
        "Connection to the research service was lost. " +
        "Check that ANTHROPIC_API_KEY / TAVILY_API_KEY are set, then retry."
      );
      es.close();
    });

    // onerror fires at the same time as addEventListener("error") for the same event —
    // only use it as a safety net to close a stale stream.
    es.onerror = () => {
      const state = useTechResearchStore.getState();
      if (state.job?.status !== "running" && state.job?.status !== "queued") {
        es.close();
      }
    };

    return () => es.close();
  }, [jobId, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return esRef;
}
