import { KnowledgeStats } from "@/lib/knowledge-utils"
import { Database, BookOpen, BarChart, TrendingUp } from "lucide-react"

interface KnowledgeStatsCardProps {
  stats: KnowledgeStats;
  compact?: boolean;
}

export default function KnowledgeStatsCard({ stats, compact = false }: KnowledgeStatsCardProps) {
  const totalEntries = stats?.totalEntries || 0;
  const topCategory = stats?.topCategory || 'None';
  const topCategoryCount = stats?.topCategoryCount || 0;
  const recentEntries = stats?.recentEntries || [];
  const categoryCount = Object.keys(stats?.categoryCounts || {}).length;

  const lastUpdated = recentEntries.length > 0
    ? new Date(recentEntries[0].created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'No entries';

  const cards = [
    {
      label: "Total Entries",
      value: totalEntries,
      icon: Database,
      gradient: "from-indigo-500 to-indigo-600",
      bgLight: "bg-indigo-50",
      ring: "ring-indigo-100",
      iconColor: "text-indigo-600",
      textColor: "text-indigo-700",
    },
    {
      label: "Top Category",
      value: topCategory !== 'None' ? topCategory : '--',
      subtitle: topCategoryCount > 0 ? `${topCategoryCount} entries` : undefined,
      icon: BookOpen,
      gradient: "from-purple-500 to-purple-600",
      bgLight: "bg-purple-50",
      ring: "ring-purple-100",
      iconColor: "text-purple-600",
      textColor: "text-purple-700",
    },
    {
      label: "Categories",
      value: categoryCount,
      icon: TrendingUp,
      gradient: "from-emerald-500 to-emerald-600",
      bgLight: "bg-emerald-50",
      ring: "ring-emerald-100",
      iconColor: "text-emerald-600",
      textColor: "text-emerald-700",
    },
    {
      label: "Last Updated",
      value: lastUpdated,
      icon: BarChart,
      gradient: "from-amber-500 to-orange-500",
      bgLight: "bg-amber-50",
      ring: "ring-amber-100",
      iconColor: "text-amber-600",
      textColor: "text-amber-700",
    },
  ];

  return (
    <div className={`grid gap-4 ${compact ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="group relative overflow-hidden rounded-xl border bg-white shadow-sm hover:shadow-md transition-all duration-300 animate-count-up"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Top gradient accent strip */}
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.gradient}`} />

          <div className={`${compact ? 'p-4' : 'p-5'} flex items-center gap-4`}>
            <div className={`flex-shrink-0 ${compact ? 'h-10 w-10' : 'h-12 w-12'} ${card.bgLight} ring-1 ${card.ring} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
              <card.icon className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} ${card.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.label}</p>
              <p className={`${compact ? 'text-lg' : 'text-xl'} font-bold ${card.textColor} truncate leading-tight mt-0.5`}>
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </p>
              {card.subtitle && (
                <p className="text-[11px] text-slate-400 mt-0.5">{card.subtitle}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
