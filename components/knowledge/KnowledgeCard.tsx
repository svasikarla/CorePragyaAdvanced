import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Globe, Mail, Lightbulb, Trash2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { SafeHighlightedText } from "./EnhancedHighlightedText";
import { LoadingOverlay } from "./LoadingStates";
import { HoverAnimation } from "../ui/enhanced-animations";
import { KEYBOARD_KEYS } from "../../lib/accessibility-utils";

// Search Highlighting Component
interface HighlightedTextProps {
  text: string;
  searchQuery: string;
}

const HighlightedText = ({ text, searchQuery }: HighlightedTextProps) => {
  if (!searchQuery || !text) return <span>{text}</span>;

  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
};

// Summary Bullets Component
interface SummaryBulletsProps {
  summaryJson: any;
}

const SummaryBullets = ({ summaryJson }: SummaryBulletsProps) => {
  // If summaryJson is not available, fall back to plain text
  if (!summaryJson) {
    return null;
  }

  let allPoints = [];

  // Extract key points
  if (summaryJson.key_points && Array.isArray(summaryJson.key_points)) {
    allPoints = [...allPoints, ...summaryJson.key_points];
  }

  // Extract main points
  if (summaryJson.main_points && Array.isArray(summaryJson.main_points)) {
    allPoints = [...allPoints, ...summaryJson.main_points];
  }

  // Extract bullet points
  if (summaryJson.bullet_points && Array.isArray(summaryJson.bullet_points)) {
    allPoints = [...allPoints, ...summaryJson.bullet_points];
  }

  // Extract points array
  if (summaryJson.points && Array.isArray(summaryJson.points)) {
    allPoints = [...allPoints, ...summaryJson.points];
  }

  // If no points found, try to extract from summary field
  if (allPoints.length === 0 && summaryJson.summary) {
    if (typeof summaryJson.summary === 'string') {
      // Try to split by bullet points or line breaks
      const summaryPoints = summaryJson.summary
        .split(/[•\-\*]\s*/)
        .filter(point => point.trim().length > 0)
        .map(point => point.trim());

      if (summaryPoints.length > 1) {
        allPoints = summaryPoints.slice(1); // Skip first empty element
      }
    }
  }

  // Remove duplicates and limit to 3 points
  const uniquePoints = [...new Set(allPoints)].slice(0, 3);

  if (uniquePoints.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {uniquePoints.map((point, index) => (
        <div key={index} className="flex items-start">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-2 mr-3 shrink-0"></div>
          <p className="text-sm text-gray-700 leading-relaxed">{point}</p>
        </div>
      ))}
    </div>
  );
};

interface KnowledgeEntry {
  id: string;
  title: string;
  summary: string;
  summaryJson?: any;
  category: string;
  type: string;
  source: string;
  date: string;
}

interface KnowledgeCardProps {
  entry: KnowledgeEntry;
  searchQuery: string;
  onReadMore: (entry: KnowledgeEntry) => void;
  onDelete: (id: string) => void;
  getCategoryColor: (category: string) => string;
  getCategoryColorValue: (category: string) => string;
  isDeleting?: boolean;
}

export const KnowledgeCard = React.memo(function KnowledgeCard({
  entry,
  searchQuery,
  onReadMore,
  onDelete,
  getCategoryColor,
  getCategoryColorValue,
  isDeleting = false
}: KnowledgeCardProps) {
  // Handle keyboard navigation for the card
  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === KEYBOARD_KEYS.ENTER || event.key === KEYBOARD_KEYS.SPACE) {
      event.preventDefault();
      onReadMore(entry);
    }
  };
  return (
    <LoadingOverlay isVisible={isDeleting} message="Deleting...">
      <HoverAnimation effect="lift">
        <Card
          className="overflow-hidden flex flex-col h-full border-0 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out group bg-white"
          tabIndex={0}
          role="article"
          aria-label={`Knowledge entry: ${entry.title}`}
          onKeyDown={handleCardKeyDown}
        >
          {/* Decorative top border based on category */}
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: getCategoryColorValue(entry.category) }}
          />

          <CardHeader className="p-5 pb-2 space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getCategoryColor(entry.category)}`}>
                    {entry.category}
                  </span>
                </div>
                <CardTitle
                  className="text-lg font-bold text-gray-900 leading-snug group-hover:text-indigo-600 transition-colors cursor-pointer"
                  onClick={() => onReadMore(entry)}
                >
                  <SafeHighlightedText text={entry.title} searchQuery={searchQuery} />
                </CardTitle>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(entry.id);
                }}
                aria-label={`Delete ${entry.title}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-2 flex-grow">
            <div className="text-sm text-gray-600 leading-relaxed line-clamp-4">
              {entry.summaryJson ? (
                <SummaryBullets summaryJson={entry.summaryJson} />
              ) : (
                <p>
                  <SafeHighlightedText text={entry.summary} searchQuery={searchQuery} />
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="p-5 pt-0 pb-5 mt-auto border-t border-gray-50 bg-gray-50/50">
            <div className="w-full flex items-center justify-between text-xs text-gray-500 pt-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5" title="Source Type">
                  {entry.type === "url" ? (
                    <Globe className="h-3.5 w-3.5 text-indigo-400" />
                  ) : entry.type === "email" ? (
                    <Mail className="h-3.5 w-3.5 text-purple-400" />
                  ) : (
                    <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                  )}
                  <span className="font-medium">
                    {entry.type === "url" ? "Web" : entry.type === "email" ? "Email" : "Note"}
                  </span>
                </span>
                <span className="text-gray-300">•</span>
                <span>{new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-indigo-600 hover:text-indigo-700 hover:bg-transparent font-medium group/btn"
                onClick={() => onReadMore(entry)}
              >
                Read <ChevronRight className="ml-1 h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </HoverAnimation>
    </LoadingOverlay>
  );
});
