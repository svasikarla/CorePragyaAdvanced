"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Flame, BookOpen, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export interface TrendingTopic {
  name: string;
  description: string;
  relevance: number;
}

interface TrendingTopicsProps {
  userId: string;
  trendingTopics: TrendingTopic[];
  insightsLoading: boolean;
}

export default function TrendingTopics({ userId, trendingTopics, insightsLoading }: TrendingTopicsProps) {
  const [kbInterests, setKbInterests] = useState<{ name: string; count: number }[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(true);

  useEffect(() => {
    async function loadInterests() {
      const { data: kbData } = await supabase
        .from('knowledgebase')
        .select('category')
        .eq('user_id', userId)
        .neq('source_type', 'rss');

      const interestCounts: Record<string, number> = {};
      if (kbData) {
        kbData.forEach(item => {
          const cat = item.category || 'Uncategorized';
          interestCounts[cat] = (interestCounts[cat] || 0) + 1;
        });
      }
      const sorted = Object.entries(interestCounts).sort((a, b) => b[1] - a[1]);
      setKbInterests(sorted.map(e => ({ name: e[0], count: e[1] })).slice(0, 10));
      setInterestsLoading(false);
    }

    loadInterests();
  }, [userId]);

  if (insightsLoading && interestsLoading) return (
    <div className="space-y-4 py-2">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
    </div>
  );

  const hasTrending = trendingTopics.length > 0;

  return (
    <div className="space-y-6 pt-1">
      {/* SECTION 1: AI-Derived Trending Topics (FR-04: macro themes from KB analysis) */}
      {hasTrending ? (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1 flex items-center gap-1.5 animate-in fade-in">
            <Flame className="h-3.5 w-3.5 text-orange-500 animate-pulse" /> Detected themes
          </p>

          <div className="flex flex-col gap-2.5">
            {trendingTopics.slice(0, 5).map((topic, i) => (
              <div
                key={`topic-${i}`}
                className="group animate-in fade-in slide-in-from-right-4 fill-mode-both"
                style={{ animationDelay: `${100 + i * 80}ms` }}
              >
                <Card className="border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 relative overflow-hidden bg-white hover:bg-slate-50">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <CardContent className="p-3 pl-4 flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 bg-orange-50 rounded-md text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300 flex-shrink-0">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-800 leading-tight mb-1 group-hover:text-indigo-700 transition-colors">
                        {topic.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                        {topic.description}
                      </p>
                    </div>

                    <div className="flex-shrink-0 self-start">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-50 text-[10px] font-bold text-orange-600">
                        {topic.relevance}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ) : insightsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : (
        <div className="text-center py-6 animate-in fade-in duration-700 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3 shadow-inner">
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">No themes yet</h3>
          <p className="mt-1 text-xs text-slate-500 px-4 leading-relaxed">
            Add entries to your knowledge base to see AI-detected themes.
          </p>
        </div>
      )}

      {/* SECTION 2: Your KB Interest Badges (FR-02: ranked interest profile) */}
      {kbInterests.length > 0 && (
        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both" style={{ animationDelay: '500ms' }}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Your Top Interests
          </h4>
          <div className="flex flex-wrap gap-2.5">
            {kbInterests.map((t, i) => (
              <Link href={`/knowledge-base?category=${encodeURIComponent(t.name)}`} key={`kb-${i}`}>
                <Badge
                  variant="secondary"
                  className="cursor-pointer text-sm py-1.5 px-3.5 bg-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white transition-all duration-300 border border-transparent hover:border-indigo-400 hover:shadow-md"
                >
                  {t.name}
                  <span className="ml-2 text-xs font-semibold opacity-70">
                    {t.count}
                  </span>
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
