import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SpecDetail } from './spec-detail';
import type { GetSpecResponse, SpecVersion } from '@/lib/schemas';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

// Mock SpecMarkdown to avoid markdown rendering complexity
vi.mock('@/components/specs/spec-markdown', () => ({
  SpecMarkdown: ({ content }: { content: string }) => <div>{content}</div>,
}));

// Mock env
vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_CDN_URL: 'https://cdn.test.com', NEXT_PUBLIC_API_URL: 'https://api.test.com' },
}));

const specVersion: SpecVersion = {
  version: '1.0.0',
  description: 'A test spec',
  type: 'spec',
  tags: ['test'],
  publishedAt: '2024-01-01T00:00:00Z',
  s3Path: 'specs/user/my-spec/1.0.0',
  hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
  files: ['index.md'],
};

const specResponse: GetSpecResponse = {
  specId: 'user/my-spec',
  username: 'user',
  specName: 'my-spec',
  versions: [specVersion],
};

describe('SpecDetail', () => {
  it('renders type badge with "spec" for spec type', () => {
    render(
      <SpecDetail spec={specResponse} currentVersion={specVersion} initialFileContent="# Hello" />,
    );
    expect(screen.getByText('spec')).toBeDefined();
  });

  it('renders type badge with "power" for power type', () => {
    const powerVersion = { ...specVersion, type: 'power' as const };
    render(
      <SpecDetail spec={specResponse} currentVersion={powerVersion} initialFileContent="# Hello" />,
    );
    expect(screen.getByText('power')).toBeDefined();
  });

  it('renders the spec name in the header', () => {
    render(
      <SpecDetail spec={specResponse} currentVersion={specVersion} initialFileContent="# Hello" />,
    );
    expect(screen.getByText('user/my-spec')).toBeDefined();
  });
});

describe('SpecDetail - Dependencies section', () => {
  it('renders Dependencies section when currentVersion.deps has entries', () => {
    const versionWithDeps: SpecVersion = {
      ...specVersion,
      deps: {
        'shared-errors': '1.0.0',
      },
    };

    render(
      <SpecDetail
        spec={specResponse}
        currentVersion={versionWithDeps}
        initialFileContent="# Hello"
      />,
    );

    // Check for Dependencies heading
    expect(screen.getByText('Dependencies')).toBeDefined();

    // Check for dependency name
    expect(screen.getByText('shared-errors')).toBeDefined();

    // Check for version
    expect(screen.getByText('@1.0.0')).toBeDefined();
  });

  it('renders multiple dependencies correctly', () => {
    const versionWithMultipleDeps: SpecVersion = {
      ...specVersion,
      deps: {
        'shared-errors': '1.0.0',
        'base-types': '2.0.0',
        'api-contracts': '3.5.1',
      },
    };

    render(
      <SpecDetail
        spec={specResponse}
        currentVersion={versionWithMultipleDeps}
        initialFileContent="# Hello"
      />,
    );

    // Check for Dependencies heading
    expect(screen.getByText('Dependencies')).toBeDefined();

    // Check for all dependency names
    expect(screen.getByText('shared-errors')).toBeDefined();
    expect(screen.getByText('base-types')).toBeDefined();
    expect(screen.getByText('api-contracts')).toBeDefined();

    // Check for all versions
    expect(screen.getByText('@1.0.0')).toBeDefined();
    expect(screen.getByText('@2.0.0')).toBeDefined();
    expect(screen.getByText('@3.5.1')).toBeDefined();
  });

  it('does not render Dependencies section when deps is empty object', () => {
    const versionWithEmptyDeps: SpecVersion = {
      ...specVersion,
      deps: {},
    };

    render(
      <SpecDetail
        spec={specResponse}
        currentVersion={versionWithEmptyDeps}
        initialFileContent="# Hello"
      />,
    );

    // Dependencies heading should not be present
    expect(screen.queryByText('Dependencies')).toBeNull();
  });

  it('does not render Dependencies section when deps is undefined', () => {
    const versionWithoutDeps: SpecVersion = {
      ...specVersion,
      // deps field is absent
    };

    render(
      <SpecDetail
        spec={specResponse}
        currentVersion={versionWithoutDeps}
        initialFileContent="# Hello"
      />,
    );

    // Dependencies heading should not be present
    expect(screen.queryByText('Dependencies')).toBeNull();
  });

  it('links each dependency name to search URL with encoded query parameter', () => {
    const versionWithDeps: SpecVersion = {
      ...specVersion,
      deps: {
        'shared-errors': '1.0.0',
        'base-types': '2.0.0',
      },
    };

    const { container } = render(
      <SpecDetail
        spec={specResponse}
        currentVersion={versionWithDeps}
        initialFileContent="# Hello"
      />,
    );

    // Find links by their href attribute
    const sharedErrorsLink = container.querySelector(
      `a[href="/specs?q=${encodeURIComponent('shared-errors')}"]`,
    );
    const baseTypesLink = container.querySelector(
      `a[href="/specs?q=${encodeURIComponent('base-types')}"]`,
    );

    expect(sharedErrorsLink).toBeDefined();
    expect(baseTypesLink).toBeDefined();

    // Verify link text content
    expect(sharedErrorsLink?.textContent).toBe('shared-errors');
    expect(baseTypesLink?.textContent).toBe('base-types');
  });

  it('correctly encodes dependency names with special characters in search URL', () => {
    const versionWithSpecialDeps: SpecVersion = {
      ...specVersion,
      deps: {
        '@scope/package': '1.0.0',
        'name-with-dash': '2.0.0',
      },
    };

    const { container } = render(
      <SpecDetail
        spec={specResponse}
        currentVersion={versionWithSpecialDeps}
        initialFileContent="# Hello"
      />,
    );

    // Find links with encoded special characters
    const scopedLink = container.querySelector(
      `a[href="/specs?q=${encodeURIComponent('@scope/package')}"]`,
    );
    const dashedLink = container.querySelector(
      `a[href="/specs?q=${encodeURIComponent('name-with-dash')}"]`,
    );

    expect(scopedLink).toBeDefined();
    expect(dashedLink).toBeDefined();
  });

  it('renders dependency list items with correct structure', () => {
    const versionWithDeps: SpecVersion = {
      ...specVersion,
      deps: {
        'shared-errors': '1.0.0',
      },
    };

    const { container } = render(
      <SpecDetail
        spec={specResponse}
        currentVersion={versionWithDeps}
        initialFileContent="# Hello"
      />,
    );

    // Find the list item
    const listItem = container.querySelector('li');
    expect(listItem).toBeDefined();

    // Check for font-mono class
    expect(listItem?.className).toContain('font-mono');

    // Check for link inside list item
    const link = listItem?.querySelector('a');
    expect(link).toBeDefined();

    // Check for version span inside list item
    const versionSpan = listItem?.querySelector('span');
    expect(versionSpan?.textContent).toBe('@1.0.0');
  });

  it('renders Dependencies heading with correct styling', () => {
    const versionWithDeps: SpecVersion = {
      ...specVersion,
      deps: {
        'shared-errors': '1.0.0',
      },
    };

    const { container } = render(
      <SpecDetail
        spec={specResponse}
        currentVersion={versionWithDeps}
        initialFileContent="# Hello"
      />,
    );

    // Find the Dependencies heading
    const heading = screen.getByText('Dependencies');
    expect(heading.tagName).toBe('H2');

    // Check for expected classes
    const headingElement = container.querySelector('h2');
    expect(headingElement?.className).toContain('text-sm');
    expect(headingElement?.className).toContain('font-medium');
  });
});
