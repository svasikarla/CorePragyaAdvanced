import { useMemo } from 'react';
import Fuse from 'fuse.js';
import { performanceMonitor } from '../lib/performance-monitor';

interface KnowledgeEntry {
  id: string;
  title: string;
  summary: string;
  category: string;
  type: string;
  source: string;
  date: string;
  raw_text?: string;
}

interface UseEnhancedSearchProps {
  entries: KnowledgeEntry[];
  searchQuery: string;
}

interface SearchResult extends KnowledgeEntry {
  searchScore?: number;
  matchedFields?: string[];
}

export function useEnhancedSearch({ entries, searchQuery }: UseEnhancedSearchProps) {
  // Configure Fuse.js options for optimal search experience
  const fuseOptions = useMemo(() => ({
    keys: [
      { name: 'title', weight: 0.4 },
      { name: 'summary', weight: 0.3 },
      { name: 'category', weight: 0.2 },
      { name: 'raw_text', weight: 0.1 }
    ],
    threshold: 0.4, // Lower = more strict matching
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
    findAllMatches: true,
  }), []);

  // Create Fuse instance
  const fuse = useMemo(() => {
    return new Fuse(entries, fuseOptions);
  }, [entries, fuseOptions]);

  // Perform search with fallback to basic search
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim()) {
      return entries;
    }

    const startTime = performance.now();
    let searchMethod: 'enhanced' | 'basic' = 'enhanced';
    let results: SearchResult[] = [];

    try {
      // Use enhanced fuzzy search
      const fuseResults = fuse.search(searchQuery);

      if (fuseResults.length === 0) {
        // Fallback to basic string matching if no fuzzy results
        searchMethod = 'basic';
        results = entries.filter(entry =>
          entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.category.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(entry => ({
          ...entry,
          searchScore: 0.5,
          matchedFields: ['fallback']
        }));
      } else {
        // Transform Fuse results to our format
        results = fuseResults.map(result => {
          const matchedFields = result.matches?.map(match => match.key) || [];
          return {
            ...result.item,
            searchScore: result.score || 0,
            matchedFields
          };
        });
      }
    } catch (error) {
      console.warn('Enhanced search failed, falling back to basic search:', error);
      searchMethod = 'basic';

      // Fallback to original basic search
      results = entries.filter(entry =>
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.summary.toLowerCase().includes(searchQuery.toLowerCase())
      ).map(entry => ({
        ...entry,
        searchScore: 0.5,
        matchedFields: ['basic']
      }));
    }

    // Record performance metrics
    const searchTime = performance.now() - startTime;
    performanceMonitor.recordSearchPerformance(
      searchQuery,
      results.length,
      searchTime,
      searchMethod
    );

    return results;
  }, [fuse, searchQuery, entries]);

  // Calculate search statistics
  const searchStats = useMemo(() => {
    if (!searchQuery.trim()) {
      return {
        totalResults: entries.length,
        hasResults: entries.length > 0,
        isSearching: false,
        searchMethod: 'none' as const
      };
    }

    const hasEnhancedResults = searchResults.some(result => 
      result.matchedFields && !result.matchedFields.includes('fallback') && !result.matchedFields.includes('basic')
    );

    return {
      totalResults: searchResults.length,
      hasResults: searchResults.length > 0,
      isSearching: true,
      searchMethod: hasEnhancedResults ? 'enhanced' as const : 'basic' as const
    };
  }, [searchQuery, searchResults, entries.length]);

  return {
    searchResults,
    searchStats,
    isEnhancedSearchAvailable: true
  };
}
