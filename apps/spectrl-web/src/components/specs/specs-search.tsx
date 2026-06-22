'use client';

import { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SpecCard } from '@/components/specs/spec-card';
import { PaginationControls } from '@/components/PaginationControls';
import { cn } from '@/lib/utils';
import type { SearchResult } from '@/lib/schemas';

const typeOptions = ['all', 'spec', 'power'] as const;
type TypeFilter = (typeof typeOptions)[number];

interface SpecsSearchProps {
  results: SearchResult[];
  count: number;
  query: string;
  currentNextToken?: string;
  nextToken?: string;
  hasMore: boolean;
  type?: string;
}

export function SpecsSearch({
  results,
  count,
  query,
  currentNextToken,
  nextToken,
  hasMore,
  type: typeProp,
}: SpecsSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultQuery = searchParams.get('q') || '';
  // Use prop as source of truth (set by server), fall back to searchParams for client nav
  const currentType = ((typeProp ?? searchParams.get('type')) as TypeFilter) || 'all';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get('q') as string)?.trim() || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (currentType !== 'all') params.set('type', currentType);
    router.push(`/specs?${params.toString()}`);
  };

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    const params = new URLSearchParams();
    if (currentType !== 'all') params.set('type', currentType);
    router.push(`/specs?${params.toString()}`);
  };

  const handleTypeChange = (type: TypeFilter) => {
    const params = new URLSearchParams();
    if (defaultQuery) params.set('q', defaultQuery);
    if (type !== 'all') params.set('type', type);
    router.push(`/specs?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 rounded-md border bg-card p-1">
        {typeOptions.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-medium transition-colors',
              currentType === type
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {type === 'all' ? 'All' : type === 'spec' ? 'Specs' : 'Powers'}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          name="q"
          type="search"
          placeholder="Search specs by name, author, or tag..."
          defaultValue={defaultQuery}
          autoFocus={!!query}
          className="pl-9 pr-9 font-mono text-sm"
        />
        {defaultQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </form>

      {results && results.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No specs found</p>
          <p className="text-sm text-muted-foreground">
            {query
              ? 'Try a different search term or browse all specs.'
              : 'No specs have been published yet.'}
          </p>
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="mt-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex flex-col">
            {results.map((spec) => (
              <SpecCard key={spec.specId} spec={spec} />
            ))}
          </div>
          <PaginationControls
            query={query}
            currentNextToken={currentNextToken}
            nextToken={nextToken}
            hasMore={hasMore}
            count={count}
            type={currentType !== 'all' ? currentType : undefined}
          />
        </div>
      )}
    </div>
  );
}
