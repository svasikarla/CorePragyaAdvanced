import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";

interface BulkActionsButtonProps {
  isBulkMode: boolean;
  onToggleBulkMode: () => void;
}

export function BulkActionsButton({ isBulkMode, onToggleBulkMode }: BulkActionsButtonProps) {
  return (
    <Button
      variant={isBulkMode ? "default" : "outline"}
      size="sm"
      onClick={onToggleBulkMode}
      className={`min-h-[44px] h-auto px-4 ${isBulkMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'hover:bg-indigo-50 border-indigo-200'} focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
      aria-label={`${isBulkMode ? 'Disable' : 'Enable'} bulk actions mode`}
      aria-pressed={isBulkMode}
    >
      <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
      Bulk Actions
    </Button>
  );
}
