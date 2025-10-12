import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SortDropdownProps {
  sortOrder: string;
  onSortOrderChange: (order: string) => void;
}

export function SortDropdown({ sortOrder, onSortOrderChange }: SortDropdownProps) {
  const getSortLabel = (order: string) => {
    switch (order) {
      case 'newest': return 'Newest';
      case 'oldest': return 'Oldest';
      case 'popular': return 'Popular';
      default: return 'Sort';
    }
  };

  const getSortDescription = (order: string) => {
    switch (order) {
      case 'newest': return 'newest first';
      case 'oldest': return 'oldest first';
      case 'popular': return 'most viewed';
      default: return 'sort order';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="min-h-[44px] h-auto px-4 border-indigo-200 hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label={`Sort by ${getSortDescription(sortOrder)}, click to change sort order`}
          aria-haspopup="menu"
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
          {getSortLabel(sortOrder)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36" role="menu" aria-label="Sort options">
        <DropdownMenuItem
          onClick={() => onSortOrderChange('newest')}
          role="menuitem"
          aria-selected={sortOrder === 'newest'}
        >
          Newest First
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSortOrderChange('oldest')}
          role="menuitem"
          aria-selected={sortOrder === 'oldest'}
        >
          Oldest First
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSortOrderChange('popular')}
          role="menuitem"
          aria-selected={sortOrder === 'popular'}
        >
          Most Viewed
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
