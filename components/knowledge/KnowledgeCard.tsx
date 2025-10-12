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
          className="overflow-hidden flex flex-col h-full border-l-4 bg-gradient-to-br from-white to-gray-50 transition-all duration-300 ease-in-out hover:shadow-xl group focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2"
          style={{ borderLeftColor: getCategoryColorValue(entry.category) }}
          tabIndex={0}
          role="article"
          aria-label={`Knowledge entry: ${entry.title}`}
          onKeyDown={handleCardKeyDown}
        >
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <CardTitle className="line-clamp-2 text-lg font-playfair font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors duration-300 leading-tight cursor-pointer">
              <SafeHighlightedText text={entry.title} searchQuery={searchQuery} />
            </CardTitle>
          </div>
          <div className="flex space-x-1 ml-2">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[32px] min-w-[32px] h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all duration-300 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 opacity-0 group-hover:opacity-100"
              onClick={() => onDelete(entry.id)}
              aria-label={`Delete ${entry.title}`}
            >
              <Trash2 className="h-4 w-4 transition-transform duration-300 hover:scale-110" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${getCategoryColor(entry.category)}`}>
            {entry.category}
          </span>
          {entry.type === "url" ? (
            <Link
              href={entry.source}
              target="_blank"
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors shadow-sm"
            >
              <Globe className="mr-1 h-3 w-3" /> Web
            </Link>
          ) : entry.type === "email" ? (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 shadow-sm">
              <Mail className="mr-1 h-3 w-3" /> Email
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 shadow-sm">
              <Lightbulb className="mr-1 h-3 w-3" /> Source
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-2 flex-grow">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          {entry.summaryJson ? (
            <SummaryBullets summaryJson={entry.summaryJson} />
          ) : (
            <p className="line-clamp-3 text-sm text-gray-700 leading-relaxed">
              <SafeHighlightedText text={entry.summary} searchQuery={searchQuery} />
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-5 pt-2">
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {new Date(entry.date).toLocaleDateString()}
            </span>
            <Button
              variant="link"
              className="min-h-[44px] h-auto p-2 text-indigo-700 hover:text-indigo-800 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 group/button"
              onClick={() => onReadMore(entry)}
              aria-label={`Read more about ${entry.title}`}
            >
              Read More <ChevronRight className="ml-1 h-3 w-3 transition-transform duration-300 group-hover/button:translate-x-1" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardFooter>
        </Card>
      </HoverAnimation>
    </LoadingOverlay>
  );
});
