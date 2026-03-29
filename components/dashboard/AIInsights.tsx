"use client"

import { Lightbulb, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AIInsightsProps {
  insights: string[]
  loading: boolean
  onRefresh: () => void
}

export default function AIInsights({ insights, loading, onRefresh }: AIInsightsProps) {
  return (
    <div>
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            <p className="text-sm font-medium">Analyzing your knowledge base...</p>
          </div>
        ) : insights.length > 0 ? (
          insights.map((insight, index) => (
            <div
              key={index}
              className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2 fill-mode-both"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="flex-shrink-0 mt-0.5 p-1.5 bg-purple-50 rounded-lg">
                <Lightbulb className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
            </div>
          ))
        ) : (
          <div className="text-center py-6 animate-in fade-in duration-500">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-50 mb-3">
              <Lightbulb className="h-5 w-5 text-purple-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">No insights yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Click &quot;Refresh Insights&quot; to generate AI-powered analysis of your knowledge base.</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={onRefresh}
          disabled={loading}
          variant="outline"
          size="sm"
          className="text-xs gap-2 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading ? 'Analyzing...' : 'Refresh Insights'}
        </Button>
      </div>
    </div>
  )
}
