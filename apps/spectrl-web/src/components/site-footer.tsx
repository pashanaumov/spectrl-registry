import Link from 'next/link';
import { SpectrlLogo } from '@/components/spectrl-logo';

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-12 md:flex-row md:items-center">
        <div className="flex flex-col gap-3">
          <SpectrlLogo />
          <p className="text-sm text-muted-foreground">Structured specs, shipped like packages.</p>
        </div>
        <div className="flex gap-12 text-sm">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">Product</span>
            <Link
              href="/specs"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Browse Specs
            </Link>
            <Link
              href="/docs"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Documentation
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">Resources</span>
            <Link
              href="/docs/cli-reference"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              CLI Reference
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
