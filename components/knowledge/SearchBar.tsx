import React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onDebouncedSearchChange: (query: string) => void;
}

export const SearchBar = React.memo(function SearchBar({
  searchQuery,
  onSearchChange,
  onClearSearch,
  onDebouncedSearchChange
}: SearchBarProps) {
  return (
    <div className="relative w-full lg:w-80">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        placeholder="Search your knowledge base..."
        className="pl-9 h-11 bg-white border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-all duration-300 focus:shadow-lg focus:scale-[1.02]"
        value={searchQuery}
        onChange={(e) => {
          onSearchChange(e.target.value);
          // Auto-trigger search with debouncing
          onDebouncedSearchChange(e.target.value);
        }}
        aria-label="Search knowledge base entries"
        aria-describedby={searchQuery ? "search-clear-button" : undefined}
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] h-8 w-8 text-muted-foreground hover:text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 hover:scale-110"
          onClick={onClearSearch}
          aria-label="Clear search"
          id="search-clear-button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
});
