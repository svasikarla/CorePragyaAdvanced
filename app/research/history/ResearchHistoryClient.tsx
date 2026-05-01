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
  Brain,
  LayoutList,
  Tag,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import JobCard from "@/components/research/JobCard";
import type { JobSummary, ResearchJob, AudienceType } from "@/types/research";

interface Props {
  initialJobs: JobSummary[];
  initialTotal: number;
  accessToken: string | null;
}

type GroupBy = "none" | "role" | "date";

const STATUS_FILTERS: Array<{ value: ResearchJob["status"] | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "done", label: "Done" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "error", label: "Error" },
];

const GROUP_OPTIONS: Array<{ value: GroupBy; label: string; icon: React.ReactNode }> = [
  { value: "none", label: "None", icon: <LayoutList size={12} /> },
  { value: "role", label: "Role", icon: <Tag size={12} /> },
  { value: "date", label: "Date", icon: <CalendarDays size={12} /> },
];

const AUDIENCE_LABELS: Record<AudienceType, string> = {
  executive: "Executive",
  technical: "Technical",
  analyst: "Analyst",
  client: "Client",
  board: "Board",
};

const AUDIENCE_COLORS: Record<AudienceType, string> = {
  executive: "bg-purple-100 text-purple-700 border-purple-200",
  technical: "bg-blue-100 text-blue-700 border-blue-200",
  analyst: "bg-amber-100 text-amber-700 border-amber-200",
  client: "bg-green-100 text-green-700 border-green-200",
  board: "bg-rose-100 text-rose-700 border-rose-200",
};

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

interface JobGroup {
  label: string;
  colorCls?: string;
  jobs: JobSummary[];
}

function buildGroups(jobs: JobSummary[], by: GroupBy): JobGroup[] {
  if (by === "none") return [{ label: "", jobs }];

  if (by === "role") {
    const map = new Map<string, JobSummary[]>();
    for (const job of jobs) {
      const key = job.config.audience;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, groupJobs]) => ({
        label: AUDIENCE_LABELS[key as AudienceType] ?? key,
        colorCls: AUDIENCE_COLORS[key as AudienceType],
        jobs: groupJobs,
      }));
  }

  if (by === "date") {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const weekAgo = new Date(now - 7 * 86_400_000);
    const monthAgo = new Date(now - 30 * 86_400_000);

    const buckets: Record<string, JobSummary[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      "This Month": [],
      Older: [],
    };

    for (const job of jobs) {
      const d = new Date(job.created_at);
      if (d >= startOfToday) buckets["Today"].push(job);
      else if (d >= startOfYesterday) buckets["Yesterday"].push(job);
      else if (d >= weekAgo) buckets["This Week"].push(job);
      else if (d >= monthAgo) buckets["This Month"].push(job);
      else buckets["Older"].push(job);
    }

    return Object.entries(buckets)
      .filter(([, gs]) => gs.length > 0)
      .map(([label, groupJobs]) => ({ label, jobs: groupJobs }));
  }

  return [{ label: "", jobs }];
}

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
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (statusFilter === "all" && !debouncedSearch && offset === 0) return;
    }
    fetchJobs();
  }, [fetchJobs, statusFilter, debouncedSearch, offset]);

  // Auto-refresh every 8s when any job is running or queued
  const hasActiveJobs = jobs.some((j) => j.status === "running" || j.status === "queued");
  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = setInterval(fetchJobs, 8_000);
    return () => clearInterval(interval);
  }, [hasActiveJobs, fetchJobs]);

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
  const groups = buildGroups(jobs, groupBy);

  return (
    <div style={RESEARCH_THEME} className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
            >
              <Brain size={14} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <ChevronRight size={13} className="text-slate-300 shrink-0" />
            <Link
              href="/research"
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors hidden sm:inline"
            >
              Research
            </Link>
            <ChevronRight size={13} className="text-slate-300 shrink-0 hidden sm:inline" />
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

          {/* Group by */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-slate-400 shrink-0">Group by:</span>
            <div className="flex gap-1">
              {GROUP_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGroupBy(g.value)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    groupBy === g.value
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {g.icon}
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Total count */}
          <span className="text-xs text-slate-400">
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
          <div className={`transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}>
            {groupBy === "none" ? (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} onDeleted={handleDeleted} />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {groups.map((group) => (
                  <section key={group.label}>
                    {/* Group header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                          group.colorCls ?? "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {group.label}
                      </span>
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400 shrink-0">
                        {group.jobs.length} job{group.jobs.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Jobs in group */}
                    <div className="space-y-3">
                      {group.jobs.map((job) => (
                        <JobCard key={job.id} job={job} onDeleted={handleDeleted} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Pagination (hidden when grouping is active — all results loaded) */}
            {groupBy === "none" && totalPages > 1 && (
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

            {/* Group hint when paginated */}
            {groupBy !== "none" && totalPages > 1 && (
              <p className="mt-6 text-center text-xs text-slate-400">
                Showing page {currentPage} of {totalPages} · Grouping applies to current page
              </p>
            )}
          </div>
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
