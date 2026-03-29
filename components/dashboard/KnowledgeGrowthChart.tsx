"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  created_at: string;
}

interface KnowledgeGrowthChartProps {
  entries: KnowledgeEntry[];
}

export default function KnowledgeGrowthChart({ entries }: KnowledgeGrowthChartProps) {
  const [chartData, setChartData] = useState<Array<{ date: string; count: number }>>([])

  useEffect(() => {
    if (!entries || entries.length === 0) {
      setChartData([])
      return
    }

    // Group entries by date and count them
    const entriesByDate = entries.reduce((acc, entry) => {
      const date = new Date(entry.created_at).toLocaleDateString()
      if (!acc[date]) {
        acc[date] = 0
      }
      acc[date]++
      return acc
    }, {} as Record<string, number>)

    // Convert to array and sort by date
    const dateEntries = Object.entries(entriesByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate cumulative count
    let cumulativeCount = 0
    const cumulativeData = dateEntries.map(({ date, count }) => {
      cumulativeCount += count
      return { date, count: cumulativeCount }
    })

    setChartData(cumulativeData)
  }, [entries])

  // If no data, show a placeholder
  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 mb-3">
          <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600">No growth data yet</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Add entries to your knowledge base to track growth over time.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip formatter={(value) => [`${value} entries`, 'Total']} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#6366f1"
          activeDot={{ r: 8 }}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
