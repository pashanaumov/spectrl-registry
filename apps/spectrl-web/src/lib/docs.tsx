import fs from 'node:fs';
import path from 'node:path';
import { compileMDX } from 'next-mdx-remote/rsc';
import { z } from 'zod';
import remarkGfm from 'remark-gfm';
import { CopyButton } from '@/components/copy-button';

// Frontmatter schema — validated with Zod before use
const FrontmatterSchema = z.object({
  title: z.string(),
  order: z.number(),
});

export interface DocMeta {
  slug: string;
  title: string;
  order: number;
}

const DOCS_DIR = path.join(process.cwd(), 'src/content/docs');

function slugFromFilename(filename: string): string {
  return filename.replace(/\.mdx$/, '');
}

// Styled MDX components
const mdxComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-12 mb-6 text-3xl font-bold tracking-tight text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-10 mb-4 text-xl font-semibold text-foreground border-b border-border pb-2">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-8 mb-3 text-base font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-3 text-sm text-muted-foreground leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-3 ml-6 list-disc space-y-1.5 text-sm text-muted-foreground leading-relaxed">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-3 ml-6 list-decimal space-y-1.5 text-sm text-muted-foreground leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-medium text-foreground">{children}</strong>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    if (!className) {
      return (
        <code className="rounded border bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">
          {children}
        </code>
      );
    }
    const lang = className.replace('language-', '');
    const code = String(children).replace(/\n$/, '');
    return (
      <div className="group relative my-4 overflow-hidden rounded-md border bg-card">
        {lang && (
          <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
            <span className="font-mono">{lang}</span>
            <CopyButton value={code} />
          </div>
        )}
        <pre className="overflow-x-auto p-4 text-sm leading-6">
          <code className="font-mono text-foreground">{children}</code>
        </pre>
        {!lang && (
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton value={code} />
          </div>
        )}
      </div>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
  tbody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  tr: ({ children }: { children?: React.ReactNode }) => <tr className="border-b">{children}</tr>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left font-medium text-foreground">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 text-muted-foreground">{children}</td>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-3 border-l-2 border-muted pl-4 text-sm text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
};

/** Read all MDX files from content/docs/, extract frontmatter, return sorted by order */
export async function getDocsList(): Promise<DocMeta[]> {
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.mdx'));
  const docs: DocMeta[] = [];

  for (const file of files) {
    const slug = slugFromFilename(file);
    const source = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');

    const { frontmatter } = await compileMDX<Record<string, unknown>>({
      source,
      options: { parseFrontmatter: true, mdxOptions: { remarkPlugins: [remarkGfm] } },
    });

    const parsed = FrontmatterSchema.safeParse(frontmatter);
    if (!parsed.success) {
      console.error(`Invalid frontmatter in ${file}:`, parsed.error.issues);
      continue;
    }

    docs.push({ slug, title: parsed.data.title, order: parsed.data.order });
  }

  return docs.sort((a, b) => a.order - b.order);
}

/** Read and compile a single MDX file by slug, returns null if not found */
export async function getDocBySlug(
  slug: string,
): Promise<{ meta: DocMeta; content: React.ReactElement } | null> {
  const filePath = path.join(DOCS_DIR, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const source = fs.readFileSync(filePath, 'utf-8');

  const { content, frontmatter } = await compileMDX<Record<string, unknown>>({
    source,
    components: mdxComponents,
    options: { parseFrontmatter: true, mdxOptions: { remarkPlugins: [remarkGfm] } },
  });

  const parsed = FrontmatterSchema.safeParse(frontmatter);
  if (!parsed.success) {
    console.error(`Invalid frontmatter in ${slug}.mdx:`, parsed.error.issues);
    return null;
  }

  return { meta: { slug, title: parsed.data.title, order: parsed.data.order }, content };
}
