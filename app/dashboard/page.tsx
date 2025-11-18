
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Lightbulb, BookOpen, Clock, Plus, BarChart3, PieChart, TrendingUp, Brain, Network } from "lucide-react"
import AIInsights from "@/components/dashboard/AIInsights"
import { fetchKnowledgeEntries, KnowledgeStats } from "@/lib/knowledge-utils"
import AppLayout from "@/components/layout/AppLayout"
import KnowledgeDisplay from "@/components/knowledge/KnowledgeDisplay"
import Link from "next/link"
import KnowledgeCharts from "@/components/knowledge/KnowledgeCharts"

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats>({
    totalEntries: 0,
    categoryCounts: {},
    recentEntries: [],
    topCategory: 'None',
    topCategoryCount: 0
  })
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/login')
          return
        }
        
        console.log('Dashboard - User session:', session.user.id)
        setUser(session.user)
        await fetchKnowledgeStats(session.user.id)
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
      console.log('Fetching knowledge stats for user:', userId)
      const { stats, entries, error } = await fetchKnowledgeEntries(userId)
      
      if (error) {
        console.error('Error fetching knowledge stats:', error)
        return
      }
      
      console.log('Fetched knowledge stats:', stats)
      console.log('Fetched entries count:', entries?.length || 0)
      
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

  // Ensure recentEntries is always an array
  const recentEntries = knowledgeStats?.recentEntries || []

  return (
    <AppLayout user={user}>
      <div className="container py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-playfair text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View insights and analytics about your knowledge base.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/knowledge-graph">
                <Network className="mr-2 h-4 w-4" />
                View Graph
              </Link>
            </Button>
            <Button className="bg-indigo-700 hover:bg-indigo-800" asChild>
              <Link href="/knowledge-base">
                <Plus className="mr-2 h-4 w-4" />
                Add Knowledge
              </Link>
            </Button>
          </div>
        </div>

        {/* Knowledge Overview */}
        {!loading && (
          <>
            <KnowledgeDisplay stats={knowledgeStats} compact={true} />
            
            <Tabs defaultValue="insights" className="mb-8">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="insights">
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Insights
                </TabsTrigger>
                <TabsTrigger value="charts">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Charts
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Activity
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="insights">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Insights</CardTitle>
                    <CardDescription>
                      Personalized insights based on your knowledge base.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {knowledgeStats.totalEntries > 0 ? (
                      <AIInsights knowledgeData={knowledgeStats} />
                    ) : (
                      <div className="text-center py-8">
                        <Lightbulb className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-medium">No insights available</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Start adding knowledge entries to get personalized insights.
                        </p>
                        <Button className="mt-4 bg-indigo-700 hover:bg-indigo-800" asChild>
                          <Link href="/knowledge-base">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Knowledge
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="charts">
                <Card>
                  <CardHeader>
                    <CardTitle>Knowledge Analytics</CardTitle>
                    <CardDescription>
                      Visual representation of your knowledge base.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {knowledgeStats.totalEntries > 0 ? (
                      <div className="h-[400px]">
                        <KnowledgeCharts stats={knowledgeStats} />
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <PieChart className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-medium">No charts available</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Start adding knowledge entries to see analytics.
                        </p>
                        <Button className="mt-4 bg-indigo-700 hover:bg-indigo-800" asChild>
                          <Link href="/knowledge-base">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Knowledge
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="activity">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                      Your recent knowledge base activity.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentEntries.length > 0 ? (
                      <div className="space-y-4">
                        {recentEntries.map((entry) => (
                          <div key={entry.id} className="flex items-start border-b pb-4">
                            <div className="flex-shrink-0 mr-3">
                              <BookOpen className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                              <h4 className="text-sm font-medium">{entry.title}</h4>
                              <p className="text-xs text-muted-foreground">
                                {entry.category} • {new Date(entry.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-medium">No recent activity</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Start adding knowledge entries to track your activity.
                        </p>
                        <Button className="mt-4 bg-indigo-700 hover:bg-indigo-800" asChild>
                          <Link href="/knowledge-base">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Knowledge
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  )
}
