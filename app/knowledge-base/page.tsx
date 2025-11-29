"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Plus, Search, Filter, SlidersHorizontal, Lightbulb, Globe,
  Bookmark, Trash2, ChevronRight, Mail, RefreshCw, FileText,
  AlertCircle, Info as InfoIcon, Brain, Map, FlashlightIcon as FlashCard,
  BarChart3, Zap, X, Network
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase/client"
import { fetchKnowledgeEntries, KnowledgeStats, getSourceDisplay, getSourceIconName } from "@/lib/knowledge-utils"
import AppLayout from "@/components/layout/AppLayout"
import KnowledgeDisplay from "@/components/knowledge/KnowledgeDisplay"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import debounce from "lodash/debounce"
import { SearchBar } from "@/components/knowledge/SearchBar"
import { KnowledgeCard } from "@/components/knowledge/KnowledgeCard"
import { FilterButtons } from "@/components/knowledge/FilterButtons"
import { SortDropdown } from "@/components/knowledge/SortDropdown"
import { BulkActionsButton } from "@/components/knowledge/BulkActionsButton"
import { useEnhancedSearch } from "@/hooks/useEnhancedSearch"
import { SearchResultSummary } from "@/components/knowledge/EnhancedHighlightedText"
import { LoadingStates, InlineLoading, LoadingOverlay } from "@/components/knowledge/LoadingStates"
import { KnowledgeGridSkeleton } from "@/components/knowledge/KnowledgeCardSkeleton"
import { AnimatedWrapper, StaggeredList } from "@/components/ui/enhanced-animations"
import { initializeAccessibility, ScreenReaderAnnouncer } from "@/lib/accessibility-utils"
import { initializeWebVitals, usePerformanceMonitor } from "@/lib/performance-monitor"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import PdfUploadDialog from "@/components/knowledge/PdfUploadDialog"

// Smart Recommendations Component
interface SmartRecommendationsProps {
  currentEntry: any;
  allEntries: any[];
  onSelectEntry: (entry: any) => void;
}

const SmartRecommendations = ({ currentEntry, allEntries, onSelectEntry }: SmartRecommendationsProps) => {
  // Simple recommendation algorithm based on category and keywords
  const getRecommendations = () => {
    if (!currentEntry || !allEntries) return [];

    const recommendations = allEntries
      .filter(entry => entry.id !== currentEntry.id)
      .map(entry => {
        let score = 0;

        // Same category gets higher score
        if (entry.category === currentEntry.category) score += 3;

        // Check for common keywords in title and summary
        const currentWords = (currentEntry.title + ' ' + currentEntry.summary).toLowerCase().split(/\s+/);
        const entryWords = (entry.title + ' ' + entry.summary).toLowerCase().split(/\s+/);
        const commonWords = currentWords.filter(word =>
          word.length > 3 && entryWords.includes(word)
        );
        score += commonWords.length;

        return { ...entry, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return recommendations;
  };

  const recommendations = getRecommendations();

  if (recommendations.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
      <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center">
        <Lightbulb className="h-4 w-4 mr-2" />
        Recommended for You
      </h3>
      <div className="space-y-2">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="flex items-center justify-between p-2 bg-white rounded border hover:shadow-sm transition-all cursor-pointer"
            onClick={() => onSelectEntry(rec)}
          >
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{rec.title}</h4>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(rec.category)}`}>
                  {rec.category}
                </span>
                <span className="text-xs text-gray-500">Match: {rec.score}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
        ))}
      </div>
    </div>
  );
};

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

// Content Difficulty Indicator Component
interface DifficultyIndicatorProps {
  entry: any;
}

const DifficultyIndicator = ({ entry }: DifficultyIndicatorProps) => {
  // Simple algorithm to determine content difficulty
  const calculateDifficulty = () => {
    const textLength = (entry.summary || '').length;
    const titleComplexity = (entry.title || '').split(' ').length;

    if (textLength > 500 || titleComplexity > 8) return 'Advanced';
    if (textLength > 200 || titleComplexity > 5) return 'Intermediate';
    return 'Beginner';
  };

  const difficulty = calculateDifficulty();
  const colors = {
    'Beginner': 'bg-green-100 text-green-800',
    'Intermediate': 'bg-yellow-100 text-yellow-800',
    'Advanced': 'bg-red-100 text-red-800'
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colors[difficulty]}`}>
      {difficulty}
    </span>
  );
};

// Advanced Search Panel Component - Temporarily removed due to syntax issues

// Learning Analytics Dashboard Component - Simplified for debugging
const LearningAnalyticsDashboard = ({ entries, learningProgress }: { entries: any[]; learningProgress: any }) => {
  return (
    <div className="mb-6 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-6 rounded-lg border border-indigo-100">
      <h2 className="text-lg font-playfair font-bold text-indigo-900 mb-4">Learning Analytics</h2>
      <p>Analytics dashboard temporarily simplified</p>
    </div>
  );
};

// Learning Path Suggestions Component
interface LearningPathSuggestionsProps {
  entries: any[];
  onCreatePath: (path: any) => void;
}

const LearningPathSuggestions = ({ entries, onCreatePath }: LearningPathSuggestionsProps) => {
  // Generate learning paths based on categories and difficulty
  const generateLearningPaths = () => {
    const categories = [...new Set(entries.map(entry => entry.category))];

    return categories.map(category => {
      const categoryEntries = entries.filter(entry => entry.category === category);
      if (categoryEntries.length < 2) return null;

      // Sort by date (assuming newer content builds on older)
      const sortedEntries = categoryEntries.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return {
        category,
        title: `${category} Learning Path`,
        description: `Master ${category} concepts step by step`,
        entries: sortedEntries.slice(0, 4),
        estimatedTime: `${sortedEntries.length * 15} min`,
        difficulty: sortedEntries.length > 3 ? 'Advanced' : 'Beginner'
      };
    }).filter(Boolean);
  };

  const learningPaths = generateLearningPaths();

  if (learningPaths.length === 0) return null;

  return (
    <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-100">
      <h2 className="text-lg font-playfair font-bold text-indigo-900 mb-4 flex items-center">
        <Map className="h-5 w-5 mr-2" />
        Suggested Learning Paths
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {learningPaths.slice(0, 2).map((path) => (
          <div key={path.category} className="bg-white p-4 rounded-lg border border-indigo-200 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{path.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{path.description}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${path.difficulty === 'Advanced' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                {path.difficulty}
              </span>
            </div>

            <div className="space-y-2 mb-3">
              {path.entries.slice(0, 3).map((entry, index) => (
                <div key={entry.id} className="flex items-center text-sm">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium mr-3">
                    {index + 1}
                  </div>
                  <span className="text-gray-700 line-clamp-1">{entry.title}</span>
                </div>
              ))}
              {path.entries.length > 3 && (
                <div className="text-xs text-gray-500 ml-9">
                  +{path.entries.length - 3} more articles
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{path.estimatedTime} estimated</span>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => onCreatePath(path)}
              >
                Start Path
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Content Preview Component for Hover Cards
interface ContentPreviewProps {
  entry: any;
  onQuickAction: (action: string, entry: any) => void;
}

const ContentPreview = ({ entry, onQuickAction }: ContentPreviewProps) => {
  return (
    <div className="w-80 p-4">
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-base text-gray-900 mb-1">{entry.title}</h3>
          <div className="flex items-center space-x-2 mb-2">
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getCategoryColor(entry.category)}`}>
              {entry.category}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(entry.date).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 border">
          {entry.summaryJson ? (
            <div className="space-y-1">
              {entry.summaryJson.key_points?.slice(0, 2).map((point, index) => (
                <div key={index} className="flex items-start">
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 mr-2 shrink-0"></div>
                  <p className="text-xs text-gray-700 line-clamp-2">{point}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-700 line-clamp-3">{entry.summary}</p>
          )}
        </div>

        <div className="flex space-x-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={() => onQuickAction('flashcards', entry)}
          >
            <FlashCard className="h-3 w-3 mr-1" />
            Flashcards
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={() => onQuickAction('map', entry)}
          >
            <Map className="h-3 w-3 mr-1" />
            Map
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={() => onQuickAction('ask', entry)}
          >
            <Brain className="h-3 w-3 mr-1" />
            Ask
          </Button>
        </div>
      </div>
    </div>
  );
};

// Learning Progress Indicator Component
interface LearningProgressIndicatorProps {
  entryId: string;
  progress: any;
}

const LearningProgressIndicator = ({ entryId, progress }: LearningProgressIndicatorProps) => {
  if (!progress) return null;

  const { flashcardsGenerated, conceptMapCreated, questionsAsked, completionPercentage, lastStudied } = progress;

  return (
    <div className="mt-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-indigo-700">Learning Progress</span>
        <span className="text-xs text-indigo-600">{completionPercentage}% complete</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-indigo-100 rounded-full h-2 mb-3">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionPercentage}%` }}
        ></div>
      </div>

      {/* Activity Indicators */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className={`flex items-center ${flashcardsGenerated ? 'text-green-600' : 'text-gray-400'}`}>
            <FlashCard className="h-3 w-3 mr-1" />
            <span>Flashcards</span>
            {flashcardsGenerated && <span className="ml-1">✓</span>}
          </div>
          <div className={`flex items-center ${conceptMapCreated ? 'text-green-600' : 'text-gray-400'}`}>
            <Map className="h-3 w-3 mr-1" />
            <span>Concept Map</span>
            {conceptMapCreated && <span className="ml-1">✓</span>}
          </div>
          <div className={`flex items-center ${questionsAsked > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            <Brain className="h-3 w-3 mr-1" />
            <span>{questionsAsked} Q&A</span>
          </div>
        </div>
        {lastStudied && (
          <span className="text-gray-500">
            Last studied {Math.floor((Date.now() - lastStudied.getTime()) / (1000 * 60 * 60 * 24))}d ago
          </span>
        )}
      </div>
    </div>
  );
};

// Create a helper component to render the summary JSON as bullet points
interface SummaryBulletsProps {
  summaryJson: any;
}

const SummaryBullets = ({ summaryJson }: SummaryBulletsProps) => {
  // If summaryJson is not available, fall back to plain text
  if (!summaryJson) {
    return null;
  }

  let allPoints = [];

  // Handle the expected format with key_points, main_ideas, and insights arrays
  if (typeof summaryJson === 'object') {
    // Check if it's the expected format with arrays
    if (Array.isArray(summaryJson.key_points) ||
      Array.isArray(summaryJson.main_ideas) ||
      Array.isArray(summaryJson.insights)) {

      const keyPoints = Array.isArray(summaryJson.key_points) ? summaryJson.key_points : [];
      const mainIdeas = Array.isArray(summaryJson.main_ideas) ? summaryJson.main_ideas : [];
      const insights = Array.isArray(summaryJson.insights) ? summaryJson.insights : [];

      allPoints = [...keyPoints, ...mainIdeas, ...insights];
    }
    // Handle the numeric key format (1, 2, 3, etc.)
    else {
      // Convert numeric keys to an array of values
      allPoints = Object.keys(summaryJson)
        .filter(key => !isNaN(Number(key))) // Only include numeric keys
        .sort((a, b) => Number(a) - Number(b)) // Sort numerically
        .map(key => summaryJson[key]);
    }
  }

  // Limit to prevent overcrowding
  allPoints = allPoints.slice(0, 3);

  if (allPoints.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {allPoints.map((point, index) => (
        <div key={index} className="flex items-start">
          <div className="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 mr-3 shrink-0 shadow-sm"></div>
          <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{point}</p>
        </div>
      ))}
    </div>
  );
};

// Update the initialEntries to include summaryJson for the mock data
const initialEntries = [
  {
    id: "1",
    title: "The Future of Artificial Intelligence in Education",
    source: "https://example.com/ai-education",
    summary:
      "This article explores how AI is transforming educational methodologies, enabling personalized learning experiences, and helping educators identify knowledge gaps. Key points include adaptive learning systems, automated grading, and AI tutors.",
    summaryJson: {
      key_points: [
        "AI enables personalized learning experiences",
        "Adaptive learning systems adjust to student needs",
        "Automated grading saves educator time"
      ],
      main_ideas: [
        "AI is transforming educational methodologies",
        "Technology helps identify knowledge gaps"
      ],
      insights: [
        "AI tutors provide 24/7 learning support"
      ]
    },
    date: "2023-04-15",
    type: "url",
    category: "Artificial Intelligence",
  },
  {
    id: "2",
    title: "Cognitive Science: Memory Formation and Retention",
    source: "https://example.com/cognitive-science",
    summary:
      "A comprehensive overview of how memories are formed, stored, and retrieved in the human brain. The article discusses the role of the hippocampus, the difference between short-term and long-term memory, and practical techniques to improve retention.",
    summaryJson: {
      key_points: [
        "Hippocampus plays crucial role in memory formation",
        "Short-term and long-term memory use different mechanisms",
        "Spaced repetition improves retention"
      ],
      main_ideas: [
        "Memory formation involves complex neural processes",
        "Different types of memories are stored differently"
      ],
      insights: [
        "Sleep is essential for memory consolidation"
      ]
    },
    date: "2023-03-22",
    type: "url",
    category: "Science",
  },
  {
    id: "3",
    title: "Weekly Research Update: Knowledge Mapping Techniques",
    source: "research@institute.edu",
    summary:
      "This email summarizes recent research on knowledge mapping techniques, including concept mapping, mind mapping, and knowledge graphs. It highlights how these techniques can be used to visualize complex relationships between ideas and enhance understanding.",
    summaryJson: {
      key_points: [
        "Concept mapping helps organize hierarchical knowledge",
        "Mind mapping is effective for brainstorming",
        "Knowledge graphs represent semantic relationships"
      ],
      main_ideas: [
        "Visual techniques enhance understanding of complex topics",
        "Different mapping methods serve different purposes"
      ],
      insights: [
        "Combining multiple mapping techniques yields best results"
      ]
    },
    date: "2023-05-01",
    type: "email",
    category: "Education",
  },
]





// Add a debug component to check the structure of the entries
// Add this component temporarily for debugging
const DebugEntries = ({ entries }) => {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="hidden">
      <pre>{JSON.stringify(entries[0]?.summaryJson, null, 2)}</pre>
    </div>
  );
};

export default function KnowledgeBase() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const { startTimer, endTimer } = usePerformanceMonitor()

  // Memoized category color functions for performance
  const getCategoryColor = useMemo(() => (category: string): string => {
    switch (category) {
      case 'Science': return 'bg-blue-100 text-blue-800';
      case 'Technology': return 'bg-purple-100 text-purple-800';
      case 'Artificial Intelligence': return 'bg-indigo-100 text-indigo-800';
      case 'Business': return 'bg-green-100 text-green-800';
      case 'Health': return 'bg-red-100 text-red-800';
      case 'Education': return 'bg-yellow-100 text-yellow-800';
      case 'Politics': return 'bg-orange-100 text-orange-800';
      case 'Environment': return 'bg-emerald-100 text-emerald-800';
      case 'Arts': return 'bg-pink-100 text-pink-800';
      case 'Sports': return 'bg-lime-100 text-lime-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getCategoryColorValue = useMemo(() => (category: string): string => {
    switch (category) {
      case 'Science': return '#dbeafe'; // blue-100
      case 'Technology': return '#f3e8ff'; // purple-100
      case 'Artificial Intelligence': return '#e0e7ff'; // indigo-100
      case 'Business': return '#dcfce7'; // green-100
      case 'Health': return '#fee2e2'; // red-100
      case 'Education': return '#fef9c3'; // yellow-100
      case 'Politics': return '#ffedd5'; // orange-100
      case 'Environment': return '#d1fae5'; // emerald-100
      case 'Arts': return '#fce7f3'; // pink-100
      case 'Sports': return '#ecfccb'; // lime-100
      default: return '#f3f4f6'; // gray-100
    }
  }, []);
  const [entries, setEntries] = useState([]) // Initialize as empty array instead of undefined
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [deletingEntries, setDeletingEntries] = useState<Set<string>>(new Set())
  const [isFetchingEntries, setIsFetchingEntries] = useState(false)
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats>({
    totalEntries: 0,
    categoryCounts: {},
    recentEntries: [],
    topCategory: 'None',
    topCategoryCount: 0
  })
  const { toast } = useToast()
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")

  // Add all new state variables here, at the top level with other state declarations
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [rawText, setRawText] = useState("")
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isAddPdfOpen, setIsAddPdfOpen] = useState(false)

  // Bulk selection state
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [isBulkMode, setIsBulkMode] = useState(false)

  // Advanced search state - temporarily removed

  // Learning progress state - mock data for demonstration
  const [learningProgress, setLearningProgress] = useState<Record<string, {
    flashcardsGenerated: boolean;
    conceptMapCreated: boolean;
    questionsAsked: number;
    lastStudied: Date | null;
    completionPercentage: number;
  }>>({
    // Mock progress data for demonstration
    "1": {
      flashcardsGenerated: true,
      conceptMapCreated: false,
      questionsAsked: 3,
      lastStudied: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      completionPercentage: 65
    },
    "2": {
      flashcardsGenerated: false,
      conceptMapCreated: true,
      questionsAsked: 1,
      lastStudied: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      completionPercentage: 40
    }
  })

  // Create a debounced function for search - but we'll only use it for specific events
  const debouncedSetSearchQuery = useCallback(
    debounce((query) => {
      setIsSearching(false);
      setDebouncedSearchQuery(query);
    }, 300),
    []
  )

  // Handle search input changes with loading state
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
    debouncedSetSearchQuery(query);
  }, [debouncedSetSearchQuery]);

  // Auto-search is now handled directly in the onChange event

  useEffect(() => {
    // Initialize accessibility and performance monitoring
    initializeAccessibility();
    initializeWebVitals();

    const getUser = async () => {
      // Use a more defensive approach for timing
      const timerName = 'initial_load';

      try {
        startTimer(timerName);

        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.push('/login')
          return
        }

        setUser(session.user)
        await fetchKnowledgeBaseEntries(session.user.id)
        setLoading(false)

        // Announce page load to screen readers
        ScreenReaderAnnouncer.announce('Knowledge base loaded successfully');
      } catch (error) {
        console.error('Error during initial load:', error);
      } finally {
        // Always try to end the timer, but handle the case where it wasn't started
        try {
          endTimer(timerName);
        } catch (timerError) {
          // Timer wasn't started, ignore the error
        }
      }
    }

    getUser()
  }, [router]) // Remove startTimer and endTimer from dependencies

  const fetchKnowledgeBaseEntries = useCallback(async (userId) => {
    // Prevent multiple simultaneous calls
    if (isFetchingEntries) {
      console.log('Already fetching entries, skipping duplicate call');
      return;
    }

    setIsFetchingEntries(true);

    try {
      const { entries, stats, error } = await fetchKnowledgeEntries(userId);

      console.log('Fetched entries:', entries);
      console.log('Stats:', stats);

      if (error) {
        console.error('Error from fetchKnowledgeEntries:', error);
        toast({
          title: "Error loading entries",
          description: "Failed to load your knowledge base entries.",
          variant: "destructive",
        });
        // Return early but ensure entries is set to an empty array
        setEntries([]);
        return;
      }

      // Make sure entries is always an array
      setEntries(entries || []);
      setKnowledgeStats(stats || {
        totalEntries: 0,
        categoryCounts: {},
        recentEntries: [],
        topCategory: 'None',
        topCategoryCount: 0
      });
    } catch (error) {
      console.error('Error in fetchKnowledgeBaseEntries:', error);
      // Ensure entries is set to an empty array on error
      setEntries([]);
      toast({
        title: "Error loading entries",
        description: "Failed to load your knowledge base entries.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingEntries(false);
    }
  }, [isFetchingEntries]); // Add dependencies for useCallback

  const handleSignOut = () => {
    supabase.auth.signOut().then(() => {
      window.location.href = "/login"
    })
  }

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setIsLoading(true)

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to add URLs');
      }

      console.log('Adding URL:', url);
      console.log('User ID:', session.user.id);

      // Call our API endpoint with the auth token
      const response = await fetch('/api/process-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url }),
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = 'Failed to process URL';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          console.error('Error parsing error response:', jsonError);
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      let responseData;
      try {
        const jsonResponse = await response.json();
        responseData = jsonResponse.data;

        console.log('Response data:', responseData);

        if (!responseData || !responseData.id || !responseData.summary_text) {
          throw new Error('Invalid response data from server');
        }
      } catch (jsonError) {
        console.error('Error parsing response:', jsonError);
        throw new Error('Failed to parse server response');
      }

      // Create a new entry for the UI
      const newEntry = {
        id: responseData.id,
        title: responseData.title || responseData.summary_text.split('.')[0] || 'Untitled', // Use title or first sentence as title with fallback
        source: url,
        summary: responseData.summary_text,
        summaryJson: responseData.summary_json, // Include the summary_json field
        date: new Date().toISOString().split("T")[0],
        type: "url",
        category: responseData.category || 'Uncategorized', // Include the category
      };

      console.log('New entry created:', newEntry);

      // Update the entries state with the new entry
      setEntries(prevEntries => [newEntry, ...prevEntries]);
      setUrl("");

      // Refresh the knowledge base to ensure we have the latest data
      if (user?.id) {
        await fetchKnowledgeBaseEntries(user.id);
      }

      toast({
        title: "URL added to Knowledge Base",
        description: "The content has been successfully summarized and added to your knowledge base.",
      });
    } catch (error) {
      console.error('Error adding URL:', error);
      toast({
        title: "Error adding URL",
        description: error.message || "Failed to add URL. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshFromEmail = async () => {
    setIsRefreshing(true);

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('You must be logged in to refresh from email');
      }

      // Call our API endpoint with the auth token
      const response = await fetch('/api/refresh-from-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle OAuth authentication errors specifically
        if (errorData.authRequired) {
          toast({
            title: "Gmail Authentication Required",
            description: "Please set up Gmail integration first.",
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/setup/gmail', '_blank')}
              >
                Setup Gmail
              </Button>
            ),
          });
          return;
        }

        throw new Error(errorData.error || 'Failed to refresh from email');
      }

      const data = await response.json();

      // Refresh the knowledge base entries
      if (user?.id) {
        await fetchKnowledgeBaseEntries(user.id);
      }

      // Show success message with details
      toast({
        title: "Email Refresh Complete",
        description: data.message || `Processed ${data.processed} URLs from emails`,
      });

      // If there were any errors, show a more detailed message
      if (data.errors > 0) {
        toast({
          title: `${data.errors} errors occurred`,
          description: "Some URLs could not be processed. Check the console for details.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error refreshing from email:', error);
      toast({
        title: "Error refreshing from email",
        description: error.message || "Failed to refresh from email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    // Add to deleting set
    setDeletingEntries(prev => new Set(prev).add(id));

    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('knowledgebase')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update UI
      setEntries(entries.filter((entry) => entry.id !== id));

      toast({
        title: "Entry removed",
        description: "The entry has been removed from your knowledge base.",
      });
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Error removing entry",
        description: "Failed to remove the entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Remove from deleting set
      setDeletingEntries(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleBookmarkEntry = (id: string) => {
    toast({
      title: "Entry bookmarked",
      description: "This feature will be available soon.",
    });
  };

  // Use enhanced search for better search results
  const { searchResults, searchStats } = useEnhancedSearch({
    entries: entries || [],
    searchQuery: debouncedSearchQuery
  });

  // Memoized filtered entries calculation for performance
  const filteredEntries = useMemo(() => {
    if (!entries) return [];

    // Start with search results (which includes all entries if no search query)
    return searchResults
      .filter((entry) => {
        // Category filter
        const matchesCategory = !selectedCategory || entry.category === selectedCategory;

        // Type filter
        const matchesType = typeFilter === 'all' || entry.type === typeFilter;

        return matchesCategory && matchesType;
      })
      .sort((a, b) => {
        // If we have search scores and there's a search query, prioritize by relevance first
        if (debouncedSearchQuery && a.searchScore !== undefined && b.searchScore !== undefined) {
          const scoreDiff = (a.searchScore || 0) - (b.searchScore || 0);
          if (Math.abs(scoreDiff) > 0.1) { // Only use score if there's a meaningful difference
            return scoreDiff;
          }
        }

        // Then apply secondary sorting
        if (sortOrder === 'newest') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        } else if (sortOrder === 'oldest') {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        } else if (sortOrder === 'popular') {
          return (b.viewCount || 0) - (a.viewCount || 0);
        }
        return 0;
      });
  }, [entries, searchResults, selectedCategory, typeFilter, debouncedSearchQuery, sortOrder]);

  // Announce search results to screen readers
  useEffect(() => {
    if (debouncedSearchQuery && !isSearching) {
      const resultCount = filteredEntries.length;
      const message = resultCount === 0
        ? `No results found for "${debouncedSearchQuery}"`
        : `Found ${resultCount} result${resultCount === 1 ? '' : 's'} for "${debouncedSearchQuery}"`;

      ScreenReaderAnnouncer.announce(message);
    }
  }, [filteredEntries.length, debouncedSearchQuery, isSearching]);

  if (loading) {
    return (
      <AppLayout>
        <LoadingStates type="skeleton" />
      </AppLayout>
    )
  }

  // Improve the SearchAndFilters component for better usability
  const SearchAndFilters = () => {
    const uniqueCategories = [...new Set(entries.map(entry => entry.category))].filter(Boolean);

    return (
      <div className="mb-4 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onClearSearch={() => {
              setSearchQuery('');
              setDebouncedSearchQuery('');
              setIsSearching(false);
            }}
            onDebouncedSearchChange={debouncedSetSearchQuery}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Quick Filter Buttons */}
            <FilterButtons
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
            />

            {/* Sort and Actions */}
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <SortDropdown
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
              />
              <BulkActionsButton
                isBulkMode={isBulkMode}
                onToggleBulkMode={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedEntries([]);
                }}
              />
            </div>
          </div>
        </div>

        {uniqueCategories.length > 0 && (
          <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm">
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-3">Filter by Category</legend>
              <div className="flex flex-wrap gap-2 sm:gap-3" role="group" aria-label="Category filter options">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className={`min-h-[44px] h-auto px-4 rounded-full transition-all ${selectedCategory === null ? 'bg-indigo-600 hover:bg-indigo-700 shadow-sm' : 'hover:bg-indigo-50 border-indigo-200'} focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                  aria-label="Show all categories"
                  aria-pressed={selectedCategory === null}
                >
                  All Categories
                </Button>
                {uniqueCategories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={`min-h-[44px] h-auto px-4 rounded-full transition-all ${selectedCategory === category ? 'bg-indigo-600 hover:bg-indigo-700 shadow-sm' : 'hover:bg-indigo-50 border-indigo-200'} focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                    aria-label={`Filter by ${category} category`}
                    aria-pressed={selectedCategory === category}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>
    );
  };

  // Consolidated Action Toolbar Component
  const ActionToolbar = () => {
    return (
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-playfair font-bold text-gray-900 tracking-tight">
              Knowledge Base
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and explore your saved content.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Content
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => document.getElementById('url-input-dialog')?.click()}>
                  <Globe className="mr-2 h-4 w-4 text-indigo-500" />
                  <span>Add from URL</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRefreshFromEmail}>
                  <Mail className="mr-2 h-4 w-4 text-purple-500" />
                  <span>Import from Email</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsAddPdfOpen(true)}>
                  <FileText className="mr-2 h-4 w-4 text-red-500" />
                  <span>Upload PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Hidden trigger for URL dialog - to be replaced with a proper Dialog later if needed, 
            but for now reusing the existing logic by focusing an input is tricky without the card.
            Let's add a Dialog for URL input instead.
        */}
        <Dialog>
          <DialogTrigger asChild>
            <button id="url-input-dialog" className="hidden">Open URL Dialog</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Web Content</DialogTitle>
              <DialogDescription>
                Paste a URL to summarize and save to your knowledge base.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              handleAddUrl(e);
              // Close dialog logic would go here, but we'll rely on the loading state for now
            }} className="space-y-4 pt-4">
              <Input
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                autoFocus
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Add URL'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onClearSearch={() => {
                setSearchQuery('');
                setDebouncedSearchQuery('');
                setIsSearching(false);
              }}
              onDebouncedSearchChange={debouncedSetSearchQuery}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <FilterButtons
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
              />

              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                <SortDropdown
                  sortOrder={sortOrder}
                  onSortOrderChange={setSortOrder}
                />
                <BulkActionsButton
                  isBulkMode={isBulkMode}
                  onToggleBulkMode={() => {
                    setIsBulkMode(!isBulkMode);
                    setSelectedEntries([]);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Category Pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full text-xs h-8 ${selectedCategory === null ? 'bg-gray-900 text-white hover:bg-gray-800' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              All
            </Button>
            {[...new Set(entries.map(entry => entry.category))].filter(Boolean).map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full text-xs h-8 ${selectedCategory === category
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200'
                    : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Add this function to handle the Read More button click
  const handleReadMore = async (entry) => {
    setSelectedEntry(entry);
    setIsDetailOpen(true);
    setIsLoadingDetail(true);

    try {
      // Fetch the raw_text from Supabase
      const { data, error } = await supabase
        .from('knowledgebase')
        .select('raw_text')
        .eq('id', entry.id)
        .single();

      if (error) throw error;

      // Format the raw text - split into paragraphs
      const formattedText = data.raw_text
        ? data.raw_text
          .split('\n')
          .filter(para => para.trim().length > 0)
          .join('\n\n')
        : "No content available";

      setRawText(formattedText);
    } catch (error) {
      console.error('Error fetching entry details:', error);
      setRawText("Failed to load content. Please try again.");
      toast({
        title: "Error loading content",
        description: "Could not load the full content for this entry.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Function to handle PDF upload
  const handleAddPdf = (newEntry) => {
    setEntries(prevEntries => [newEntry, ...prevEntries]);
    // Remove this line as filteredEntries is computed, not a state variable
    // setFilteredEntries(prevEntries => [newEntry, ...prevEntries]);
  };

  // AI Learning Feature Handlers
  const handleGenerateFlashcards = async (entry) => {
    toast({
      title: "Generating Flashcards",
      description: `Creating smart flashcards from "${entry.title}"...`,
    });

    try {
      // TODO: Implement flashcard generation API call
      // For now, show success message and update progress
      setTimeout(() => {
        // Update learning progress
        setLearningProgress(prev => ({
          ...prev,
          [entry.id]: {
            ...prev[entry.id],
            flashcardsGenerated: true,
            lastStudied: new Date(),
            completionPercentage: Math.min((prev[entry.id]?.completionPercentage || 0) + 30, 100)
          }
        }));

        toast({
          title: "Flashcards Generated!",
          description: "Your flashcards are ready for study. Progress updated!",
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Error generating flashcards",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleCreateConceptMap = async (entry) => {
    toast({
      title: "Creating Concept Map",
      description: `Mapping concepts from "${entry.title}"...`,
    });

    try {
      // TODO: Implement concept mapping API call
      // For now, show success message and update progress
      setTimeout(() => {
        // Update learning progress
        setLearningProgress(prev => ({
          ...prev,
          [entry.id]: {
            ...prev[entry.id],
            conceptMapCreated: true,
            lastStudied: new Date(),
            completionPercentage: Math.min((prev[entry.id]?.completionPercentage || 0) + 25, 100)
          }
        }));

        toast({
          title: "Concept Map Created!",
          description: "Your visual concept map is ready. Progress updated!",
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Error creating concept map",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleAskAI = async (entry) => {
    toast({
      title: "AI Assistant Ready",
      description: `Ask questions about "${entry.title}"...`,
    });

    try {
      // TODO: Implement AI Q&A modal
      // For now, show success message and update progress
      setTimeout(() => {
        // Update learning progress
        setLearningProgress(prev => ({
          ...prev,
          [entry.id]: {
            ...prev[entry.id],
            questionsAsked: (prev[entry.id]?.questionsAsked || 0) + 1,
            lastStudied: new Date(),
            completionPercentage: Math.min((prev[entry.id]?.completionPercentage || 0) + 10, 100)
          }
        }));

        toast({
          title: "AI Assistant Activated!",
          description: "Question logged! This feature will be fully implemented soon.",
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Error activating AI assistant",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleTrackProgress = async (entry) => {
    toast({
      title: "Learning Progress",
      description: `Tracking your progress with "${entry.title}"...`,
    });

    try {
      // TODO: Implement progress tracking
      // For now, show success message
      setTimeout(() => {
        toast({
          title: "Progress Tracked!",
          description: "Your learning progress has been updated. This feature will be fully implemented soon.",
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Error tracking progress",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Quick action handler for preview cards
  const handleQuickAction = (action: string, entry: any) => {
    switch (action) {
      case 'flashcards':
        handleGenerateFlashcards(entry);
        break;
      case 'map':
        handleCreateConceptMap(entry);
        break;
      case 'ask':
        handleAskAI(entry);
        break;
      default:
        break;
    }
  };

  // Recommendation handlers
  const handleSelectRecommendedEntry = (entry: any) => {
    handleReadMore(entry);
  };

  const handleCreateLearningPath = (path: any) => {
    toast({
      title: "Learning Path Created!",
      description: `Starting "${path.title}" with ${path.entries.length} articles. This feature will be fully implemented soon.`,
    });
  };

  // Bulk operation handlers
  const handleBulkSelect = (entryId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedEntries(prev => [...prev, entryId]);
    } else {
      setSelectedEntries(prev => prev.filter(id => id !== entryId));
    }
  };

  const handleSelectAll = () => {
    if (selectedEntries.length === filteredEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(filteredEntries.map(entry => entry.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.length === 0) return;

    try {
      const { error } = await supabase
        .from('knowledgebase')
        .delete()
        .in('id', selectedEntries);

      if (error) throw error;

      setEntries(entries.filter(entry => !selectedEntries.includes(entry.id)));
      setSelectedEntries([]);
      setIsBulkMode(false);

      toast({
        title: "Entries removed",
        description: `${selectedEntries.length} entries have been removed from your knowledge base.`,
      });
    } catch (error) {
      console.error('Error deleting entries:', error);
      toast({
        title: "Error removing entries",
        description: "Failed to remove the entries. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBulkGenerateFlashcards = async () => {
    if (selectedEntries.length === 0) return;

    toast({
      title: "Generating Flashcards",
      description: `Creating flashcards for ${selectedEntries.length} selected entries...`,
    });

    try {
      // TODO: Implement bulk flashcard generation
      setTimeout(() => {
        toast({
          title: "Bulk Flashcards Generated!",
          description: `Flashcards created for ${selectedEntries.length} entries. This feature will be fully implemented soon.`,
        });
        setSelectedEntries([]);
        setIsBulkMode(false);
      }, 2000);
    } catch (error) {
      console.error('Error generating flashcards:', error);
      toast({
        title: "Error generating flashcards",
        description: "Failed to generate flashcards. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="container py-6 px-4 sm:px-6">
        <ActionToolbar />

        {/* Search Results Summary */}
        <SearchResultSummary
          totalResults={filteredEntries.length}
          searchQuery={debouncedSearchQuery}
          searchMethod={searchStats.searchMethod}
        />

        {isSearching && debouncedSearchQuery ? (
          <LoadingStates
            type="search"
            message="Searching your knowledge base..."
          />
        ) : filteredEntries.length === 0 ? (
          <EmptyState />
        ) : (
          <AnimatedWrapper animation="fadeIn" duration="normal">
            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
              {filteredEntries.map((entry, index) => (
                <div key={entry.id} className="break-inside-avoid">
                  <AnimatedWrapper
                    animation="slideUp"
                    delay={index < 6 ? (['none', 'short', 'short', 'medium', 'medium', 'medium'] as const)[index] : 'none'}
                  >
                    <KnowledgeCard
                      entry={entry}
                      searchQuery={debouncedSearchQuery}
                      onReadMore={handleReadMore}
                      onDelete={handleDeleteEntry}
                      getCategoryColor={getCategoryColor}
                      getCategoryColorValue={getCategoryColorValue}
                      isDeleting={deletingEntries.has(entry.id)}
                    />
                  </AnimatedWrapper>
                </div>
              ))}
            </div>
          </AnimatedWrapper>
        )}
      </div>
    </AppLayout>
  );
}
