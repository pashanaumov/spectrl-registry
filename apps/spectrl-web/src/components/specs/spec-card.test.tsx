import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SpecCard } from './spec-card';
import type { SearchResult } from '@/lib/schemas';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock CopyButton to avoid clipboard API issues in tests
vi.mock('@/components/copy-button', () => ({
  CopyButton: () => <button type="button">Copy</button>,
}));

const baseSpec: SearchResult = {
  specId: 'user/my-spec',
  version: '1.0.0',
  username: 'user',
  specName: 'my-spec',
  description: 'A test spec',
  type: 'spec',
  tags: ['test'],
  publishedAt: '2024-01-01T00:00:00Z',
};

describe('SpecCard', () => {
  it('renders type badge with "spec" for spec type', () => {
    render(<SpecCard spec={baseSpec} />);
    expect(screen.getByText('spec')).toBeDefined();
  });

  it('renders type badge with "power" for power type', () => {
    render(<SpecCard spec={{ ...baseSpec, type: 'power' }} />);
    expect(screen.getByText('power')).toBeDefined();
  });

  it('renders the spec name and version', () => {
    render(<SpecCard spec={baseSpec} />);
    expect(screen.getByText('user/my-spec')).toBeDefined();
    expect(screen.getByText('v1.0.0')).toBeDefined();
  });

  it('renders the description', () => {
    render(<SpecCard spec={baseSpec} />);
    expect(screen.getByText('A test spec')).toBeDefined();
  });
});
