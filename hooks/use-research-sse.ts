"use client";

import { useEffect, useRef } from "react";
import { useResearchStore } from "@/store/research-store";
import type { ResearchJob } from "@/types/research";

/**
 * Subscribes to the research job SSE stream at /api/research/status/[jobId].
 * Passes the Supabase session token in the Authorization header via a
 * token-authenticated URL — EventSource doesn't support custom headers,
 * so we pass the token as a query param and the route reads it.
 *
 * Note: EventSource doesn't support custom headers, so we use a token
 * query param approach that the status route accepts.
 */
export function useResearchSSE(jobId: string | null, accessToken: string | null) {
  const { setJob, updateAgent, updateJobStatus, setActiveTab } =
    useResearchStore();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId || !accessToken) return;

    // Pass token as query param since EventSource doesn't support headers
    const url = `/api/research/status/${jobId}?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);
    esRef.current = es;

    // Full job snapshot on connect (or page reconnect)
    es.addEventListener("init", (e) => {
      const data = JSON.parse(e.data) as ResearchJob;
      setJob(data);
      if (data.status === "done") setActiveTab("report");
    });

    // Polling fallback snapshot
    es.addEventListener("poll", (e) => {
      const data = JSON.parse(e.data) as ResearchJob;
      setJob(data);
      if (data.status === "done") {
        setActiveTab("report");
        es.close();
      }
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data) as { status: ResearchJob["status"] };
      updateJobStatus(data.status);
    });

    es.addEventListener("agent_update", (e) => {
      const data = JSON.parse(e.data) as {
        agentId: string;
        status: string;
        note?: string;
      };
      updateAgent(data.agentId, {
        status: data.status as import("@/types/research").AgentStatus,
        note: data.note,
      });
    });

    es.addEventListener("evidence_ready", (e) => {
      const data = JSON.parse(e.data);
      console.log("[SSE] evidence ready:", data);
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data) as { report: ResearchJob["report"] };
      useResearchStore.setState((state) =>
        state.job
          ? { job: { ...state.job, status: "done", report: data.report } }
          : state
      );
      setActiveTab("report");
      es.close();
    });

    es.addEventListener("error", (e) => {
      let message = "Unknown error";
      try {
        const data = JSON.parse((e as MessageEvent).data ?? "{}");
        message = data.message ?? message;
      } catch {
        // Non-JSON error event — connection issue
      }
      updateJobStatus("error", message);
      es.close();
    });

    es.onerror = () => {
      const state = useResearchStore.getState();
      if (state.job?.status === "done" || state.job?.status === "error") {
        es.close();
      }
    };

    return () => es.close();
  }, [jobId, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return esRef;
}
