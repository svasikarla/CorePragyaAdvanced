"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useResearchStore } from "@/store/research-store";
import { supabase } from "@/lib/supabase/client";

const FORMAT_LABELS = { md: "Markdown", html: "HTML", docx: "Word Doc" };

export default function DownloadButton() {
  const { job, jobId } = useResearchStore();
  const [downloading, setDownloading] = useState(false);

  if (!job?.report || !jobId) return null;

  async function handleDownload() {
    setDownloading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(`/api/research/report/${jobId}/download`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "research-report";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-opacity disabled:opacity-50"
      style={{
        backgroundColor: "var(--cp-research-accent)",
        color: "#ffffff",
      }}
    >
      {downloading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} />
      )}
      Download {job?.config?.format ? FORMAT_LABELS[job.config.format] : ""}
    </button>
  );
}
