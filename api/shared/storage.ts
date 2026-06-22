import { Storage } from '@google-cloud/storage';

const storage = new Storage();

export async function uploadToStorage(params: {
  bucket: string;
  key: string;
  content: string;
}): Promise<void> {
  await storage.bucket(params.bucket).file(params.key).save(params.content);
}

export async function deleteSpecFromStorage(
  bucket: string,
  username: string,
  specName: string,
  version: string,
): Promise<void> {
  const prefix = `specs/${username}/${specName}/${version}/`;
  const [files] = await storage.bucket(bucket).getFiles({ prefix });
  await Promise.all(files.map((f) => f.delete()));
}
