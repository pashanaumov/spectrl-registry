# Spectrl

A local-first spec registry that makes structured knowledge reproducible, composable, and agent-readable.

## What is Spectrl?

Spectrl treats structured documents (PRDs, TDDs, ADRs, API conventions, etc.) as versioned, installable specs — managed locally, with optional publishing to a public registry. It enables engineers and AI systems to work from deterministic context, so a spec can be installed, reused, or regenerated anywhere with identical results.

## Core Principles

- **Local-first**: All data lives in the repo; works offline
- **Reproducible**: Deterministic registry state — same inputs = same outputs
- **Composable**: Specs can depend on other specs
- **Agent-readable**: Schema-defined structure for LLMs
- **Backend-optional**: Remote registry is optional, not a requirement

## Installation

### From npm

```bash
# Use directly with npx (no install required)
spr

# Or install globally
npm install -g spectrl-registry-registry
# or
pnpm add -g spectrl-registry
```

### From Source

```bash
git clone https://github.com/spectrl-dev/spectrl.git
cd spectrl
pnpm install
pnpm build
cd packages/cli && npm link
```

### Requirements

- Node.js 20+ or Bun

## Quick Start

```bash
# Create a new spec
spr new my-feature

# Add files and update the manifest
cd my-feature
echo "# My Feature" > index.md
# Edit spectrl.json to add "index.md" to the files array

# Publish to local registry
spr publish

# Install from local registry
spr install my-feature

# Or search and install from the public registry
spr search api-design
spr install alice/api-design
```

## Commands

### Local Workflow

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `spr new <name>`     | Scaffold a new spec directory with a manifest     |
| `spr publish`        | Publish to local or public registry (interactive) |
| `spr install [spec]` | Install all specs from index, or a specific spec  |
| `spr list`           | Show all installed specs                          |

### Public Registry

| Command                    | Description                               |
| -------------------------- | ----------------------------------------- |
| `spr login`                | Authenticate with GitHub (Device Flow)    |
| `spr logout`               | Remove stored token                       |
| `spr whoami`               | Show authenticated user                   |
| `spr search <query>`       | Search the public registry                |
| `spr info <username/spec>` | Show spec versions and metadata           |
| `spr update [spec]`        | Check for and install updates             |
| `spr unpublish <spec>`     | Remove a version from the public registry |

### `spr new`

```bash
spr new <name> [--version <version>] [--description <desc>]
```

Creates a `{name}/` directory with a `spectrl.json` manifest. Name must be lowercase alphanumeric with hyphens.

```bash
spr new user-auth --version 1.0.0 --description "User authentication spec"
```

### `spr publish`

Prompts you to choose a destination:

- **Local** (`~/.spectrl/registry/`) — private, no auth required
- **Public** (`registry.spectrl.dev`) — requires `spr login`, `description` field required

```bash
spr publish
# ? Where do you want to publish?
# ❯ Local registry (~/.spectrl/registry/)
#   Public registry (registry.spectrl.dev)
```

### `spr install`

**Bulk mode** — restore all specs from `.spectrl/spectrl-index.json` (like `npm install`):

```bash
spr install
```

**Single spec from local registry:**

```bash
spr install my-spec          # latest version
spr install my-spec@1.0.0   # specific version
```

**Single spec from public registry:**

```bash
spr install alice/api-design
spr install alice/api-design@2.0.0
```

Installs create symlinks from `.spectrl/specs/{name}@{version}/` to the registry (junction points on Windows, with automatic fallback to file copy). The project index is updated automatically.

### `spr update`

```bash
spr update                    # show available updates
spr update alice/api-design   # update specific spec
spr update --all              # update all specs
```

Only works with public specs. Uses semver comparison to detect newer versions.

### `spr search` / `spr info`

```bash
spr search "authentication"
spr info alice/user-auth
```

## How It Works

1. **Manifest** (`spectrl.json`): defines name, version, description, tracked files, and dependencies
2. **Project Index** (`.spectrl/spectrl-index.json`): maps `name@version` keys to source locations — commit this
3. **Lock File** (`.spectrl/lock.json`): pinned closure with SHA-256 hashes — commit this
4. **Registry** (`~/.spectrl/registry/`): machine-wide store, shared across projects
5. **Specs dir** (`.spectrl/specs/`): symlinks to registry — gitignored, restored by `spr install`

This mirrors npm's model: `spectrl-index.json` ≈ `package.json`, `lock.json` ≈ `package-lock.json`, `.spectrl/specs/` ≈ `node_modules/`.

## Manifest Format (`spectrl.json`)

```json
{
  "name": "user-auth",
  "version": "1.0.0",
  "description": "User authentication spec",
  "files": ["index.md", "docs/prd.md", "docs/api-spec.yaml"],
  "deps": {
    "security-standards": "2.0.0"
  },
  "agent": {
    "purpose": "Defines authentication patterns and API contracts for the user auth system",
    "tags": ["auth", "api", "security"]
  }
}
```

- `files`: at least one file required; paths relative to spec directory; no `..` traversal
- `deps`: exact semver versions only (no ranges)
- `description`: optional locally, required for public publish
- `agent`: optional metadata for AI agent discovery
- `hash`: computed automatically at publish time — don't set manually

## Version Control

```gitignore
# .gitignore
.spectrl/specs/   # like node_modules/ — restored by spectrl install
```

Commit `.spectrl/spectrl-index.json` and `.spectrl/lock.json`. The `specs/` directory is derived and should not be committed.

## Team Workflow

```bash
# Developer A: add a spec
spr install alice/api-design@1.0.0
git add .spectrl/spectrl-index.json .spectrl/lock.json
git commit -m "Add api-design spec"
git push

# Developer B: restore after pull
git pull
spr install   # installs everything from index
```

## AGENTS.md

When you run `spr install` for the first time, Spectrl creates (or appends to) an `AGENTS.md` file with instructions for AI assistants on how to discover and use installed specs. This is written once and never auto-updated.

## Project Structure

```
spectrl/
├── packages/
│   ├── schema/      # Zod schemas + TypeScript types
│   ├── core/        # Registry I/O, hashing, resolution
│   └── cli/         # spectrl binary
├── api/             # AWS Lambda functions (public registry backend)
├── apps/
│   └── spectrl-web/ # Next.js frontend (browse public registry)
├── infra/           # Infrastructure configuration
└── tests/e2e/       # Black-box end-to-end tests
```

## Development

```bash
pnpm install    # install dependencies
pnpm build      # compile all packages
pnpm test       # run unit tests
pnpm test:e2e   # run end-to-end tests
pnpm lint       # check with Biome
pnpm format     # format with Prettier
```

## Troubleshooting

**Symlinks on Windows**: Spectrl uses junction points (no admin required). If creation fails, it falls back to file copy automatically. To force copy mode: `SPECTRL_USE_COPY=1 spectrl install`.

**`spectrl` not found after source install**: Run `cd packages/cli && npm link`, or use `node packages/cli/dist/cli.js` directly.

**Hash mismatch**: The spec content changed after it was added to the index. Remove and reinstall: `rm -rf ~/.spectrl/registry/{name}/{version}` then `spr install {name}@{version}`.

**Missing dependency error**: All transitive dependencies must be listed in `.spectrl/spectrl-index.json`. Add the missing spec with `spr install {name}@{version}`.

## Infrastructure

The public registry runs on GCP (Cloud Run + Firestore + Cloud Storage + Secret Manager). See [infra/README.md](infra/README.md) for details.

### Deploying

```bash
./deploy.sh
```

### Architecture

```
api.spectrl.pro          → Cloud Run (spectrl-api) — Hono HTTP server
registry.spectrl.pro     → Vercel (apps/spectrl-web) — Next.js frontend
spectrl-specs-prod       → Cloud Storage — spec files (public read)
Firestore (default)      → spec + user metadata
Secret Manager           → GitHub OAuth credentials
```

## License

TBD

## Contributing

TBD
