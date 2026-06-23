import { Firestore } from '@google-cloud/firestore';
import type { SpecVersion } from '../get-spec/schemas/response';
import type { SpecMetadata } from '../publish-spec/schemas/dynamodb';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

export async function getSpecVersions(specId: string): Promise<SpecVersion[]> {
  const snapshot = await db
    .collection('specs')
    .where('specId', '==', specId)
    .orderBy('createdAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => doc.data() as SpecVersion);
}

// Encode specId+version into a safe Firestore document ID (no slashes)
function docId(specId: string, version: string): string {
  return `${specId.replace('/', '__')}__${version}`;
}

export async function storeSpecMetadata(metadata: SpecMetadata): Promise<void> {
  await db.collection('specs').doc(docId(metadata.specId, metadata.version)).set(metadata);
}

export async function checkSpecExists(specId: string, version: string): Promise<boolean> {
  const doc = await db.collection('specs').doc(docId(specId, version)).get();
  return doc.exists;
}

export async function deleteSpecMetadata(specId: string, version: string): Promise<void> {
  await db.collection('specs').doc(docId(specId, version)).delete();
}

export async function incrementDownloadCount(specId: string, version: string): Promise<number> {
  const ref = db.collection('specs').doc(docId(specId, version));
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new Error(`Spec version not found: ${specId}@${version}`);
    const newCount = ((doc.data()?.downloads ?? 0) as number) + 1;
    tx.update(ref, { downloads: newCount });
    return newCount;
  });
}

export async function storeUser(user: {
  githubId: number;
  username: string;
  email: string;
}): Promise<void> {
  await db.collection('users').doc(String(user.githubId)).set(user);
}

export async function searchSpecs(params: {
  query: string;
  limit?: number;
  nextToken?: string;
  type?: string;
}): Promise<{ results: any[]; count: number; nextToken?: string; hasMore: boolean }> {
  const { query, limit = 20, nextToken, type } = params;

  const snapshot = await db.collection('specs').get();

  // Deduplicate by specId, keeping newest
  const bySpecId = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const existing = bySpecId.get(data.specId);
    if (!existing || data.createdAt > existing.createdAt) {
      bySpecId.set(data.specId, { ...data, _path: doc.ref.path });
    }
  }

  let results = Array.from(bySpecId.values());

  // Filter by query
  const q = query.toLowerCase();
  if (q) {
    results = results.filter(
      (d) =>
        d.specName?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags?.some((t: string) => t.toLowerCase().includes(q)),
    );
  }

  // Filter by type
  if (type) {
    results = results.filter((d) => d.type === type);
  }

  // Cursor pagination by _path (base64 encoded)
  let startIndex = 0;
  if (nextToken) {
    const cursor = Buffer.from(nextToken, 'base64').toString('utf8');
    const idx = results.findIndex((d) => d._path === cursor);
    if (idx !== -1) startIndex = idx + 1;
  }

  const page = results.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < results.length;
  const nextCursor = hasMore
    ? Buffer.from(results[startIndex + limit - 1]._path).toString('base64')
    : undefined;

  return {
    results: page.map(({ _path, createdAt, ...d }) => ({ ...d, publishedAt: createdAt })),
    count: results.length,
    nextToken: nextCursor,
    hasMore,
  };
}
