"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lightbulb, Clock, Plus, BarChart3, PieChart, TrendingUp, Network, Sparkles, Rss } from "lucide-react"
import AIInsights from "@/components/dashboard/AIInsights"
import { fetchKnowledgeEntries, KnowledgeStats } from "@/lib/knowledge-utils"
import AppLayout from "@/components/layout/AppLayout"
import KnowledgeDisplay from "@/components/knowledge/KnowledgeDisplay"
import Link from "next/link"
import KnowledgeCharts from "@/components/knowledge/KnowledgeCharts"
import TrendingTopics from "@/components/dashboard/TrendingTopics"
import type { TrendingTopic } from "@/components/dashboard/TrendingTopics"
import TrendingNewsFeed from "@/components/dashboard/TrendingNewsFeed"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats>({
    totalEntries: 0,
    categoryCounts: {},
    recentEntries: [],
    topCategory: 'None',
    topCategoryCount: 0
  })
  const [aiInsights, setAiInsights] = useState<string[]>([])
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const router = useRouter()

  const fetchDeepInsights = async (token: string) => {
    setInsightsLoading(true)
    try {
      const res = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        setAiInsights(data.insights || [])
        setTrendingTopics(data.trending_topics || [])
      }
    } catch (error) {
      console.error('Error fetching deep insights:', error)
    } finally {
      setInsightsLoading(false)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        setUser(session.user)
        setAccessToken(session.access_token)
        await fetchKnowledgeStats(session.user.id)
        fetchDeepInsights(session.access_token)
      } catch (error) {
        console.error('Error getting user session:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [router])

  const fetchKnowledgeStats = async (userId: string) => {
    try {
      const { stats, error } = await fetchKnowledgeEntries(userId)

      if (error) {
        console.error('Error fetching knowledge stats:', error)
        return
      }

      setKnowledgeStats(stats || {
        totalEntries: 0,
        categoryCounts: {},
        recentEntries: [],
        topCategory: 'None',
        topCategoryCount: 0
      })
    } catch (error) {
      console.error('Error in fetchKnowledgeStats:', error)
    }
  }

  const recentEntries = knowledgeStats?.recentEntries || []
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'

  return (
    <AppLayout user={user}>
      <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6">

        {/* Personalized Greeting Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-6 sm:p-8 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMCBoNjB2NjBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2cpIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PC9zdmc+')] opacity-50" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                {getGreeting()}, {userName}
                <Sparkles className="h-6 w-6 text-amber-300 animate-pulse" />
              </h1>
              <p className="mt-1.5 text-indigo-100 text-sm sm:text-base">
                {knowledgeStats.totalEntries > 0
                  ? `Your knowledge base has ${knowledgeStats.totalEntries} entries across ${Object.keys(knowledgeStats.categoryCounts).length} categories.`
                  : "Start building your personal intelligence layer."
                }
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="outline" className="h-10 px-4 rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm transition-all shadow-sm" asChild>
                <Link href="/knowledge-graph">
                  <Network className="mr-2 h-4 w-4" />
                  View Graph
                </Link>
              </Button>
              <Button className="h-10 px-5 rounded-full bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all font-semibold" asChild>
                <Link href="/knowledge-base">
                  <Plus className="mr-2 h-5 w-5" />
                  Add Knowledge
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Knowledge Overview */}
        {!loading && user && (
          <div className="space-y-8 pb-12">

            {/* Stat Cards Row */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
              <KnowledgeDisplay stats={knowledgeStats} compact={true} />
            </div>

            {/* Main Content: Feed + Analytics side by side */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* Left: Trending News Feed - 2 columns wide */}
              {accessToken && (
                <div className="xl:col-span-2 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 fill-mode-both">
                  <TrendingNewsFeed accessToken={accessToken} />
                </div>
              )}

              {/* Right: Analytics + Themes stacked */}
              <div className="xl:col-span-1 space-y-6">

                {/* Knowledge Analytics */}
                <Card className="overflow-hidden border-indigo-100/60 shadow-lg shadow-indigo-900/5 hover:shadow-xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-6 delay-300 fill-mode-both group flex flex-col">
                  <CardHeader className="bg-gradient-to-r from-indigo-50/80 to-transparent pb-4 border-b border-indigo-50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-white shadow-sm ring-1 ring-indigo-100 rounded-xl group-hover:bg-indigo-600 group-hover:ring-indigo-600 transition-colors duration-300">
                        <BarChart3 className="h-5 w-5 text-indigo-600 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold tracking-tight text-slate-800">Knowledge Analytics</CardTitle>
                        <CardDescription className="text-sm font-medium">Your knowledge at a glance.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 flex-1 flex flex-col justify-center">
                    {knowledgeStats.totalEntries > 0 ? (
                      <div className="h-[280px] w-full mt-2">
                        <KnowledgeCharts stats={knowledgeStats} />
                      </div>
                    ) : (
                      <div className="text-center py-8 flex flex-col items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 ring-1 ring-slate-100">
                          <PieChart className="h-6 w-6 text-slate-300" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700">No charts yet</h3>
                        <p className="mt-1 text-xs text-slate-500">Add entries to see analytics.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Knowledge Themes */}
                <Card className="border-red-100/60 shadow-lg shadow-red-900/5 hover:shadow-xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-8 delay-400 fill-mode-both group flex flex-col bg-gradient-to-b from-white to-red-50/10">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-red-50 text-red-600 ring-1 ring-red-100 shadow-sm rounded-xl group-hover:bg-red-500 group-hover:text-white transition-colors duration-300">
                        <TrendingUp className="h-5 w-5 transition-colors duration-300" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold tracking-tight text-slate-800">Knowledge Themes</CardTitle>
                        <CardDescription className="text-sm font-medium">AI-detected patterns in your collection.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto max-h-[300px] pr-2 mt-2">
                    <TrendingTopics userId={user.id} trendingTopics={trendingTopics} insightsLoading={insightsLoading} />
                  </CardContent>
                </Card>

              </div>
            </div>

            {/* Bottom Row: AI Insights + Recent Activity */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              {/* AI Insights - spans 2 cols */}
              <Card className="xl:col-span-2 overflow-hidden border-purple-200/50 shadow-lg shadow-purple-900/5 hover:shadow-xl hover:shadow-purple-900/10 transition-all duration-500 animate-in fade-in slide-in-from-bottom-10 delay-500 fill-mode-both group ring-1 ring-purple-100/50 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent pointer-events-none" />
                <CardHeader className="pb-4 border-b border-purple-50">
                  <div className="flex items-center space-x-3 relative z-10">
                    <div className="p-2.5 bg-purple-50 ring-1 ring-purple-100 shadow-sm rounded-xl group-hover:bg-purple-600 group-hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all duration-300">
                      <Lightbulb className="h-5 w-5 text-purple-600 group-hover:text-white transition-colors duration-300 group-hover:animate-pulse" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-800 to-indigo-800">Deep AI Insights</CardTitle>
                      <CardDescription className="text-sm font-medium">Synthesized intelligence from your data.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative z-10 p-6">
                  {knowledgeStats.totalEntries > 0 ? (
                     <div className="bg-white/50 backdrop-blur rounded-xl p-2 -mx-2">
                       <AIInsights insights={aiInsights} loading={insightsLoading} onRefresh={() => supabase.auth.getSession().then(({ data: { session } }) => session && fetchDeepInsights(session.access_token))} />
                     </div>
                  ) : (
                    <div className="text-center py-8 flex flex-col items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 ring-1 ring-slate-100">
                        <Lightbulb className="h-6 w-6 text-slate-300" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-700">Awaiting Data</h3>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                        Add entries to the knowledge base to see AI-powered insights.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="xl:col-span-1 border-slate-200/60 shadow-lg shadow-slate-900/5 hover:shadow-xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-12 delay-700 fill-mode-both group flex flex-col">
                <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/30">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-white shadow-sm ring-1 ring-slate-200 rounded-xl group-hover:bg-slate-700 transition-colors duration-300">
                      <Clock className="h-5 w-5 text-slate-700 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold tracking-tight text-slate-800">Recent Activity</CardTitle>
                      <CardDescription className="text-sm font-medium">Your chronological timeline.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex-1">
                  {recentEntries.length > 0 ? (
                    <div className="relative border-l-2 border-slate-100 ml-3 space-y-6 pb-2">
                      {recentEntries.slice(0, 6).map((entry) => (
                        <div key={entry.id} className="relative pl-6 group/item">
                          <div className="absolute w-3.5 h-3.5 bg-white border-2 border-indigo-400 rounded-full -left-[8.5px] top-1.5 group-hover/item:scale-125 group-hover/item:border-indigo-600 transition-transform duration-300 shadow-sm" />
                          <h4 className="text-sm font-bold text-slate-700 leading-tight line-clamp-2 group-hover/item:text-indigo-700 transition-colors mb-1">
                            {entry.title}
                          </h4>
                          <div className="flex items-center mt-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 group-hover/item:bg-indigo-50 group-hover/item:text-indigo-600 transition-colors">
                              {entry.category}
                            </span>
                            <span className="ml-3 text-[11px] font-medium text-slate-400">
                              {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      ))}

                      {recentEntries.length > 6 && (
                        <div className="relative pl-6 pt-2">
                           <div className="absolute w-2 h-2 bg-slate-200 rounded-full -left-[5px] top-4" />
                           <Button variant="link" className="text-xs text-muted-foreground hover:text-indigo-600 p-0 h-auto" asChild>
                             <Link href="/knowledge-base">View complete history &rarr;</Link>
                           </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 flex flex-col items-center justify-center h-full">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3 ring-1 ring-slate-100">
                        <Clock className="h-6 w-6 text-slate-300" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-700">Empty Timeline</h3>
                      <p className="mt-1 text-xs text-slate-500">Add your first entry to start tracking.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
