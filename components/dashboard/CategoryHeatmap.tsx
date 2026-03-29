"use client"

import { useEffect, useState } from "react"
import { ResponsiveContainer, Tooltip, XAxis, YAxis, ScatterChart, Scatter, Cell } from "recharts"

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  created_at: string;
}

interface CategoryHeatmapProps {
  entries: KnowledgeEntry[];
}

export default function CategoryHeatmap({ entries }: CategoryHeatmapProps) {
  const [chartData, setChartData] = useState<Array<{ x: number; y: number; z: number; category: string; date: string }>>([])
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    if (!entries || entries.length === 0) {
      setChartData([])
      setCategories([])
      return
    }

    // Extract unique categories
    const uniqueCategories = [...new Set(entries.map(entry => entry.category))].filter(Boolean)
    setCategories(uniqueCategories)

    // Group entries by date and category
    const entriesByDateAndCategory = entries.reduce((acc, entry) => {
      const date = new Date(entry.created_at).toLocaleDateString()
      const category = entry.category || 'Uncategorized'
      
      if (!acc[date]) {
        acc[date] = {}
      }
      
      if (!acc[date][category]) {
        acc[date][category] = 0
      }
      
      acc[date][category]++
      return acc
    }, {} as Record<string, Record<string, number>>)

    // Convert to array format for the chart
    const formattedData: Array<{ x: number; y: number; z: number; category: string; date: string }> = []
    
    Object.entries(entriesByDateAndCategory).forEach(([date, categories], dateIndex) => {
      Object.entries(categories).forEach(([category, count]) => {
        const categoryIndex = uniqueCategories.indexOf(category)
        if (categoryIndex !== -1) {
          formattedData.push({
            x: dateIndex,
            y: categoryIndex,
            z: count * 100, // Scale for better visibility
            category,
            date
          })
        }
      })
    })

    setChartData(formattedData)
  }, [entries])

  // If no data, show a placeholder
  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 mb-3">
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600">No activity yet</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Add entries across different categories to see your activity patterns.</p>
      </div>
    )
  }

  // Colors for the heatmap
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#84cc16', '#10b981', '#06b6d4', '#3b82f6']

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        }}
      >
        <XAxis 
          type="number" 
          dataKey="x" 
          name="Date" 
          tick={false}
          label={{ value: 'Time', position: 'insideBottom', offset: -10 }}
        />
        <YAxis 
          type="number" 
          dataKey="y" 
          name="Category" 
          tick={false}
          label={{ value: 'Categories', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          cursor={{ strokeDasharray: '3 3' }}
          formatter={(value, name, props) => {
            if (name === 'z') {
              return [props.payload.category, 'Category']
            }
            if (name === 'x') {
              return [props.payload.date, 'Date']
            }
            return [value, name]
          }}
        />
        <Scatter name="Categories" data={chartData} fill="#8884d8">
          {chartData.map((entry, index) => {
            const categoryIndex = categories.indexOf(entry.category)
            return (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[categoryIndex % COLORS.length]} 
              />
            )
          })}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}
