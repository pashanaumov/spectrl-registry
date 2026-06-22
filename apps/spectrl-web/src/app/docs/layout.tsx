import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { DocsSidebar } from '@/components/docs/docs-sidebar';
import { getDocsList } from '@/lib/docs';

export const metadata = {
  title: 'Documentation - spectrl',
  description: 'Learn how to use spectrl to manage structured specifications.',
};

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = await getDocsList();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-10 px-6 py-12 md:py-16">
        <aside className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-20">
            <DocsSidebar docs={docs} />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
