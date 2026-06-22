import { CopyButton } from '@/components/copy-button';

const installCmd = 'npx spectrl install author/spec';

export function InstallCta() {
  return (
    <section className="border-t px-6 py-20 md:py-28">
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Start in seconds</h2>
        <div className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 font-mono text-sm">
          <div className="flex items-center gap-2">
            <span className="text-accent select-none">{'$'}</span>
            <span className="text-foreground">{installCmd}</span>
          </div>
          <CopyButton value={installCmd} />
        </div>
        <p className="text-sm text-muted-foreground">
          No setup needed. Works in any project, right away.
        </p>
      </div>
    </section>
  );
}
