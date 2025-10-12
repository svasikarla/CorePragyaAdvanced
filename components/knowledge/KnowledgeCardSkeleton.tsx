import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";

// Skeleton component for loading states
export function Skeleton({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 ${className}`}
      {...props}
    />
  );
}

// Knowledge card skeleton for loading states
export function KnowledgeCardSkeleton() {
  return (
    <Card className="overflow-hidden flex flex-col h-full border-l-4 border-gray-200 bg-gradient-to-br from-white to-gray-50">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            {/* Title skeleton */}
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="ml-2">
            {/* Delete button skeleton */}
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
        
        {/* Category and type badges skeleton */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </CardHeader>
      
      <CardContent className="p-5 pt-2 flex-grow">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          {/* Summary skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-5 pt-2">
        <div className="w-full">
          <div className="flex items-center justify-between">
            {/* Date skeleton */}
            <Skeleton className="h-3 w-20" />
            {/* Read more button skeleton */}
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

// Grid of skeleton cards
interface KnowledgeGridSkeletonProps {
  count?: number;
}

export function KnowledgeGridSkeleton({ count = 6 }: KnowledgeGridSkeletonProps) {
  return (
    <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <KnowledgeCardSkeleton key={index} />
      ))}
    </div>
  );
}

// Search bar skeleton
export function SearchBarSkeleton() {
  return (
    <div className="relative w-full lg:w-80">
      <Skeleton className="h-11 w-full rounded-md" />
    </div>
  );
}

// Filter buttons skeleton
export function FilterButtonsSkeleton() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
      <Skeleton className="h-11 w-16 rounded-md" />
      <Skeleton className="h-11 w-20 rounded-md" />
      <Skeleton className="h-11 w-18 rounded-md" />
    </div>
  );
}

// Complete search and filters skeleton
export function SearchAndFiltersSkeleton() {
  return (
    <div className="mb-4 space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchBarSkeleton />
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <FilterButtonsSkeleton />
          
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Skeleton className="h-11 w-24 rounded-md" />
            <Skeleton className="h-11 w-28 rounded-md" />
          </div>
        </div>
      </div>
      
      {/* Category filters skeleton */}
      <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Skeleton className="h-11 w-24 rounded-full" />
          <Skeleton className="h-11 w-20 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
          <Skeleton className="h-11 w-22 rounded-full" />
        </div>
      </div>
    </div>
  );
}
