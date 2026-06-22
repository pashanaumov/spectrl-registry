export function createSpecPaths(username: string, specName: string, version: string) {
  const specId = `${username}/${specName}`;
  const s3Path = `specs/${username}/${specName}/${version}`;

  return {
    specId,
    s3Path,
    manifestKey: `${s3Path}/spectrl.json`,
    fileKey: (filePath: string) => `${s3Path}/files/${filePath}`,
  };
}
