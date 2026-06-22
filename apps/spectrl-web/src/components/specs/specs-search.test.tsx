import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SpecsSearch } from './specs-search';
import type { SearchResult } from '@/lib/schemas';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock CopyButton
vi.mock('@/components/copy-button', () => ({
  CopyButton: () => <button type="button">Copy</button>,
}));

// Mock PaginationControls
vi.mock('@/components/PaginationControls', () => ({
  PaginationControls: () => <div data-testid="pagination" />,
}));

const makeSpec = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  specId: 'user/my-spec',
  version: '1.0.0',
  username: 'user',
  specName: 'my-spec',
  description: 'A test spec',
  type: 'spec',
  tags: [],
  publishedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('SpecsSearch', () => {
  it('renders type filter tabs with All, Specs, and Powers options', () => {
    render(<SpecsSearch results={[]} count={0} query="" hasMore={false} />);

    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('Specs')).toBeDefined();
    expect(screen.getByText('Powers')).toBeDefined();
  });

  it('renders all three filter tab buttons', () => {
    render(<SpecsSearch results={[]} count={0} query="" hasMore={false} />);

    const buttons = screen.getAllByRole('button');
    const tabLabels = buttons.map((b) => b.textContent);
    expect(tabLabels).toContain('All');
    expect(tabLabels).toContain('Specs');
    expect(tabLabels).toContain('Powers');
  });

  it('renders spec cards for each result', () => {
    const results = [
      makeSpec({ specId: 'user/spec-a', specName: 'spec-a', type: 'spec' }),
      makeSpec({ specId: 'user/power-b', specName: 'power-b', type: 'power' }),
    ];

    render(<SpecsSearch results={results} count={2} query="" hasMore={false} />);

    expect(screen.getByText('user/spec-a')).toBeDefined();
    expect(screen.getByText('user/power-b')).toBeDefined();
  });

  it('shows empty state when no results', () => {
    render(<SpecsSearch results={[]} count={0} query="" hasMore={false} />);

    expect(screen.getByText('No specs found')).toBeDefined();
  });
});
