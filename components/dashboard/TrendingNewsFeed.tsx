"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Flame,
  RefreshCw,
  Loader2,
  ExternalLink,
  X,
  ChevronDown,
  Sparkles,
  Clock,
  Rss,
} from "lucide-react";
import Link from "next/link";

interface TrendingArticle {
  id: string;
  title: string;
  summary_text: string;
  source_ref: string;
  source_name: string | null;
  category: string;
  relevance_score: number | null;
  relevance_snippet: string | null;
  published_at: string | null;
  created_at: string;
  composite_score: number;
  is_new: boolean;
}

interface TrendingNewsFeedProps {
  accessToken: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getFaviconUrl(sourceRef: string): string {
  try {
    const hostname = new URL(sourceRef).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
  } catch {
    return "";
  }
}

export default function TrendingNewsFeed({ accessToken }: TrendingNewsFeedProps) {
  const [articles, setArticles] = useState<TrendingArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  const fetchArticles = useCallback(
    async (pageNum: number, category: string | null, append: boolean) => {
      try {
        const params = new URLSearchParams({ page: String(pageNum), limit: "5" });
        if (category) params.set("category", category);

        const res = await fetch(`/api/trending-feed?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) return;
        const data = await res.json();

        if (append) {
          setArticles((prev) => [...prev, ...(data.articles || [])]);
        } else {
          setArticles(data.articles || []);
        }
        setHasMore(data.has_more || false);
        setTotal(data.total || 0);
        if (data.categories) setCategories(data.categories);
      } catch (err) {
        console.error("Error fetching trending feed:", err);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    setLoading(true);
    fetchArticles(1, selectedCategory, false).finally(() => setLoading(false));
  }, [fetchArticles, selectedCategory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Trigger RSS ingestion first, then refresh the feed
    try {
      await fetch("/api/ingest-rss", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Ingestion failure is non-blocking
    }
    setPage(1);
    await fetchArticles(1, selectedCategory, false);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    await fetchArticles(nextPage, selectedCategory, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleCategoryFilter = (cat: string | null) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handleDismiss = async (articleId: string) => {
    // Optimistic removal
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
    try {
      await fetch("/api/trending-feed/dismiss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ articleId }),
      });
    } catch (err) {
      console.error("Dismiss failed:", err);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <Card className="border-orange-100/60 shadow-lg shadow-orange-900/5">
        <CardHeader className="pb-4 border-b border-orange-50">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-60" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasArticles = articles.length > 0;

  return (
    <Card className="overflow-hidden border-orange-100/60 shadow-lg shadow-orange-900/5 hover:shadow-xl transition-all duration-500 group">
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-orange-50/80 to-transparent pb-4 border-b border-orange-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white shadow-sm ring-1 ring-orange-100 rounded-xl group-hover:bg-orange-500 group-hover:ring-orange-500 transition-colors duration-300">
              <Flame className="h-5 w-5 text-orange-500 group-hover:text-white transition-colors duration-300" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-slate-800">
                Trending Now
              </CardTitle>
              <CardDescription className="text-sm font-medium">
                AI-curated news feed ranked by your interests.
                {total > 0 && (
                  <span className="ml-1 text-orange-600 font-semibold">{total} articles</span>
                )}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs gap-1.5 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 rounded-full"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {refreshing ? "Refreshing..." : "Refresh Feed"}
            </Button>
          </div>
        </div>

        {/* FR-21: Category filter tabs */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-orange-50/60">
            <button
              onClick={() => handleCategoryFilter(null)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                !selectedCategory
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-700 border border-slate-200"
              }`}
            >
              All
            </button>
            {categories.slice(0, 8).map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryFilter(cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                  selectedCategory === cat
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-700 border border-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      {/* Article List */}
      <CardContent className="p-4 sm:p-6">
        {hasArticles ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {articles.map((article, i) => (
              <div
                key={article.id}
                className="group/card relative border border-slate-100 rounded-xl p-4 hover:shadow-md hover:border-orange-200 transition-all duration-300 bg-white animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Top row: badges + score */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* FR-20: Newest badge */}
                    {article.is_new && (
                      <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px] px-2 py-0 font-bold uppercase tracking-wider">
                        New
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600"
                    >
                      {article.category}
                    </Badge>
                  </div>
                  {article.relevance_score != null && (
                    <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1 rounded-full bg-orange-50 text-[10px] font-bold text-orange-600 ring-1 ring-orange-100">
                      {Math.round(article.relevance_score * 10) / 10}
                    </span>
                  )}
                </div>

                {/* FR-17: Headline (clickable) */}
                <a
                  href={article.source_ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group/link"
                >
                  <h3 className="text-sm font-semibold text-slate-800 leading-snug mb-1.5 line-clamp-2 group-hover/link:text-orange-700 transition-colors">
                    {article.title}
                    <ExternalLink className="inline-block ml-1.5 h-3 w-3 text-slate-300 group-hover/link:text-orange-400 transition-colors" />
                  </h3>
                </a>

                {/* Article summary */}
                {article.summary_text && article.summary_text !== article.title && (
                  <p className="text-xs text-slate-600 leading-snug line-clamp-2 mb-1.5">
                    {article.summary_text}
                  </p>
                )}

                {/* FR-17: Source name + favicon + time ago */}
                <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
                  {article.source_ref && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getFaviconUrl(article.source_ref)}
                      alt=""
                      className="w-4 h-4 rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <span className="font-medium">
                    {article.source_name || new URL(article.source_ref).hostname}
                  </span>
                  <span className="text-slate-300">|</span>
                  <Clock className="h-3 w-3 text-slate-400" />
                  <span>{timeAgo(article.published_at || article.created_at)}</span>
                </div>

                {/* FR-06: AI relevance snippet */}
                {article.relevance_snippet && (
                  <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-gradient-to-r from-indigo-50/60 to-purple-50/40">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-indigo-700 leading-relaxed">
                      {article.relevance_snippet}
                    </p>
                  </div>
                )}

                {/* FR-22: Dismiss button */}
                <button
                  onClick={() => handleDismiss(article.id)}
                  className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500"
                  title="Not interested"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* FR-18: Load More */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-xs gap-2 rounded-full hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
                >
                  {loadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {loadingMore ? "Loading..." : "Load More Articles"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-orange-50 flex items-center justify-center mb-4 ring-1 ring-orange-100">
              <Rss className="h-7 w-7 text-orange-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">No trending articles yet</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              Subscribe to RSS feeds and run ingestion to populate your personalized news feed.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full text-orange-700 border-orange-200 hover:bg-orange-50"
              asChild
            >
              <Link href="/knowledge-base/subscriptions">
                <Rss className="mr-2 h-3.5 w-3.5" />
                Manage Feeds
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
