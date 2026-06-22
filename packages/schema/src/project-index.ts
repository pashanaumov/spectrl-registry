import { z } from 'zod';

// Exact "name@version" (MVP: plain semver only)
const RefKey = z.string().regex(/^[a-z0-9-]+@\d+\.\d+\.\d+$/, 'Key must be name@version');

// Allow local sources for MVP: file://, absolute, or relative paths
const Source = z.string().refine((s) => {
  // Reject empty strings
  if (s.length === 0) return false;
  // Permit file:// and file: URLs
  if (s.startsWith('file:')) return true;
  // Permit absolute POSIX paths (/...)
  if (s.startsWith('/')) return true;
  // Permit absolute Windows paths (C:\...)
  if (/^[a-zA-Z]:\\/.test(s)) return true;
  // Permit relative paths (./ or ../)
  if (s.startsWith('./') || s.startsWith('../')) return true;
  // Permit bare relative paths (no special prefix)
  // These are valid relative paths like "specs/my-spec" or "my-spec"
  return true;
}, 'Source must be a non-empty file URL or local path');

export const IndexEntrySchema = z.object({
  source: Source,
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/, 'Hash must be in format sha256:<64 hex chars>'),
});

export const IndexSchema = z.record(RefKey, IndexEntrySchema);

// Types
export type IndexEntry = z.infer<typeof IndexEntrySchema>;
export type Index = z.infer<typeof IndexSchema>;
