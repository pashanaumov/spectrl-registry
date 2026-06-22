'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCursorHistory } from '@/hooks/useCursorHistory';

interface PaginationControlsProps {
  query: string;
  currentNextToken?: string;
  nextToken?: string;
  hasMore: boolean;
  count: number;
  type?: string;
}

/**
 * Client-side pagination controls with cursor history management
 *
 * This component handles:
 * - Tracking cursor history for Previous button navigation
 * - Building URLs for Next/Previous navigation
 * - Clearing history when search query changes (handled by hook's query scoping)
 * - Browser back/forward navigation (syncs with URL state)
 * - Loading states during navigation
 * - Result count display
 */
export function PaginationControls({
  query,
  currentNextToken,
  nextToken,
  hasMore,
  count,
  type,
}: PaginationControlsProps) {
  const router = useRouter();
  const { pushCursor, popCursor, hasPrevious, getCurrentCursor, getPreviousCursor } =
    useCursorHistory(query);
  const previousTokenRef = useRef<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const [navigationDirection, setNavigationDirection] = useState<'previous' | 'next' | null>(null);

  // Track the current cursor when we navigate forward
  // Only push if we actually have a cursor (not on the first page)
  useEffect(() => {
    // Check if we're navigating forward (new token) or backward (browser back)
    const isNavigatingForward = currentNextToken && currentNextToken !== previousTokenRef.current;
    const isNavigatingBackward = !currentNextToken && previousTokenRef.current;

    if (isNavigatingForward) {
      // Only push if this is a new cursor we haven't seen
      const currentHistoryCursor = getCurrentCursor();
      if (currentNextToken !== currentHistoryCursor) {
        pushCursor(currentNextToken);
      }
    } else if (isNavigatingBackward) {
      // User navigated back (browser back button or our Previous button)
      // Pop the cursor from history to stay in sync
      popCursor();
    }

    // Update the ref for next comparison
    previousTokenRef.current = currentNextToken;
  }, [currentNextToken, pushCursor, popCursor, getCurrentCursor]);

  const handlePrevious = () => {
    setNavigationDirection('previous');

    startTransition(() => {
      // Get the previous cursor to navigate to (peek at history)
      const previousCursor = getPreviousCursor();

      // Pop the current cursor from history
      popCursor();

      // Build the URL for the previous page
      const params = new URLSearchParams();
      if (query) {
        params.set('q', query);
      }
      if (type) {
        params.set('type', type);
      }
      if (previousCursor) {
        params.set('next', previousCursor);
      }

      const url = params.toString() ? `/specs?${params.toString()}` : '/specs';
      router.push(url);

      // Reset navigation direction after transition
      setNavigationDirection(null);
    });
  };

  const handleNext = () => {
    if (!nextToken) {
      return;
    }

    setNavigationDirection('next');

    startTransition(() => {
      // Build the URL for the next page
      const params = new URLSearchParams();
      if (query) {
        params.set('q', query);
      }
      if (type) {
        params.set('type', type);
      }
      params.set('next', nextToken);

      router.push(`/specs?${params.toString()}`);

      // Reset navigation direction after transition
      setNavigationDirection(null);
    });
  };

  const isNavigatingPrevious = isPending && navigationDirection === 'previous';
  const isNavigatingNext = isPending && navigationDirection === 'next';

  // Show pagination controls if there's navigation available OR if we want to show the count
  const showNavigation = hasPrevious || hasMore;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-border/50">
      {/* Result count */}
      <p className="text-sm text-muted-foreground">
        Showing {count} result{count === 1 ? '' : 's'}
      </p>

      {/* Navigation buttons - only show if there's somewhere to navigate */}
      {showNavigation && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={!hasPrevious || isPending}
            aria-label="Go to previous page"
            className="gap-1.5"
          >
            {isNavigatingPrevious ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={handleNext}
            disabled={!hasMore || isPending}
            aria-label="Go to next page"
            className="gap-1.5"
          >
            Next
            {isNavigatingNext ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
