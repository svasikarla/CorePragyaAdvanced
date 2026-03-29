"use client"

import { useEffect, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

interface CategoryDistributionChartProps {
  data: Record<string, number>;
}

export default function CategoryDistributionChart({ data }: CategoryDistributionChartProps) {
  const [chartData, setChartData] = useState<Array<{ name: string; value: number }>>([])

  // Colors for the pie chart
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#84cc16', '#10b981', '#06b6d4', '#3b82f6']

  useEffect(() => {
    // Convert the data object to an array format for the chart
    const formattedData = Object.entries(data).map(([name, value], index) => ({
      name,
      value,
    }))

    // Sort by value in descending order
    formattedData.sort((a, b) => b.value - a.value)

    setChartData(formattedData)
  }, [data])

  // If no data, show a placeholder
  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-50 mb-3">
          <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600">No categories yet</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Add entries to see how your knowledge is distributed across topics.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} entries`, 'Count']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
