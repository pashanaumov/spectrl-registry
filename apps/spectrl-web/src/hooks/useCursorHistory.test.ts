import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCursorHistory } from './useCursorHistory';

describe('useCursorHistory', () => {
  beforeEach(() => {
    // Clear session storage before each test
    sessionStorage.clear();
  });

  it('should initialise with empty history', () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    expect(result.current.history).toEqual([]);
    expect(result.current.hasPrevious).toBe(false);
  });

  it('should push cursor to history', async () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    act(() => {
      result.current.pushCursor('cursor1');
    });

    await waitFor(() => {
      expect(result.current.history).toEqual(['cursor1']);
    });
    expect(result.current.hasPrevious).toBe(true);
  });

  it('should push multiple cursors to history', async () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    act(() => {
      result.current.pushCursor('cursor1');
      result.current.pushCursor('cursor2');
      result.current.pushCursor('cursor3');
    });

    await waitFor(() => {
      expect(result.current.history).toEqual(['cursor1', 'cursor2', 'cursor3']);
    });
    expect(result.current.hasPrevious).toBe(true);
  });

  it('should not push duplicate consecutive cursors', async () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    act(() => {
      result.current.pushCursor('cursor1');
      result.current.pushCursor('cursor1');
      result.current.pushCursor('cursor2');
      result.current.pushCursor('cursor2');
    });

    await waitFor(() => {
      expect(result.current.history).toEqual(['cursor1', 'cursor2']);
    });
  });

  it('should not push empty cursor', () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    act(() => {
      result.current.pushCursor('');
    });

    expect(result.current.history).toEqual([]);
  });

  it('should pop cursor from history', async () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    act(() => {
      result.current.pushCursor('cursor1');
      result.current.pushCursor('cursor2');
    });

    await waitFor(() => {
      expect(result.current.history).toEqual(['cursor1', 'cursor2']);
    });

    let poppedCursor: string | undefined;
    act(() => {
      poppedCursor = result.current.popCursor();
    });

    expect(poppedCursor).toBe('cursor2');
    await waitFor(() => {
      expect(result.current.history).toEqual(['cursor1']);
    });
  });

  it('should return undefined when popping from empty history', () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    let poppedCursor: string | undefined;
    act(() => {
      poppedCursor = result.current.popCursor();
    });

    expect(poppedCursor).toBeUndefined();
    expect(result.current.history).toEqual([]);
  });

  it('should get current cursor without removing it', async () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    act(() => {
      result.current.pushCursor('cursor1');
      result.current.pushCursor('cursor2');
    });

    await waitFor(() => {
      expect(result.current.history).toEqual(['cursor1', 'cursor2']);
    });

    const currentCursor = result.current.getCurrentCursor();
    expect(currentCursor).toBe('cursor2');
    expect(result.current.history).toEqual(['cursor1', 'cursor2']);
  });

  it('should clear all history', async () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    act(() => {
      result.current.pushCursor('cursor1');
      result.current.pushCursor('cursor2');
    });

    act(() => {
      result.current.clearHistory();
    });

    await waitFor(() => {
      expect(result.current.history).toEqual([]);
    });
    expect(result.current.hasPrevious).toBe(false);
  });

  it('should persist history to session storage', async () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    act(() => {
      result.current.pushCursor('cursor1');
      result.current.pushCursor('cursor2');
    });

    await waitFor(() => {
      const stored = sessionStorage.getItem('spectrl:cursor-history:test-query');
      expect(stored).toBe(JSON.stringify(['cursor1', 'cursor2']));
    });
  });

  it('should load history from session storage on mount', async () => {
    // Pre-populate session storage
    sessionStorage.setItem(
      'spectrl:cursor-history:test-query',
      JSON.stringify(['cursor1', 'cursor2']),
    );

    const { result } = renderHook(() => useCursorHistory('test-query'));

    await waitFor(() => {
      expect(result.current.history).toEqual(['cursor1', 'cursor2']);
    });
  });

  it('should use separate storage keys for different queries', async () => {
    const { result: result1 } = renderHook(() => useCursorHistory('query1'));
    const { result: result2 } = renderHook(() => useCursorHistory('query2'));

    act(() => {
      result1.current.pushCursor('cursor1');
      result2.current.pushCursor('cursor2');
    });

    await waitFor(() => {
      expect(result1.current.history).toEqual(['cursor1']);
      expect(result2.current.history).toEqual(['cursor2']);
    });
  });

  it('should handle corrupted session storage data gracefully', () => {
    // Store invalid JSON
    sessionStorage.setItem('spectrl:cursor-history:test-query', 'invalid-json');

    const { result } = renderHook(() => useCursorHistory('test-query'));

    // Should initialise with empty history
    expect(result.current.history).toEqual([]);
  });

  it('should remove storage key when history is cleared', async () => {
    const { result } = renderHook(() => useCursorHistory('test-query'));

    act(() => {
      result.current.pushCursor('cursor1');
    });

    act(() => {
      result.current.clearHistory();
    });

    await waitFor(() => {
      const stored = sessionStorage.getItem('spectrl:cursor-history:test-query');
      expect(stored).toBeNull();
    });
  });
});
