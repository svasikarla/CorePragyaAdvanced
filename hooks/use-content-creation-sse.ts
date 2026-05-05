"use client";

import { useEffect, useRef } from "react";
import { useContentCreationStore } from "@/store/content-creation-store";
import type { ContentCreationJob, ContentPiece } from "@/types/content-creation";
import type { AgentStatus } from "@/types/research";

export function useContentCreationSSE(
  jobId: string | null,
  accessToken: string | null
) {
  const { setJob, updateAgent, updateJobStatus, setActiveTab } =
    useContentCreationStore();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId || !accessToken) return;

    const url = `/api/content-creation/status/${jobId}?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("init", (e) => {
      const data = JSON.parse(e.data) as ContentCreationJob;
      setJob(data);
      if (data.status === "done") {
        setActiveTab("content");
        es.close();
      } else if (data.status === "error") {
        es.close();
      }
    });

    es.addEventListener("poll", (e) => {
      const data = JSON.parse(e.data) as ContentCreationJob;
      setJob(data);
      if (data.status === "done") {
        setActiveTab("content");
        es.close();
      } else if (data.status === "error") {
        es.close();
      }
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data) as { status: ContentCreationJob["status"] };
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

    es.addEventListener("content_ready", (e) => {
      const data = JSON.parse(e.data) as { count: number };
      console.log(`[ContentSSE] ${data.count} content pieces ready`);
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data) as { content_pieces: ContentPiece[] };
      useContentCreationStore.setState((state) =>
        state.job
          ? { job: { ...state.job, status: "done", content_pieces: data.content_pieces } }
          : state
      );
      setActiveTab("content");
      es.close();
    });

    es.addEventListener("error", (e) => {
      const rawData = (e as MessageEvent).data;

      if (rawData) {
        let message = "Content creation job failed.";
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

      const currentJob = useContentCreationStore.getState().job;
      if (currentJob?.status === "done" || currentJob?.status === "error") {
        es.close();
        return;
      }

      updateJobStatus(
        "error",
        "Connection to the content creation service was lost. Check that ANTHROPIC_API_KEY is set, then retry."
      );
      es.close();
    });

    es.onerror = () => {
      const state = useContentCreationStore.getState();
      if (state.job?.status !== "running" && state.job?.status !== "queued") {
        es.close();
      }
    };

    return () => es.close();
  }, [jobId, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return esRef;
}
