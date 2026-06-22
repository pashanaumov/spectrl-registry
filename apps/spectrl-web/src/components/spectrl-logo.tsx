import Link from 'next/link';
import { cn } from '@/lib/utils';

export function SpectrlLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center gap-0 font-mono text-lg', className)}>
      <span className="text-muted-foreground">{'$_'}</span>
      <span className="text-foreground font-semibold">spectrl</span>
    </Link>
  );
}
