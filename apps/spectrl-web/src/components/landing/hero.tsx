import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Hero() {
  const version = process.env.NEXT_PUBLIC_CLI_VERSION || '0.1.0';

  return (
    <section className="flex flex-col items-center px-6 pt-24 pb-20 text-center md:pt-32 md:pb-28">
      <div className="mb-6 inline-flex items-center rounded-full border px-3 py-1 text-xs font-mono text-muted-foreground">
        v{version}
      </div>
      <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
        Structured specs, <span className="text-muted-foreground">shipped like packages.</span>
      </h1>
      <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
        A CLI and open registry for PRDs, TDDs, ADRs, and API contracts. Create, version, publish,
        and install specs from the terminal.
      </p>
      <div className="mt-10 flex items-center gap-4">
        <Button asChild size="lg">
          <Link href="/docs/getting-started">
            Get Started
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/specs">Browse Specs</Link>
        </Button>
      </div>
    </section>
  );
}
