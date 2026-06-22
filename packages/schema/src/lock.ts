import { z } from 'zod';

// Zod schema for a single lock entry
export const LockEntrySchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver compliant (x.y.z)'),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/, 'Hash must be in format sha256:<64 hex chars>'),
  source: z.string().url('Source must be a valid URL'),
  deps: z.array(
    z.string().regex(/^[a-z0-9-]+@\d+\.\d+\.\d+$/, 'Dependency must be in format name@version'),
  ),
});

// Zod schema for the complete lock file
export const LockFileSchema = z.object({
  createdAt: z.string().datetime('createdAt must be ISO-8601 format'),
  entries: z.array(LockEntrySchema),
});

export type LockEntry = z.infer<typeof LockEntrySchema>;
export type LockFile = z.infer<typeof LockFileSchema>;
