import React from 'react';

interface EnhancedHighlightedTextProps {
  text: string;
  searchQuery: string;
  className?: string;
}

export function EnhancedHighlightedText({ 
  text, 
  searchQuery, 
  className = "" 
}: EnhancedHighlightedTextProps) {
  if (!searchQuery || !text) {
    return <span className={className}>{text}</span>;
  }

  // Create a more sophisticated highlighting that handles partial matches
  const highlightText = (text: string, query: string) => {
    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create regex for whole word and partial matches
    const wholeWordRegex = new RegExp(`\\b(${escapedQuery})\\b`, 'gi');
    const partialRegex = new RegExp(`(${escapedQuery})`, 'gi');
    
    // First try whole word matches (higher priority)
    let highlightedText = text;
    const wholeWordMatches = text.match(wholeWordRegex);
    
    if (wholeWordMatches) {
      // Highlight whole word matches with stronger styling
      highlightedText = text.replace(wholeWordRegex, (match) => 
        `<mark class="bg-yellow-300 text-yellow-900 px-1 rounded font-medium">${match}</mark>`
      );
    } else {
      // Fall back to partial matches with lighter styling
      highlightedText = text.replace(partialRegex, (match) => 
        `<mark class="bg-yellow-200 text-yellow-800 px-0.5 rounded">${match}</mark>`
      );
    }
    
    return highlightedText;
  };

  const highlightedContent = highlightText(text, searchQuery);

  return (
    <span 
      className={className}
      dangerouslySetInnerHTML={{ __html: highlightedContent }}
    />
  );
}

// Alternative component for safer highlighting without dangerouslySetInnerHTML
export function SafeHighlightedText({ 
  text, 
  searchQuery, 
  className = "" 
}: EnhancedHighlightedTextProps) {
  if (!searchQuery || !text) {
    return <span className={className}>{text}</span>;
  }

  // Escape special regex characters
  const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = regex.test(part);
        regex.lastIndex = 0; // Reset regex state
        
        return isMatch ? (
          <mark 
            key={index} 
            className="bg-yellow-200 text-yellow-900 px-1 rounded transition-colors"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </span>
  );
}

// Search result summary component
interface SearchResultSummaryProps {
  totalResults: number;
  searchQuery: string;
  searchMethod: 'none' | 'basic' | 'enhanced';
  className?: string;
}

export function SearchResultSummary({ 
  totalResults, 
  searchQuery, 
  searchMethod,
  className = ""
}: SearchResultSummaryProps) {
  if (!searchQuery.trim()) {
    return null;
  }

  const getSearchMethodLabel = () => {
    switch (searchMethod) {
      case 'enhanced':
        return 'Smart search';
      case 'basic':
        return 'Basic search';
      default:
        return 'Search';
    }
  };

  const getResultText = () => {
    if (totalResults === 0) {
      return 'No results found';
    }
    if (totalResults === 1) {
      return '1 result found';
    }
    return `${totalResults} results found`;
  };

  return (
    <div className={`text-sm text-gray-600 mb-4 ${className}`}>
      <span className="font-medium">{getResultText()}</span>
      {searchQuery && (
        <>
          <span className="mx-2">for</span>
          <span className="font-medium text-indigo-700">"{searchQuery}"</span>
        </>
      )}
      {searchMethod !== 'none' && (
        <span className="ml-2 text-xs text-gray-500">
          ({getSearchMethodLabel()})
        </span>
      )}
    </div>
  );
}
