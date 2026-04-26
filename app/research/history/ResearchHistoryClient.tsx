"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  History,
  Search,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import JobCard from "@/components/research/JobCard";
import type { JobSummary, ResearchJob } from "@/types/research";

interface Props {
  initialJobs: JobSummary[];
  initialTotal: number;
  accessToken: string | null;
}

const STATUS_FILTERS: Array<{ value: ResearchJob["status"] | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "done", label: "Done" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "error", label: "Error" },
];

const PAGE_SIZE = 20;

const RESEARCH_THEME: React.CSSProperties = {
  ["--cp-research-bg" as string]: "#f8fafc",
  ["--cp-research-surface" as string]: "#ffffff",
  ["--cp-research-panel" as string]: "#f1f5f9",
  ["--cp-research-border" as string]: "#e2e8f0",
  ["--cp-research-text" as string]: "#1e293b",
  ["--cp-research-text-secondary" as string]: "#475569",
  ["--cp-research-muted" as string]: "#94a3b8",
  ["--cp-research-accent" as string]: "#4f46e5",
};

export default function ResearchHistoryClient({
  initialJobs,
  initialTotal,
  accessToken,
}: Props) {
  const [jobs, setJobs] = useState<JobSummary[]>(initialJobs);
  const [total, setTotal] = useState(initialTotal);
  const [statusFilter, setStatusFilter] = useState<ResearchJob["status"] | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) return;

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      const res = await fetch(`/api/research/jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      setJobs(data.jobs ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, offset, accessToken]);

  // Skip first render (already have server-fetched data), refetch on filter changes
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Only skip when filters are at defaults
      if (statusFilter === "all" && !debouncedSearch && offset === 0) return;
    }
    fetchJobs();
  }, [fetchJobs, statusFilter, debouncedSearch, offset]);

  function handleDeleted(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setTotal((prev) => Math.max(prev - 1, 0));
  }

  function handleStatusFilter(val: ResearchJob["status"] | "all") {
    setStatusFilter(val);
    setOffset(0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div style={RESEARCH_THEME} className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50">
              <History className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">
                Research History
              </h1>
              <p className="text-xs text-slate-500">
                All your past research jobs · download or re-view any report
              </p>
            </div>
          </div>

          <Link
            href="/research"
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <FlaskConical size={13} />
            New Research
          </Link>
        </div>
      </div>

      {/* Filters bar */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          {/* Status filter pills */}
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => handleStatusFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-72">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by topic…"
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Total count */}
          <span className="text-xs text-slate-400 ml-auto">
            {loading ? (
              <Loader2 size={12} className="animate-spin inline" />
            ) : (
              `${total} job${total !== 1 ? "s" : ""}`
            )}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {loading && jobs.length === 0 ? (
          <div className="flex justify-center py-24">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState hasFilters={statusFilter !== "all" || !!debouncedSearch} />
        ) : (
          <>
            <div className={`space-y-3 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onDeleted={handleDeleted} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
                  disabled={offset === 0 || loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>

                <span className="text-xs text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total || loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 rounded-full bg-slate-100 mb-4">
        <History size={28} className="text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">
        {hasFilters ? "No matching research jobs" : "No research history yet"}
      </h3>
      <p className="text-xs text-slate-400 mb-6 max-w-xs">
        {hasFilters
          ? "Try adjusting your filters or search query."
          : "Run your first research job and the results will appear here."}
      </p>
      <Link
        href="/research"
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        <FlaskConical size={14} />
        Start a Research Job
      </Link>
    </div>
  );
}
