import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/copy-button';
import type { SearchResult } from '@/lib/schemas';

export function SpecCard({ spec }: { spec: SearchResult }) {
  const installCmd = `npx spectrl install ${spec.username}/${spec.specName}@${spec.version}`;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b px-1 py-5 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href={`/specs/${spec.username}/${spec.specName}`}
            className="font-mono text-sm font-medium text-foreground hover:underline underline-offset-4"
          >
            {spec.username}/{spec.specName}
          </Link>
          <span className="text-xs text-muted-foreground">
            v{spec.version} &middot; Published {formatDate(spec.publishedAt)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge
            variant={spec.type === 'power' ? 'default' : 'outline'}
            className="font-mono text-xs"
          >
            {spec.type}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            v{spec.version}
          </Badge>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{spec.description}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {spec.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="font-mono text-xs">
            {tag}
          </Badge>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between rounded-md border bg-card px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground truncate">
          <span className="text-accent mr-1 select-none">{'$'}</span>
          {installCmd}
        </span>
        <CopyButton value={installCmd} />
      </div>
    </div>
  );
}
