import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SpecDetail } from '@/components/specs/spec-detail';
import { getSpec, getSpecFile, isNotFoundError } from '@/lib/api-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; spec: string }>;
}) {
  const { username, spec: specName } = await params;

  try {
    const specData = await getSpec(username, specName);
    const latestVersion = specData.versions[0];
    return {
      title: `${specData.username}/${specData.specName}`,
      description: latestVersion?.description ?? '',
    };
  } catch {
    return { title: 'Spec Not Found - spectrl' };
  }
}

export default async function SpecDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; spec: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { username, spec: specName } = await params;
  const { v: versionParam } = await searchParams;

  let specData: Awaited<ReturnType<typeof getSpec>>;
  try {
    specData = await getSpec(username, specName);
  } catch (error) {
    if (isNotFoundError(error)) {
      notFound();
    }
    throw error;
  }

  if (specData.versions.length === 0) {
    notFound();
  }

  // Find requested version or default to latest
  const currentVersion = versionParam
    ? (specData.versions.find((v) => v.version === versionParam) ?? specData.versions[0])
    : specData.versions[0];

  // Fetch initial file content (first file)
  let initialFileContent = '';
  const firstFile = currentVersion.files[0];
  if (firstFile) {
    try {
      initialFileContent = await getSpecFile(currentVersion.s3Path, firstFile);
    } catch (error) {
      console.error('Failed to fetch initial file content:', error);
      initialFileContent = '';
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
          <SpecDetail
            spec={specData}
            currentVersion={currentVersion}
            initialFileContent={initialFileContent}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
