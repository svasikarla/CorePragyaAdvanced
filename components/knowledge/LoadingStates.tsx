import { RefreshCw, Loader2, Search } from "lucide-react";
import { KnowledgeGridSkeleton, SearchAndFiltersSkeleton } from "./KnowledgeCardSkeleton";

interface LoadingStatesProps {
  type: 'initial' | 'search' | 'refresh' | 'delete' | 'skeleton';
  message?: string;
  className?: string;
}

export function LoadingStates({ type, message, className = "" }: LoadingStatesProps) {
  switch (type) {
    case 'initial':
      return (
        <div className={`flex min-h-screen items-center justify-center ${className}`}>
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-gray-600">{message || "Loading your knowledge base..."}</p>
          </div>
        </div>
      );

    case 'search':
      return (
        <div className={`flex items-center justify-center py-12 ${className}`}>
          <div className="text-center space-y-4">
            <Search className="h-6 w-6 animate-pulse mx-auto text-indigo-600" />
            <p className="text-gray-600 text-sm">{message || "Searching..."}</p>
          </div>
        </div>
      );

    case 'refresh':
      return (
        <div className={`flex items-center justify-center py-8 ${className}`}>
          <div className="text-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
            <p className="text-gray-600 text-sm">{message || "Refreshing data..."}</p>
          </div>
        </div>
      );

    case 'delete':
      return (
        <div className={`flex items-center justify-center py-4 ${className}`}>
          <div className="text-center space-y-2">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-red-600" />
            <p className="text-gray-600 text-sm">{message || "Deleting..."}</p>
          </div>
        </div>
      );

    case 'skeleton':
      return (
        <div className={className}>
          <SearchAndFiltersSkeleton />
          <KnowledgeGridSkeleton count={6} />
        </div>
      );

    default:
      return (
        <div className={`flex items-center justify-center py-8 ${className}`}>
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      );
  }
}

// Inline loading spinner for buttons and small components
interface InlineLoadingProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function InlineLoading({ size = 'md', className = "" }: InlineLoadingProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
}

// Loading overlay for cards during operations
interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  children: React.ReactNode;
}

export function LoadingOverlay({ isVisible, message, children }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isVisible && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
          <div className="text-center space-y-2">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-indigo-600" />
            {message && (
              <p className="text-sm text-gray-600">{message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Search loading state with better UX
interface SearchLoadingProps {
  isSearching: boolean;
  hasQuery: boolean;
  resultCount: number;
}

export function SearchLoading({ isSearching, hasQuery, resultCount }: SearchLoadingProps) {
  if (!isSearching || !hasQuery) return null;

  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center space-x-2">
          <Search className="h-5 w-5 animate-pulse text-indigo-600" />
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">Searching your knowledge base...</p>
          <p className="text-xs text-gray-500">
            {resultCount > 0 ? `Found ${resultCount} results so far` : 'Looking for matches...'}
          </p>
        </div>
      </div>
    </div>
  );
}
