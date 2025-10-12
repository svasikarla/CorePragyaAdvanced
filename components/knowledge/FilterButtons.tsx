import React from "react";
import { Button } from "@/components/ui/button";
import { Globe, Mail } from "lucide-react";

interface FilterButtonsProps {
  typeFilter: string;
  onTypeFilterChange: (filter: string) => void;
}

export const FilterButtons = React.memo(function FilterButtons({ typeFilter, onTypeFilterChange }: FilterButtonsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
      <Button
        variant={typeFilter === 'all' ? 'default' : 'outline'}
        size="sm"
        className={`min-h-[44px] h-auto px-4 ${typeFilter === 'all' ? 'bg-indigo-600 hover:bg-indigo-700' : 'hover:bg-indigo-50'} focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        onClick={() => onTypeFilterChange('all')}
        aria-label="Show all content types"
        aria-pressed={typeFilter === 'all'}
      >
        All
      </Button>
      <Button
        variant={typeFilter === 'url' ? 'default' : 'outline'}
        size="sm"
        className={`min-h-[44px] h-auto px-4 ${typeFilter === 'url' ? 'bg-indigo-600 hover:bg-indigo-700' : 'hover:bg-indigo-50'} focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        onClick={() => onTypeFilterChange('url')}
        aria-label="Filter by web content"
        aria-pressed={typeFilter === 'url'}
      >
        <Globe className="mr-1 h-3 w-3" aria-hidden="true" />
        Web
      </Button>
      <Button
        variant={typeFilter === 'email' ? 'default' : 'outline'}
        size="sm"
        className={`min-h-[44px] h-auto px-4 ${typeFilter === 'email' ? 'bg-indigo-600 hover:bg-indigo-700' : 'hover:bg-indigo-50'} focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        onClick={() => onTypeFilterChange('email')}
        aria-label="Filter by email content"
        aria-pressed={typeFilter === 'email'}
      >
        <Mail className="mr-1 h-3 w-3" aria-hidden="true" />
        Email
      </Button>
    </div>
  );
});
