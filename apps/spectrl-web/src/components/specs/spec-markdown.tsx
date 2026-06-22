'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import yaml from 'js-yaml';
import { CopyButton } from '@/components/copy-button';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Parse YAML frontmatter from markdown content
 * Returns the frontmatter object and the content without frontmatter
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  content: string;
} {
  // Match YAML frontmatter: starts with ---, ends with ---, at beginning of file
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, content };
  }

  const frontmatterText = match[1];
  const contentWithoutFrontmatter = content.slice(match[0].length);

  try {
    // Parse YAML using js-yaml
    const parsed = yaml.load(frontmatterText);
    const frontmatter =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    return { frontmatter, content: contentWithoutFrontmatter };
  } catch (error) {
    // If YAML parsing fails, return content without frontmatter
    console.error('Failed to parse YAML frontmatter:', error);
    return { frontmatter: null, content: contentWithoutFrontmatter };
  }
}

/**
 * Format frontmatter value for display
 */
function formatFrontmatterValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export function SpecMarkdown({ content }: { content: string }) {
  const { frontmatter, content: cleanContent } = parseFrontmatter(content);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);

  return (
    <>
      {frontmatter && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setIsMetadataOpen(!isMetadataOpen)}
            className="flex w-full items-center gap-2 rounded-md border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            {isMetadataOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Metadata
          </button>
          {isMetadataOpen && (
            <div className="mt-2 rounded-md border bg-muted/30 p-4 space-y-4">
              <dl className="grid gap-4">
                {Object.entries(frontmatter).map(([key, value]) => (
                  <div key={key} className="grid gap-1.5">
                    <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                      {key}
                    </dt>
                    <dd className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono bg-card rounded px-3 py-2 border">
                      {formatFrontmatterValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-10 mb-4 text-xl font-semibold text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-10 mb-4 text-lg font-semibold text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 mb-3 text-base font-semibold text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-6 mb-2 text-sm font-semibold text-foreground">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="my-3 text-sm text-muted-foreground leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 ml-6 list-disc space-y-1.5 text-sm text-muted-foreground leading-relaxed">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-6 list-decimal space-y-1.5 text-sm text-muted-foreground leading-relaxed">
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-medium text-foreground">{children}</strong>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="rounded border bg-card px-1.5 py-0.5 font-mono text-xs text-foreground"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            const lang = className?.replace('language-', '') ?? '';
            const code = String(children).replace(/\n$/, '');
            return (
              <div className="group relative my-4 overflow-hidden rounded-md border bg-card">
                {lang && (
                  <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
                    <span className="font-mono">{lang}</span>
                    <CopyButton value={code} />
                  </div>
                )}
                <pre className="overflow-x-auto p-4 text-sm leading-6">
                  <code className="font-mono text-foreground">{children}</code>
                </pre>
                {!lang && (
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <CopyButton value={code} />
                  </div>
                )}
              </div>
            );
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-medium text-foreground">{children}</th>
          ),
          td: ({ children }) => <td className="px-3 py-2 text-muted-foreground">{children}</td>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-muted pl-4 text-sm text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-border" />,
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </>
  );
}
