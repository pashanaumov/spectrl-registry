# Design Document: Spectrl

## Overview

Spectrl is a local-first spec registry that makes structured knowledge reproducible, composable, and agent-readable. It treats structured documents (PRDs, TDDs, ADRs, API conventions, etc.) as versioned, installable artifacts managed locally — with optional publishing to a public cloud registry.

The system is a TypeScript monorepo with three core packages (`schema`, `core`, `cli`) plus a web frontend (`apps/spectrl-web`) and API Lambda functions (`api/`).

Design priorities:

- **Local-first**: All data lives in the repo; works offline
- **Determinism**: Identical inputs produce identical outputs
- **Composable**: Specs can depend on other specs
- **Agent-readable**: Schema-defined structure for LLMs
- **Backend-optional**: Remote registry is optional, not required

---

## Architecture

### Package Structure

```
spectrl/
├── packages/
│   ├── schema/          # Zod schemas + TypeScript types
│   ├── core/            # Registry I/O, hashing, resolution
│   └── cli/             # spectrl binary
├── api/                 # AWS Lambda functions (public registry backend)
│   ├── publish-spec/
│   ├── search-specs/
│   ├── get-spec/
│   ├── unpublish-spec/
│   └── auth-*/
├── apps/
│   └── spectrl-web/     # Next.js frontend (browse public registry)
├── infra/               # Infrastructure config + seed data
└── tests/e2e/           # Black-box end-to-end tests
```

### Package Dependencies

```
spectrl  ←  @spectrl/core  ←  @spectrl/schema
```

---

## Components and Interfaces

### 1. Schema Package (`@spectrl/schema`)

Defines all data structures using Zod for runtime validation and TypeScript type inference.

#### Manifest Schema (`packages/schema/src/manifest.ts`)

```typescript
export const ManifestSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().optional(),
  deps: z.record(z.string(), z.string()).default({}),
  files: z.array(z.string()).min(1),
  hash: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .optional(),
  agent: z
    .object({
      purpose: z.string(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});
```

Key decisions:

- Name: lowercase alphanumeric + hyphens
- Version: exact semver only (no ranges)
- `description`: optional locally, required for public publish
- `agent`: optional metadata for AI agent discovery
- `hash`: computed at publish time, not authored manually

#### Project Index Schema (`packages/schema/src/project-index.ts`)

Maps `name@version` keys to source locations. Used by the resolver.

```typescript
export const IndexSchema = z.record(
  z.string().regex(/^[a-z0-9-]+@\d+\.\d+\.\d+$/),
  z.object({ source: z.string() }),
);
```

Public specs use `username/name@version` keys with HTTPS source URLs.

#### Lock File Schema (`packages/schema/src/lock.ts`)

Pinned closure with hashes for reproducibility.

```typescript
export const LockFileSchema = z.object({
  createdAt: z.string().datetime(),
  entries: z.array(LockEntrySchema),
});
```

---

### 2. Core Package (`@spectrl/core`)

All business logic lives here. The CLI is a thin wrapper.

#### Hasher (`hasher.ts`)

Computes deterministic SHA-256 hashes:

1. Canonicalize manifest JSON (sorted keys, no whitespace, exclude `hash` field)
2. Sort file paths lexicographically
3. For each file: hash path + normalized content (line endings → `\n`)
4. Return `sha256:<hex>`

#### Registry (`registry.ts`)

File I/O for `~/.spectrl/registry/`:

```
~/.spectrl/registry/
└── {name}/
    └── {version}/
        ├── spectrl.json
        └── files/
            └── {original/path/structure}
```

Key behaviors:

- Immutable: publishing an existing `name@version` throws
- Path safety: rejects `..` traversal and paths escaping registry root
- `list()`, `listVersions()`, `exists()`, `getManifest()`, `publish()`, `remove()`

#### Resolver (`resolver.ts`)

Resolves dependency closure from `.spectrl/spectrl-index.json`:

1. Load and validate index
2. Parse all `name@version` keys
3. Read manifests from sources (supports `file:`, `file://`, relative paths, HTTPS)
4. Validate manifest identity matches index key
5. BFS traversal with cycle detection (DFS)
6. Return sorted array of `ResolvedNode`

Error types: `ResolverError` with exit codes for missing deps, cycles, mismatches.

#### Validator (`validator.ts`)

- `validateManifest(data)` — Zod parse with human-readable errors
- `validateFilePaths(paths)` — rejects `..`, absolute paths, duplicates
- `validateFilesExist(paths, basePath)` — checks files on disk

---

### 3. CLI Package (`spectrl`)

Uses `cmd-ts` for argument parsing. Entry point: `packages/cli/src/cli.ts`.

#### Commands

| Command                    | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `spectrl init`             | Initialize project (deprecated — install auto-inits)     |
| `spectrl new <name>`       | Scaffold new spec directory with `spectrl.json`          |
| `spectrl publish`          | Publish to local or public registry (interactive prompt) |
| `spectrl install [spec]`   | Install all specs from index, or a single spec           |
| `spectrl login`            | GitHub Device Flow authentication                        |
| `spectrl logout`           | Remove stored token                                      |
| `spectrl whoami`           | Show authenticated user                                  |
| `spectrl search <query>`   | Search public registry                                   |
| `spectrl info <spec>`      | Show spec metadata                                       |
| `spectrl list`             | List installed specs                                     |
| `spectrl unpublish <spec>` | Remove spec from public registry                         |
| `spectrl update [spec]`    | Check for and install updates                            |

#### `spectrl new`

Creates `{name}/spectrl.json` with manifest template. Validates name format (lowercase alphanumeric + hyphens).

#### `spectrl publish`

Two destinations via interactive prompt:

- **Local**: computes hash, writes to `~/.spectrl/registry/`
- **Public**: requires auth token, validates `description` is present, auto-populates `agent` field if missing, sends to API

#### `spectrl install`

Two modes:

- **Full install** (`spectrl install`): resolves closure from `.spectrl/spectrl-index.json`, materializes each spec to registry, creates symlinks in `.spectrl/specs/`, writes lock file
- **Single spec** (`spectrl install username/name@version`): fetches from public API, downloads manifest + files from S3/CloudFront, updates index

Symlink behavior:

- Unix: directory symlinks (`dir`)
- Windows: junction points (no admin required)
- Fallback: file copy if symlinks fail (`SPECTRL_USE_COPY=1` to force)

Auto-initializes project if `.spectrl/spectrl-index.json` doesn't exist.

Collision detection: warns when installing a public spec that conflicts with an existing local spec of the same name (and vice versa).

#### AGENTS.md Management (`agents/`)

- `template.ts`: `AGENTS_TEMPLATE` constant — instructions for AI assistants on how to use specs
- `manager.ts`: `checkAgentsStatus`, `createAgentsFile`, `appendToAgentsFile`
- Written once during `init` or `install`; never auto-updated after creation
- Uses `<!-- Added by Spectrl -->` marker to detect existing content

#### API Client (`utils/api-client.ts`)

All API responses validated with Zod before use (per `api-validation.md`). Includes retry logic with exponential backoff for network failures. Never retries 4xx errors.

Endpoints:

- `initiateDeviceFlow()` / `pollDeviceAuthorization()` — GitHub auth
- `publishSpec(token, manifest, files)` — publish to public registry
- `searchSpecs(query)` — search
- `getSpec(username, name)` — fetch metadata + versions
- `unpublishSpec(token, username, name, version)` — remove version

---

### 4. API Lambda Functions (`api/`)

AWS Lambda handlers for the public registry backend. Uses `zod/v4` (note: packages use `zod` v3).

| Lambda             | Route                                    | Description                           |
| ------------------ | ---------------------------------------- | ------------------------------------- |
| `publish-spec`     | `POST /publish`                          | Store manifest + files in S3/DynamoDB |
| `search-specs`     | `GET /search`                            | Query DynamoDB for specs              |
| `get-spec`         | `GET /specs/:username/:name`             | Fetch spec metadata + versions        |
| `unpublish-spec`   | `DELETE /specs/:username/:name/:version` | Remove spec version                   |
| `auth-device-init` | `POST /auth/device/init`                 | Start GitHub Device Flow              |
| `auth-device-poll` | `POST /auth/device/poll`                 | Poll for auth completion              |
| `auth-exchange`    | `POST /auth/exchange`                    | Exchange code for token               |

Each Lambda has its own `schemas/` directory with Zod-validated request/response types.

---

### 5. Frontend (`apps/spectrl-web`)

Next.js app for browsing the public registry. Uses `zod` v3 (not v4).

Key files:

- `src/lib/schemas.ts` — Zod schemas for API responses
- `src/lib/api-client.ts` — typed fetch wrappers
- `src/components/specs/` — spec card, detail, search components
- `src/app/specs/` — browse and detail pages
- `src/content/docs/` — MDX documentation

---

## Data Flow

### Local Publish

```
spectrl.json + files
    → validate manifest
    → compute SHA-256 hash
    → write to ~/.spectrl/registry/{name}/{version}/
```

### Public Publish

```
spectrl.json + files
    → validate manifest (description required)
    → auto-populate agent field if missing
    → POST /publish with Bearer token
    → API stores in S3 + DynamoDB
```

### Install (Full)

```
.spectrl/spectrl-index.json
    → resolve closure (BFS)
    → for each spec: read manifest, compute hash
    → materialize to ~/.spectrl/registry/
    → create symlinks in .spectrl/specs/
    → write .spectrl/lock.json
```

### Install (Single Public Spec)

```
spectrl install username/name@version
    → GET /specs/username/name (API)
    → download spectrl.json from S3/CloudFront
    → validate with ManifestSchema.safeParse()
    → download files
    → write to .spectrl/specs/username-name@version/
    → update .spectrl/spectrl-index.json
```

---

## File Layout (Project)

```
.spectrl/
├── spectrl-index.json   # spec → source mapping (committed)
├── lock.json            # pinned closure with hashes (committed)
└── specs/               # installed specs (gitignored)
    ├── my-spec@1.0.0/   # symlink → ~/.spectrl/registry/my-spec/1.0.0/files
    └── alice-api@2.0.0/ # downloaded public spec (flat copy)
```

---

## Error Handling

### Exit Codes

| Code | Meaning                      |
| ---- | ---------------------------- |
| `0`  | Success                      |
| `1`  | Validation error             |
| `2`  | I/O error / integrity breach |
| `3`  | Dependency resolution error  |
| `4`  | Authentication error         |
| `5`  | User cancelled               |

### Validation Pattern

All external data (API responses, downloaded manifests, disk reads from external sources) must be validated with Zod `.safeParse()` before use. Never use `as Type` casting on external data.

```typescript
const parseResult = ManifestSchema.safeParse(data);
if (!parseResult.success) {
  throw new CLIError(
    `Invalid manifest: ${parseResult.error.issues[0].message}`,
    ExitCode.VALIDATION_ERROR,
  );
}
const manifest = parseResult.data;
```

---

## Testing Strategy

### Unit Tests (Vitest)

Co-located with source files (`.test.ts` suffix). Cover:

- Schema validation (valid/invalid inputs)
- Hash determinism and normalization
- Registry path construction and safety
- Resolver closure resolution and error cases
- CLI command logic

### Property-Based Tests (fast-check)

Validate universal properties across arbitrary inputs:

- Schema round-trips (parse → serialize → parse = equivalent)
- Hash determinism (same inputs always produce same hash)
- Resolver correctness properties

### End-to-End Tests (`tests/e2e/`)

Black-box tests using child process execution against real filesystem. Cover full publish → install cycles.

---

## Upcoming: Specs and Powers

The next major feature adds a `type` discriminator to distinguish two content types:

- **Specs** (`type: "spec"`): static context documents (PRDs, TDDs, ADRs). Default type.
- **Powers** (`type: "power"`): behavioral instructions and workflows for AI agents.

Key design decisions:

- `type` field in `spectrl.json` (or `spectrl.jsonc`), defaults to `"spec"`
- JSONC support for manifests (inline comments via `jsonc-parser`)
- `spectrl new spec <name>` and `spectrl new power <name>` subcommands
- `index.md` as conventional entry point for both types
- Auto-generated `.spectrl/catalog.md` on install for agent discovery
- `AGENTS.md` gets a static reference to `catalog.md` (written once)
- `description` required at publish; `agent.purpose` / `agent.tags` optional with soft warning
- Registry storage is flat — no split between specs and powers directories
- Full-stack propagation: API schemas, frontend display/filtering, infra seed data

See `.kiro/specs/specs-and-powers/` for the full spec.
