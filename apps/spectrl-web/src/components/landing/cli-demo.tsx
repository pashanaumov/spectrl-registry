'use client';

import { useEffect, useState } from 'react';

const lines = [
  { prompt: true, text: 'npx spectrl install spectrl/api-design-standard' },
  { prompt: false, text: 'Resolving dependencies...' },
  { prompt: false, text: '+ spectrl/api-design-standard@2.1.0' },
  { prompt: false, text: '' },
  { prompt: true, text: 'npx spectrl publish' },
  { prompt: false, text: '? Where do you want to publish? Public registry (spectrl.pro)' },
  { prompt: false, text: '  sha256:a1b2c3d4e5f6' },
  { prompt: false, text: 'Published oxbow/microservice-tdd@3.0.1 to public registry' },
  { prompt: false, text: '' },
  { prompt: false, text: '  https://spectrl.pro/oxbow/microservice-tdd' },
];

export function CliDemo() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines < lines.length) {
      const delay = lines[visibleLines]?.prompt ? 600 : 150;
      const timer = setTimeout(() => {
        setVisibleLines((v) => v + 1);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [visibleLines]);

  return (
    <section className="px-6 pb-20 md:pb-28">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-border" />
              <div className="size-2.5 rounded-full bg-border" />
              <div className="size-2.5 rounded-full bg-border" />
            </div>
            <span className="ml-2 text-xs font-mono text-muted-foreground">terminal</span>
          </div>
          <div className="p-4 font-mono text-sm leading-6">
            {lines.slice(0, visibleLines).map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: it's ok
              <div key={i} className="flex">
                {line.prompt ? (
                  <>
                    <span className="text-accent mr-2 shrink-0 select-none">{'$'}</span>
                    <span className="text-foreground">{line.text}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground pl-4">{line.text}</span>
                )}
              </div>
            ))}
            {visibleLines < lines.length && (
              <span className="inline-block h-4 w-1.5 animate-pulse bg-foreground" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
