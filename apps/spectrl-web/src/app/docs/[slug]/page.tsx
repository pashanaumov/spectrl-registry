import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDocBySlug, getDocsList } from '@/lib/docs';
import { DocsMobileNav } from '@/components/docs/docs-mobile-nav';

export async function generateStaticParams() {
  const docs = await getDocsList();
  return docs.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getDocBySlug(slug);
  if (!result) return { title: 'Not Found - spectrl' };
  return {
    title: `Docs - ${result.meta.title}`,
    description: `spectrl documentation: ${result.meta.title}`,
  };
}

export default async function DocSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [result, docs] = await Promise.all([getDocBySlug(slug), getDocsList()]);

  if (!result) {
    notFound();
  }

  return (
    <div>
      <DocsMobileNav docs={docs} />
      <article className="max-w-none">{result.content}</article>
    </div>
  );
}
