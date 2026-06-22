import { Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SpecsSearch } from '@/components/specs/specs-search';
import { searchSpecs } from '@/lib/api-client';
import type { SearchResponse } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Browse Specs & Powers',
  description: 'Search and install structured specs and powers published by developers.',
};

export default async function SpecsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; next?: string; type?: string }>;
}) {
  const { q, next, type } = await searchParams;
  const query = q || '';
  const nextToken = next || undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
          <div className="mb-8 flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Browse Specs & Powers
            </h1>
            <p className="text-sm text-muted-foreground">
              Specs and powers published by developers. Install anything with one command.
            </p>
          </div>
          <Suspense fallback={<SpecsLoading />}>
            <SpecsResults query={query} nextToken={nextToken} type={type} />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

async function SpecsResults({
  query,
  nextToken,
  type,
}: {
  query: string;
  nextToken?: string;
  type?: string;
}) {
  let data: SearchResponse;

  try {
    data = await searchSpecs(query || undefined, { nextToken, type });
  } catch (error) {
    console.error('Failed to fetch specs:', error);
    return <SpecsError />;
  }

  const hasMore = data.hasMore ?? !!data.nextToken;

  return (
    <SpecsSearch
      results={data.results}
      count={data.count}
      query={query}
      currentNextToken={nextToken}
      nextToken={data.nextToken}
      hasMore={hasMore}
      type={type}
    />
  );
}

function SpecsError() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-6 py-12 text-center">
      <AlertCircle className="size-6 text-destructive" />
      <p className="text-sm font-medium text-foreground">Error loading specs</p>
      <p className="text-sm text-muted-foreground">
        Something went wrong while fetching specs. Please try again.
      </p>
      <a
        href="/specs"
        className="mt-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Try again
      </a>
    </div>
  );
}

function SpecsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-9 animate-pulse rounded-md bg-muted" />
      <div className="flex flex-col">
        {['s1', 's2', 's3', 's4', 's5'].map((id) => (
          <div key={id} className="border-b px-1 py-5 last:border-b-0">
            <div className="flex flex-col gap-3">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="flex gap-1.5">
                <div className="h-5 w-12 animate-pulse rounded bg-muted" />
                <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
