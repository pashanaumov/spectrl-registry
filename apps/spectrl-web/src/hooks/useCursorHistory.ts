'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Custom hook for managing cursor-based pagination history using session storage
 *
 * This hook maintains a stack of cursor tokens to enable Previous/Next navigation
 * in cursor-based pagination. The history is stored in session storage and is
 * scoped per search query to maintain separate histories for different searches.
 *
 * @param query - Current search query (used to scope the history)
 * @returns Object with cursor history state and management functions
 */
export function useCursorHistory(query = '') {
  const [history, setHistory] = useState<string[]>([]);
  // Track if we have initialised from storage to prevent overwriting with empty state
  const isinitialised = useRef(false);

  // Storage key scoped by query to maintain separate histories
  const storageKey = `spectrl:cursor-history:${query}`;

  // initialise from session storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load cursor history from session storage:', error);
      // Clear corrupted data
      sessionStorage.removeItem(storageKey);
    } finally {
      isinitialised.current = true;
    }
  }, [storageKey]);

  // Persist to session storage whenever history changes
  useEffect(() => {
    // Don't save until we've initialised, otherwise we wipe existing data with []
    if (!isinitialised.current) {
      return;
    }

    try {
      if (history.length > 0) {
        sessionStorage.setItem(storageKey, JSON.stringify(history));
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error('Failed to save cursor history to session storage:', error);
    }
  }, [history, storageKey]);

  /**
   * Push a new cursor to the history stack
   * Called when navigating forward to the next page
   */
  const pushCursor = useCallback((cursor: string) => {
    if (!cursor) {
      return;
    }

    setHistory((prev) => {
      // Avoid duplicate consecutive cursors
      if (prev.length > 0 && prev[prev.length - 1] === cursor) {
        return prev;
      }
      return [...prev, cursor];
    });
  }, []);

  /**
   * Pop the last cursor from the history stack
   * Called when navigating backward to the previous page
   * Returns the cursor token or undefined if history is empty
   */
  const popCursor = useCallback((): string | undefined => {
    if (history.length === 0) {
      return undefined;
    }

    const poppedCursor = history[history.length - 1];

    setHistory((prev) => {
      if (prev.length === 0) {
        return prev;
      }

      const newHistory = [...prev];
      newHistory.pop();
      return newHistory;
    });

    return poppedCursor;
  }, [history]);

  /**
   * Clear all cursor history
   * Called when the search query changes or when starting a new search
   */
  const clearHistory = useCallback(() => {
    setHistory([]);

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(storageKey);
      } catch (error) {
        console.error('Failed to clear cursor history from session storage:', error);
      }
    }
  }, [storageKey]);

  /**
   * Get the current cursor (last item in history) without removing it
   */
  const getCurrentCursor = useCallback((): string | undefined => {
    return history.length > 0 ? history[history.length - 1] : undefined;
  }, [history]);

  /**
   * Get the cursor for the previous page (2nd to last item) without modifying history.
   * This is the target cursor when clicking "Previous".
   */
  const getPreviousCursor = useCallback((): string | undefined => {
    if (history.length < 2) {
      return undefined;
    }
    return history[history.length - 2];
  }, [history]);

  /**
   * Check if there's any previous page to navigate to
   */
  const hasPrevious = history.length > 0;

  return {
    history,
    pushCursor,
    popCursor,
    clearHistory,
    getCurrentCursor,
    getPreviousCursor,
    hasPrevious,
  };
}
