"use client"

import { useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface CategoryDistributionChartProps {
  data: Record<string, number>;
}

// Show the top N categories individually; roll the long tail into a single
// "Other" bar so a 13-category knowledge base stays readable in a small card.
const TOP_N = 8
const LABEL_MAX = 16

function truncate(label: string) {
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label
}

export default function CategoryDistributionChart({ data }: CategoryDistributionChartProps) {
  const { chartData, total } = useMemo(() => {
    const sorted = Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const sum = sorted.reduce((s, e) => s + e.value, 0)

    if (sorted.length <= TOP_N + 1) {
      return { chartData: sorted, total: sum }
    }

    const top = sorted.slice(0, TOP_N)
    const rest = sorted.slice(TOP_N)
    const otherValue = rest.reduce((s, e) => s + e.value, 0)

    return {
      chartData: [...top, { name: `Other (${rest.length})`, value: otherValue }],
      total: sum,
    }
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
    <div className="category-bar-chart h-full w-full">
      {/* Single validated hue (dataviz series-1 blue), stepped for dark mode.
          One measure across categories → one color; length carries magnitude. */}
      <style>{`
        .category-bar-chart { --cat-bar: #2a78d6; --cat-ink: #52514e; }
        .dark .category-bar-chart, :root[data-theme="dark"] .category-bar-chart {
          --cat-bar: #3987e5; --cat-ink: #c3c2b7;
        }
      `}</style>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
          barCategoryGap={4}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--cat-ink)", fontSize: 12 }}
            tickFormatter={truncate}
          />
          <Tooltip
            cursor={{ fill: "rgba(120,120,120,0.08)" }}
            formatter={(value: number) => {
              const pct = total > 0 ? Math.round((value / total) * 100) : 0
              return [`${value} entries (${pct}%)`, "Count"]
            }}
          />
          <Bar
            dataKey="value"
            fill="var(--cat-bar)"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            label={{
              position: "right",
              fill: "var(--cat-ink)",
              fontSize: 11,
            }}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
