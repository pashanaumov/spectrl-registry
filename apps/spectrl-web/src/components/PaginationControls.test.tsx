import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { PaginationControls } from './PaginationControls';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the cursor history hook
const mockPushCursor = vi.fn();
const mockPopCursor = vi.fn();
const mockGetCurrentCursor = vi.fn(() => undefined);
const mockGetPreviousCursor = vi.fn();
const mockHasPrevious = vi.fn(() => false);

vi.mock('@/hooks/useCursorHistory', () => ({
  useCursorHistory: () => ({
    pushCursor: mockPushCursor,
    popCursor: mockPopCursor,
    getCurrentCursor: mockGetCurrentCursor,
    getPreviousCursor: mockGetPreviousCursor,
    hasPrevious: mockHasPrevious(),
  }),
}));

describe('PaginationControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('should render result count even when there is no pagination', () => {
    render(
      <PaginationControls
        query=""
        currentNextToken={undefined}
        nextToken={undefined}
        hasMore={false}
        count={10}
      />,
    );

    // Should show the result count
    expect(screen.getByText('Showing 10 results')).toBeDefined();

    // But should not show navigation buttons
    expect(screen.queryByText('Previous')).toBeNull();
    expect(screen.queryByText('Next')).toBeNull();
  });

  it('should render Previous and Next buttons when pagination is available', () => {
    mockHasPrevious.mockReturnValue(true);

    render(
      <PaginationControls
        query="test"
        currentNextToken="cursor1"
        nextToken="cursor2"
        hasMore={true}
        count={20}
      />,
    );

    expect(screen.getByText('Previous')).toBeDefined();
    expect(screen.getByText('Next')).toBeDefined();
  });

  it('should display result count', () => {
    mockHasPrevious.mockReturnValue(true);

    render(
      <PaginationControls
        query="test"
        currentNextToken="cursor1"
        nextToken="cursor2"
        hasMore={true}
        count={20}
      />,
    );

    expect(screen.getByText('Showing 20 results')).toBeDefined();
  });

  it('should display singular "result" when count is 1', () => {
    mockHasPrevious.mockReturnValue(true);

    render(
      <PaginationControls
        query="test"
        currentNextToken="cursor1"
        nextToken="cursor2"
        hasMore={true}
        count={1}
      />,
    );

    expect(screen.getByText('Showing 1 result')).toBeDefined();
  });

  it('should disable Previous button when there is no previous page', () => {
    mockHasPrevious.mockReturnValue(false);

    render(
      <PaginationControls
        query="test"
        currentNextToken={undefined}
        nextToken="cursor2"
        hasMore={true}
        count={20}
      />,
    );

    const previousButton = screen.getByText('Previous') as HTMLButtonElement;
    expect(previousButton.disabled).toBe(true);
  });

  it('should disable Next button when there is no next page', () => {
    mockHasPrevious.mockReturnValue(true);

    render(
      <PaginationControls
        query="test"
        currentNextToken="cursor1"
        nextToken={undefined}
        hasMore={false}
        count={20}
      />,
    );

    const nextButton = screen.getByText('Next') as HTMLButtonElement;
    expect(nextButton.disabled).toBe(true);
  });

  it('should have proper ARIA labels for accessibility', () => {
    mockHasPrevious.mockReturnValue(true);

    render(
      <PaginationControls
        query="test"
        currentNextToken="cursor1"
        nextToken="cursor2"
        hasMore={true}
        count={20}
      />,
    );

    expect(screen.getByLabelText('Go to previous page')).toBeDefined();
    expect(screen.getByLabelText('Go to next page')).toBeDefined();
  });

  it('should push current cursor to history on mount', async () => {
    render(
      <PaginationControls
        query="test"
        currentNextToken="cursor1"
        nextToken="cursor2"
        hasMore={true}
        count={20}
      />,
    );

    await waitFor(() => {
      expect(mockPushCursor).toHaveBeenCalledWith('cursor1');
    });
  });

  it('should not push cursor when currentNextToken is undefined', async () => {
    render(
      <PaginationControls
        query="test"
        currentNextToken={undefined}
        nextToken="cursor2"
        hasMore={true}
        count={20}
      />,
    );

    await waitFor(() => {
      expect(mockPushCursor).not.toHaveBeenCalled();
    });
  });

  it('should navigate to next page when Next button is clicked', async () => {
    const user = userEvent.setup();
    mockHasPrevious.mockReturnValue(false);

    render(
      <PaginationControls
        query="test"
        currentNextToken={undefined}
        nextToken="cursor2"
        hasMore={true}
        count={20}
      />,
    );

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/specs?q=test&next=cursor2');
    });
  });

  it('should navigate to previous page when Previous button is clicked', async () => {
    const user = userEvent.setup();
    mockHasPrevious.mockReturnValue(true);
    // Simulate navigation from Page 2 to Page 1 (undefined)
    mockGetPreviousCursor.mockReturnValue(undefined);

    render(
      <PaginationControls
        query="test"
        currentNextToken="cursor2"
        nextToken="cursor3"
        hasMore={true}
        count={20}
      />,
    );

    const previousButton = screen.getByText('Previous');
    await user.click(previousButton);

    await waitFor(() => {
      expect(mockGetPreviousCursor).toHaveBeenCalled();
      expect(mockPopCursor).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/specs?q=test');
    });
  });
});
