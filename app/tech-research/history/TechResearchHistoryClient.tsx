"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TechJobCard } from "@/components/tech-research/TechJobCard";
import type { TechJobSummary } from "@/types/tech-research";
import { Search, PlusCircle, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  accessToken: string | null;
}

const PAGE_SIZE = 20;

export default function TechResearchHistoryClient({ accessToken }: Props) {
  const [jobs, setJobs] = useState<TechJobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/tech-research/jobs?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [accessToken, status, search, page]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  function handleDelete(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setTotal((t) => t - 1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Technical Research History</h1>
            <p className="text-sm text-slate-500 mt-0.5">{total} research jobs</p>
          </div>
          <Link
            href="/tech-research"
            className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            New Research
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search requirements…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex gap-1">
            {["all", "done", "running", "queued", "error"].map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(0); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  status === s
                    ? "bg-sky-500 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Job list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
            <p className="text-slate-500 text-sm">No research jobs found.</p>
            <Link
              href="/tech-research"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-sky-500 hover:text-sky-600"
            >
              <PlusCircle className="h-4 w-4" />
              Start your first technical research
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <TechJobCard
                key={job.id}
                job={job}
                accessToken={accessToken}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:border-slate-300 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:border-slate-300 transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
