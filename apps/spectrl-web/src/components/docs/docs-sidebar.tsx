'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { DocMeta } from '@/lib/docs';

interface DocsSidebarProps {
  docs: DocMeta[];
}

export function DocsSidebar({ docs }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      <span className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Documentation
      </span>
      {docs.map((doc) => {
        const href = `/docs/${doc.slug}`;
        const isActive = pathname === href;
        return (
          <Link
            key={doc.slug}
            href={href}
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
    </nav>
  );
}
