import { z } from 'zod';

// Zod schema for spec manifests
export const ManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver compliant (x.y.z)'),
  type: z.enum(['spec', 'power']).default('spec'),
  description: z.string().optional(),
  deps: z
    .record(
      z
        .string()
        .regex(/^[a-z0-9-]+$/, 'Dependency name must be lowercase alphanumeric with hyphens'),
      z.string().regex(/^\d+\.\d+\.\d+$/, 'Dependency version must be exact semver'),
    )
    .default({}),
  files: z.array(z.string()).min(1, 'Files array cannot be empty'),
  hash: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/, 'Hash must be in format sha256:<64 hex chars>')
    .optional(),
  agent: z
    .object({
      purpose: z.string(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;
