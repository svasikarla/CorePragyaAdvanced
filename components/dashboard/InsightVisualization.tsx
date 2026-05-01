"use client"

import { useEffect, useRef } from 'react'
import { Chart, registerables, type ChartConfiguration } from 'chart.js'

Chart.register(...registerables)

interface Props {
  categories: Record<string, number>;
}

export default function InsightVisualization({ categories }: Props) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    if (!categories || Object.keys(categories).length === 0) return

    const data = [
      { x: 'Basic', y: 'Low', r: 10 },
      { x: 'Basic', y: 'Medium', r: 15 },
      { x: 'Basic', y: 'High', r: 5 },
      { x: 'Intermediate', y: 'Low', r: 8 },
      { x: 'Intermediate', y: 'Medium', r: 20 },
      { x: 'Intermediate', y: 'High', r: 12 },
      { x: 'Advanced', y: 'Low', r: 6 },
      { x: 'Advanced', y: 'Medium', r: 10 },
      { x: 'Advanced', y: 'High', r: 15 },
    ]

    if (chartRef.current) {
      chartInstance.current?.destroy()

      const ctx = chartRef.current.getContext('2d')
      if (!ctx) return

      const config: ChartConfiguration<'bubble'> = {
        type: 'bubble',
        data: {
          datasets: [{
            label: 'Knowledge Map',
            data: data.map(d => ({
              x: ['Basic', 'Intermediate', 'Advanced'].indexOf(d.x),
              y: ['Low', 'Medium', 'High'].indexOf(d.y),
              r: d.r,
            })),
            backgroundColor: 'rgba(79, 70, 229, 0.7)',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'linear',
              position: 'bottom',
              min: -0.5,
              max: 2.5,
              ticks: {
                callback: (value) => (['Basic', 'Intermediate', 'Advanced'] as const)[value as number] ?? '',
                stepSize: 1,
              },
              title: { display: true, text: 'Basic / Advanced' },
            },
            y: {
              min: -0.5,
              max: 2.5,
              ticks: {
                callback: (value) => (['Low', 'Medium', 'High'] as const)[value as number] ?? '',
                stepSize: 1,
              },
              title: { display: true, text: 'Depth / Relevance' },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const xLabel = ['Basic', 'Intermediate', 'Advanced'][context.parsed.x] ?? ''
                  const yLabel = ['Low', 'Medium', 'High'][context.parsed.y] ?? ''
                  const raw = context.raw as { r: number }
                  return `${xLabel}, ${yLabel}: ${raw.r}`
                },
              },
            },
          },
        },
      }

      chartInstance.current = new Chart(ctx, config)
    }

    return () => {
      chartInstance.current?.destroy()
    }
  }, [categories])

  return <canvas ref={chartRef} />
}
