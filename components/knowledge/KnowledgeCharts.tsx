"use client"

import { useState } from "react"
import { KnowledgeStats } from "@/lib/knowledge-utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CategoryDistributionChart from "@/components/dashboard/CategoryDistributionChart"
import KnowledgeGrowthChart from "@/components/dashboard/KnowledgeGrowthChart"
import CategoryHeatmap from "@/components/dashboard/CategoryHeatmap"
import { PieChart, TrendingUp, Calendar } from "lucide-react"

interface KnowledgeChartsProps {
  stats: KnowledgeStats;
}

export default function KnowledgeCharts({ stats }: KnowledgeChartsProps) {
  const [activeTab, setActiveTab] = useState("distribution")
  
  // Ensure we have valid stats
  const categoryCounts = stats?.categoryCounts || {};
  const recentEntries = stats?.recentEntries || [];
  
  return (
    <Tabs 
      value={activeTab} 
      onValueChange={setActiveTab}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="distribution" className="text-xs gap-1.5">
          <PieChart className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Categories</span>
        </TabsTrigger>
        <TabsTrigger value="growth" className="text-xs gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Growth</span>
        </TabsTrigger>
        <TabsTrigger value="activity" className="text-xs gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Activity</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="distribution" className="h-[240px]">
        <CategoryDistributionChart data={categoryCounts} />
      </TabsContent>
      
      <TabsContent value="growth" className="h-[240px]">
        <KnowledgeGrowthChart entries={recentEntries} />
      </TabsContent>
      
      <TabsContent value="activity" className="h-[240px]">
        <CategoryHeatmap entries={recentEntries} />
      </TabsContent>
    </Tabs>
  )
}
