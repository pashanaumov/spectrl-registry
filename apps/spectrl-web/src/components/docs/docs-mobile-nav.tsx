'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocMeta } from '@/lib/docs';

interface DocsMobileNavProps {
  docs: DocMeta[];
}

export function DocsMobileNav({ docs }: DocsMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = docs.find((d) => pathname === `/docs/${d.slug}`);

  return (
    <div className="mb-6 md:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm"
      >
        <span>{current?.title ?? 'Documentation'}</span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-1 flex flex-col rounded-md border bg-card p-1">
          {docs.map((doc) => {
            const href = `/docs/${doc.slug}`;
            const isActive = pathname === href;
            return (
              <Link
                key={doc.slug}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {doc.title}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
