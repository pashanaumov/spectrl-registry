# Design Document

## Overview

Spectrl MVP implements a local-first spec registry with three core operations: `init`, `publish`, and `install`. The system is built as a TypeScript monorepo with three packages (`schema`, `core`, `cli`) that provide deterministic, offline-capable spec management with full transitive dependency resolution.

The design prioritizes:

- **Determinism**: Identical inputs produce identical outputs
- **Simplicity**: No catalogs, no ranges, no blob storage in MVP
- **Explicitness**: All transitive dependencies must be listed in project index
- **Testability**: All logic in `core`, thin CLI wrapper
- **Offline-first**: No network dependencies in MVP

## Architecture

### Package Structure

```
packages/
├── schema/          # Zod schemas + TypeScript types
│   └── src/
│       ├── manifest.ts      # Manifest schema
│       ├── index.ts         # Project index schema
│       ├── lock.ts          # Lock file schema
│       └── index.ts         # Re-exports
│
├── core/            # Registry operations + business logic
│   └── src/
│       ├── hasher.ts        # Content hashing (SHA-256)
│       ├── registry.ts      # File I/O for ~/.spectrl/registry
│       ├── resolver.ts      # Dependency resolution from index
│       ├── validator.ts     # Manifest validation
│       └── index.ts         # Public API
│
└── cli/             # Command-line interface
    └── src/
        ├── commands/
        │   ├── init.ts      # spectrl init
        │   ├── publish.ts   # spectrl publish
        │   └── install.ts   # spectrl install (resolve + materialize + lock)
        ├── cli.ts           # Entry point + arg parsing
        └── utils.ts         # Error formatting, exit codes
```

### Data Flow

```
┌─────────────────────┐
│  spectrl init       │ → Creates .spectrl/spectrl-index.json
└─────────────────────┘

┌─────────────────────┐
│  spectrl publish    │ → Reads spectrl.json
└──────┬──────────────┘   Computes SHA-256 hash
       │                  Writes to ~/.spectrl/registry/{name}/{version}/
       v
┌─────────────────────┐
│  ~/.spectrl/        │
│  registry/          │ (machine-wide, shared)
└─────────────────────┘

┌─────────────────────┐
│  spectrl install    │ → Reads .spectrl/spectrl-index.json
└──────┬──────────────┘   Resolves closure (BFS)
       │                  Computes hashes
       │                  Materializes to registry
       │                  Writes .spectrl/lock.json
       v
┌─────────────────────┐
│  .spectrl/lock.json │ (pinned closure with hashes)
└─────────────────────┘
```

## Components and Interfaces

### 1. Schema Package (`@spectrl/schema`)

Defines all data structures using Zod for runtime validation and TypeScript type inference.

#### Manifest Schema

```typescript
import { z } from 'zod';

export const ManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // exact semver
  deps: z
    .record(
      z.string().regex(/^[a-z0-9-]+$/), // dep name
      z.string().regex(/^\d+\.\d+\.\d+$/), // exact version
    )
    .default({}),
  files: z.array(z.string()).min(1),
  hash: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;
```

**Key decisions:**

- Name must be lowercase alphanumeric + hyphens (no scopes in MVP)
- Version must be exact semver (no ranges)
- Deps is an object map: `{ "dep-name": "1.0.0" }`
- Files array cannot be empty
- Hash is optional (computed during publish)

#### Project Index Schema

```typescript
export const ProjectIndexSchema = z.record(
  z.string().regex(/^[a-z0-9-]+@\d+\.\d+\.\d+$/), // key: name@version
  z.object({
    source: z.string().url(), // file:// URLs in MVP
  }),
);

export type ProjectIndex = z.infer<typeof ProjectIndexSchema>;
```

**Example:**

```json
{
  "core-spec@1.0.0": { "source": "file:./specs/core-spec/1.0.0" },
  "dep-a@0.5.0": { "source": "file:./specs/dep-a/0.5.0" }
}
```

#### Lock File Schema

```typescript
export const LockEntrySchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  source: z.string().url(),
  deps: z.array(z.string().regex(/^[a-z0-9-]+@\d+\.\d+\.\d+$/)),
});

export const LockFileSchema = z.object({
  createdAt: z.string().datetime(), // ISO-8601
  entries: z.array(LockEntrySchema),
});

export type LockEntry = z.infer<typeof LockEntrySchema>;
export type LockFile = z.infer<typeof LockFileSchema>;
```

**Example:**

```json
{
  "createdAt": "2025-11-07T13:40:00Z",
  "entries": [
    {
      "name": "core-spec",
      "version": "1.0.0",
      "hash": "sha256:abc123...",
      "source": "file:./specs/core-spec/1.0.0",
      "deps": ["dep-a@0.5.0"]
    },
    {
      "name": "dep-a",
      "version": "0.5.0",
      "hash": "sha256:def456...",
      "source": "file:./specs/dep-a/0.5.0",
      "deps": []
    }
  ]
}
```

### 2. Core Package (`@spectrl/core`)

Contains all business logic. CLI is a thin wrapper around these functions.

#### Hasher (`hasher.ts`)

Computes deterministic SHA-256 hashes.

```typescript
export interface HasherOptions {
  manifest: Manifest;
  fileContents: Record<string, string>; // path → content
}

/**
 * Computes content hash using SHA-256:
 * 1. Sort file paths lexicographically
 * 2. For each file: hash(path + normalized_content)
 * 3. Canonicalize manifest (sorted keys, no whitespace)
 * 4. Combine all hashes → single SHA-256 hex hash
 * 5. Return in format: sha256:<hex>
 */
export function computeHash(options: HasherOptions): string;
```

**Implementation notes:**

- Use Node.js `crypto` module for SHA-256 hashing
- Normalize line endings to `\n` before hashing
- Sort manifest keys alphabetically
- Remove all whitespace from canonicalized JSON
- Return format: `sha256:` + 64 hex characters

#### Registry (`registry.ts`)

Handles file I/O for `~/.spectrl/registry/` with simple directory structure.

```typescript
export interface RegistryPaths {
  root: string;                    // ~/.spectrl/registry
  spec(name: string, version: string): string;  // {root}/{name}/{version}
  files(name: string, version: string): string; // {spec}/files
  manifest(name: string, version: string): string; // {spec}/spectrl.json
}

export class Registry {
  constructor(private rootPath: string = '~/.spectrl/registry');

  /**
   * Writes a spec to the registry
   * - Creates directory structure
   * - Copies files preserving paths
   * - Writes manifest with computed hash
   */
  async publish(manifest: Manifest, sourcePath: string): Promise<void>;

  /**
   * Reads a manifest from the registry
   */
  async getManifest(name: string, version: string): Promise<Manifest>;

  /**
   * Checks if a spec exists in the registry
   */
  async exists(name: string, version: string): Promise<boolean>;

  /**
   * Returns standardized paths
   */
  paths: RegistryPaths;
}
```

**File layout:**

```
~/.spectrl/registry/
└── {name}/
    └── {version}/
        ├── spectrl.json       # manifest with hash
        └── files/
            └── {original/path/structure}
```

**Path safety:**

- Reject paths containing `..`
- Reject absolute paths
- Normalize to forward slashes
- Validate all resolved paths stay within registry

#### Resolver (`resolver.ts`)

Handles dependency resolution from project index using breadth-first traversal.

```typescript
export interface ResolvedNode {
  name: string;
  version: string;
  source: string;
  deps: string[]; // array of "name@version"
}

export class Resolver {
  /**
   * Resolves complete dependency closure from project index
   * - Reads .spectrl/spectrl-index.json
   * - Starts from all keys (roots)
   * - BFS traversal with lexicographic sorting
   * - Validates manifest identity matches index key
   * - Ensures all deps exist in index
   * - Returns sorted array of resolved nodes
   */
  async resolveClosureFromIndex(indexPath: string): Promise<ResolvedNode[]>;

  /**
   * Reads manifest from source URL (file:// in MVP)
   */
  private async readManifestFromSource(source: string): Promise<Manifest>;

  /**
   * Loads and validates project index
   */
  private async loadIndex(indexPath: string): Promise<ProjectIndex>;
}
```

**Resolution algorithm:**

1. Load project index from `.spectrl/spectrl-index.json`
2. Extract all keys as roots, sort lexicographically
3. Initialize BFS queue with roots
4. For each key in queue:
   - Parse `name@version`
   - Read manifest from source
   - Validate manifest name/version matches key
   - Extract deps, sort lexicographically
   - Verify each dep exists in index (fail if missing)
   - Add to output map
   - Enqueue deps if not visited
5. Return sorted array of resolved nodes

**Error handling:**

- Invalid index key → "Invalid index key: {key}"
- Missing source → "Missing source for {key}"
- Manifest mismatch → "Manifest mismatch for {key}: found {name}@{version}"
- Missing dep → "Missing dependency {depKey}. Add it to .spectrl/spectrl-index.json"
- Cycle detection → "Cyclic dependency detected: {path}"

#### Validator (`validator.ts`)

Validates manifests and file paths.

```typescript
export class Validator {
  /**
   * Validates manifest against schema
   * Throws with detailed error messages
   */
  static validateManifest(data: unknown): Manifest;

  /**
   * Validates file path safety
   * - No ..
   * - No absolute paths
   * - No duplicates
   */
  static validateFilePaths(paths: string[]): void;

  /**
   * Checks if all declared files exist
   */
  static async validateFilesExist(paths: string[], basePath: string): Promise<void>;
}
```

### 3. CLI Package (`@spectrl/cli`)

Thin wrapper that handles argument parsing, output formatting, and exit codes.

#### Command: `init`

```typescript
export async function init(cwd: string): Promise<void> {
  const indexPath = path.join(cwd, '.spectrl/spectrl-index.json');

  // Check if already exists
  if (await fileExists(indexPath)) {
    throw new CLIError('.spectrl/spectrl-index.json already exists', 1);
  }

  // Create .spectrl directory
  await fs.mkdir(path.join(cwd, '.spectrl'), { recursive: true });

  // Create empty index
  const index: ProjectIndex = {};

  await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');

  console.log('Created .spectrl/spectrl-index.json');
}
```

#### Command: `publish`

```typescript
export async function publish(cwd: string): Promise<void> {
  // Load and validate manifest
  const manifestPath = path.join(cwd, 'spectrl.json');
  const manifestData = await fs.readFile(manifestPath, 'utf-8');
  const manifest = Validator.validateManifest(JSON.parse(manifestData));

  // Validate files exist
  await Validator.validateFilesExist(manifest.files, cwd);

  // Read file contents for hashing
  const fileContents = new Map<string, string>();
  for (const filePath of manifest.files) {
    const content = await fs.readFile(path.join(cwd, filePath), 'utf-8');
    fileContents.set(filePath, content);
  }

  // Compute hash
  const hash = computeHash({ manifest, fileContents });
  const manifestWithHash = { ...manifest, hash };

  // Publish to registry
  const registry = new Registry();
  await registry.publish(manifestWithHash, cwd);

  console.log(`Published ${manifest.name}@${manifest.version}`);
  console.log(`Hash: ${hash}`);
}
```

#### Command: `install`

```typescript
export async function install(cwd: string): Promise<void> {
  const indexPath = path.join(cwd, '.spectrl/spectrl-index.json');
  const lockPath = path.join(cwd, '.spectrl/lock.json');

  const registry = new Registry();
  const resolver = new Resolver();

  // Step 1: Resolve closure from index
  const nodes = await resolver.resolveClosureFromIndex(indexPath);

  // Step 2: Compute digests and materialize
  const lockEntries: LockEntry[] = [];

  for (const node of nodes) {
    // Read manifest from source
    const sourcePath = fileURLToPath(node.source);
    const manifestData = await fs.readFile(path.join(sourcePath, 'spectrl.json'), 'utf-8');
    const manifest = Validator.validateManifest(JSON.parse(manifestData));

    // Read file contents
    const fileContents = new Map<string, string>();
    for (const filePath of manifest.files) {
      const content = await fs.readFile(path.join(sourcePath, filePath), 'utf-8');
      fileContents.set(filePath, content);
    }

    // Compute hash
    const hash = computeHash({ manifest, fileContents });

    // Check if already installed with matching hash
    if (await registry.exists(manifest.name, manifest.version)) {
      const existing = await registry.getManifest(manifest.name, manifest.version);
      if (existing.hash === hash) {
        console.log(`Skipping ${manifest.name}@${manifest.version} (already installed)`);
        lockEntries.push({
          name: manifest.name,
          version: manifest.version,
          hash,
          source: node.source,
          deps: node.deps,
        });
        continue;
      } else {
        throw new CLIError(
          `Integrity breach: hash mismatch for ${manifest.name}@${manifest.version}`,
          2,
        );
      }
    }

    // Materialize to registry
    const manifestWithHash = { ...manifest, hash };
    await registry.publish(manifestWithHash, sourcePath);

    console.log(`Installed ${manifest.name}@${manifest.version}`);

    lockEntries.push({
      name: manifest.name,
      version: manifest.version,
      hash,
      source: node.source,
      deps: node.deps,
    });
  }

  // Step 3: Write lock file
  const lockFile: LockFile = {
    createdAt: new Date().toISOString(),
    entries: lockEntries,
  };

  await fs.writeFile(lockPath, JSON.stringify(lockFile, null, 2) + '\n');

  console.log(`Wrote .spectrl/lock.json with ${lockEntries.length} entries`);
}
```

#### CLI Entry Point (`cli.ts`)

```typescript
#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { init, publish, install } from './commands/index.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
});

const command = positionals[0];

try {
  switch (command) {
    case 'init':
      await init(process.cwd());
      break;
    case 'publish':
      await publish(process.cwd());
      break;
    case 'install':
      await install(process.cwd());
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
} catch (error) {
  console.error(error.message);
  process.exit(error.exitCode || 1);
}
```

## Data Models

### Manifest (`spectrl.json`)

```json
{
  "name": "example-spec",
  "version": "1.0.0",
  "deps": {
    "base-spec": "0.5.0"
  },
  "files": ["docs/architecture.md", "specs/api.yaml"],
  "hash": "sha256:a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0"
}
```

### Project Index (`.spectrl/spectrl-index.json`)

```json
{
  "example-spec@1.0.0": {
    "source": "file:./specs/example-spec/1.0.0"
  },
  "base-spec@0.5.0": {
    "source": "file:./specs/base-spec/0.5.0"
  }
}
```

### Lock File (`.spectrl/lock.json`)

```json
{
  "createdAt": "2025-11-07T13:40:00Z",
  "entries": [
    {
      "name": "base-spec",
      "version": "0.5.0",
      "hash": "sha256:def456...",
      "source": "file:./specs/base-spec/0.5.0",
      "deps": []
    },
    {
      "name": "example-spec",
      "version": "1.0.0",
      "hash": "sha256:abc123...",
      "source": "file:./specs/example-spec/1.0.0",
      "deps": ["base-spec@0.5.0"]
    }
  ]
}
```

## Error Handling

### Exit Codes

- `0`: Success
- `1`: Validation error (invalid manifest, bad paths, manifest mismatch)
- `2`: I/O error (file not found, permission denied, integrity breach)
- `3`: Dependency resolution error (missing spec in index, cycle detected)

### Error Messages

All errors written to stderr with format:

```
Error: <operation> failed: <reason>
```

Examples:

- `Error: Validation failed: manifest.name must be lowercase`
- `Error: File not found: docs/missing.md`
- `Error: Missing dependency: dep-a@0.2.0. Add it to .spectrl/spectrl-index.json`
- `Error: Manifest mismatch for dep-a@0.2.0: found name=dep-a, version=0.1.9`
- `Error: Cyclic dependency detected: dep-x@1.0.0 → dep-y@1.0.0 → dep-x@1.0.0`
- `Error: Integrity breach: hash mismatch for example-spec@1.0.0`

### Validation Errors

Zod validation errors are transformed into human-readable messages:

```typescript
try {
  ManifestSchema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new CLIError(`Validation failed:\n${messages.join('\n')}`, 1);
  }
}
```

## Testing Strategy

### Unit Tests

Each core module has isolated unit tests:

- **Hasher**: Test deterministic output, normalization, canonicalization
- **Registry**: Test file I/O, path construction, safety checks
- **Resolver**: Test closure resolution, BFS ordering, error cases
- **Validator**: Test schema validation, path safety, file existence

Use Vitest with fixtures in `packages/examples/`.

### Integration Tests

Test core package as a whole:

- Publish → verify registry structure
- Install → verify closure resolution, hash computation, lock file
- Error scenarios → verify exit codes and messages

### End-to-End Tests

Black-box tests in `tests/e2e/` using child process execution:

```typescript
describe('spectrl CLI', () => {
  it('should init, publish, and install specs with transitives', async () => {
    const tmpDir = await createTempDir();

    // Init project
    await exec('spectrl init', { cwd: tmpDir });
    expect(await fileExists(path.join(tmpDir, '.spectrl/spectrl-index.json'))).toBe(true);

    // Create two specs: base-spec and app-spec (depends on base-spec)
    // ... setup code ...

    // Publish both
    await exec('spectrl publish', { cwd: baseSpecDir });
    await exec('spectrl publish', { cwd: appSpecDir });

    // Add to project index
    const index = {
      'app-spec@1.0.0': { source: `file:${appSpecDir}` },
      'base-spec@0.5.0': { source: `file:${baseSpecDir}` },
    };
    await writeJSON(path.join(tmpDir, '.spectrl/spectrl-index.json'), index);

    // Install
    await exec('spectrl install', { cwd: tmpDir });

    // Verify lock file
    const lock = await readJSON(path.join(tmpDir, '.spectrl/lock.json'));
    expect(lock.entries).toHaveLength(2);
    expect(lock.entries[0].name).toBe('base-spec');
    expect(lock.entries[1].name).toBe('app-spec');
    expect(lock.entries[1].deps).toEqual(['base-spec@0.5.0']);
  });
});
```

### Golden File Testing

Compare lock files and registry snapshots to known-good fixtures:

```typescript
it('should produce deterministic lock file', async () => {
  const result = await installSpecs(fixtureIndex);
  const golden = await loadGolden('basic-lock.json');
  expect(result).toEqual(golden);
});
```

## Implementation Notes

### Determinism Guarantees

1. **File ordering**: Always sort paths lexicographically
2. **Line endings**: Normalize to `\n` before hashing
3. **JSON formatting**: Canonical form (sorted keys, no whitespace)
4. **Dependency ordering**: Sort deps lexicographically before enqueuing
5. **Lock file ordering**: Sort entries by `name@version`
6. **Timestamps**: Never include in hashes (only in lock metadata)
7. **Filesystem**: Use consistent path separators (`/`)

### Path Normalization

```typescript
function normalizePath(p: string): string {
  // Convert to forward slashes
  const normalized = p.replace(/\\/g, '/');

  // Reject dangerous patterns
  if (normalized.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  if (path.isAbsolute(normalized)) {
    throw new Error('Absolute paths not allowed');
  }

  return normalized;
}
```

### Performance Considerations

MVP prioritizes correctness over performance:

- No caching (recompute hashes every time)
- No parallel operations (sequential I/O)
- No streaming (read entire files into memory)

These can be optimized post-MVP without changing interfaces.

## Dependencies

### Production

**Core Library:**

- `zod`: Schema validation
- `fs-extra`: Safe filesystem operations (optional, can use Node.js built-ins)

**CLI:**

- Node.js built-ins: `fs/promises`, `path`, `crypto`, `util`

**Runtime:**

- Node.js 20+ or Bun for CLI

### Development

- `typescript`: Type checking and compilation
- `vitest`: Unit and integration tests
- `@biomejs/biome`: Linting
- `prettier`: Formatting
- `@changesets/cli`: Version management
- `pnpm`: Workspace management

## Future Extensibility

The MVP design includes several extensibility points that enable future features without breaking changes:

### 1. Source Abstraction

**Current:** Project index uses `file:` URLs for local sources.

**Future:** The resolver can support additional URL schemes:

- `https://` for remote registries
- `git://` for Git repositories
- `ipfs://` for distributed storage

The lock file already captures the source URL, so clients can verify where specs came from regardless of protocol.

### 2. Hash-Based Integrity

**Current:** Hashes are computed and stored with `sha256:` prefix.

**Future:** Can add additional hash algorithms:

- `sha512:` for stronger security
- `blake3:` for faster hashing
- Multiple hashes per spec for algorithm agility

The prefix format allows backward-compatible hash algorithm evolution.

### 3. Registry Structure

**Current:** Simple `{name}/{version}/` layout with manifest and files.

**Future:** Can add metadata without breaking existing tools:

- `{name}/{version}/metadata.json` for additional spec metadata
- `{name}/{version}/signatures/` for cryptographic signatures
- `{name}/catalog.json` for version listings (enables range resolution)

The flat structure makes it easy to add new files without changing existing paths.

### 4. Manifest Extensibility

**Current:** Zod schemas validate known fields.

**Future:** Can use `.passthrough()` to allow additional fields:

- `author`, `license`, `repository` for metadata
- `scripts` for lifecycle hooks
- `exports` for structured content addressing

Old clients ignore unknown fields, new clients can use them.

### 5. Lock File Metadata

**Current:** Lock file captures name, version, hash, source, deps.

**Future:** Can add resolution metadata:

- `resolvedAt` timestamp per entry
- `resolvedBy` to track which index version was used
- `integrity` with multiple hash algorithms
- `signatures` for verified specs

The entries array structure allows adding fields without breaking parsers.

### 6. Dependency Resolution

**Current:** Exact versions only, explicit transitive listing required.

**Future:** Can add version range support:

- Project index uses ranges: `"dep-a": "^1.0.0"`
- Add catalog files to registry for version lookups
- Resolver performs range resolution and writes exact versions to lock
- Lock file format stays the same (exact versions)

This enables npm-style semver ranges while maintaining deterministic installs via lock file.

### 7. Content Deduplication

**Current:** Each spec version stores its own files.

**Future:** Can add content-addressed blob storage:

- Add `~/.spectrl/registry/blobs/sha256/{hash}` for deduplicated content
- Symlink from `{name}/{version}/files/` to blobs
- Transparent to users, no API changes
- Saves disk space for large specs with shared content

### 8. Remote Registries

**Current:** All sources are local `file:` URLs.

**Future:** Can add remote registry support:

- Project index references remote specs: `"source": "https://registry.spectrl.dev/specs/..."`
- Resolver downloads tarballs and verifies hashes
- Cache in local registry for offline use
- Lock file captures original source for reproducibility

The source field in lock entries already supports this.

### 9. Cryptographic Verification

**Current:** Hashes ensure content integrity.

**Future:** Can add signature verification:

- Specs include `.sig` files with cryptographic signatures
- Resolver verifies signatures against trusted keys
- Lock file captures signature metadata
- Enables trust chains and provenance tracking

### 10. MCP/AI Integration

**Current:** Specs are file-based artifacts.

**Future:** Can expose specs via Model Context Protocol:

- MCP server reads from local registry
- Provides structured context to AI agents
- Enables spec-driven development workflows
- Lock file ensures reproducible AI context

## Post-MVP Features

### Version Ranges and Catalogs

Add semver range resolution while maintaining deterministic installs:

1. Project index uses ranges: `"dep-a": "^1.0.0"`
2. Add `{name}/catalog.json` to registry listing all versions
3. Resolver performs range resolution using catalog
4. Lock file captures exact resolved versions
5. Subsequent installs use lock file (deterministic)

### Remote Registry Protocol

Enable public spec sharing:

1. Define HTTP API for spec discovery and download
2. Add tarball format for efficient transfer
3. Implement caching in local registry
4. Support authentication for private specs
5. Maintain offline-first behavior (cache-first)

### Blob Storage and Deduplication

Optimize disk usage for large specs:

1. Add content-addressed blob store at `~/.spectrl/registry/blobs/`
2. Store files by hash, symlink from spec directories
3. Deduplicate identical files across specs
4. Transparent to users (implementation detail)
5. Optional garbage collection for unused blobs

### Signature and Provenance

Enable trust and verification:

1. Add signature files to published specs
2. Implement key management for publishers
3. Verify signatures during install
4. Track provenance in lock file
5. Support trust policies (required signers, etc.)
