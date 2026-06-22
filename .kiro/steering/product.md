# Product Overview

Spectrl is a local-first spec registry that makes structured knowledge reproducible, composable, and agent-readable. It treats structured documents (PRDs, TDDs, ADRs, API conventions, etc.) as versioned, installable specs — managed locally, with optional publishing to a public registry.

## Core Principles

- **Local-first**: All data lives in the repo; works offline
- **Reproducible**: Deterministic registry state — same inputs = same outputs
- **Composable**: Specs can depend on other specs
- **Agent-readable**: Schema-defined structure for LLMs
- **Backend-optional**: Remote registry is optional, not a requirement

## Content Types

- **Spec**: A structured document (PRD, TDD, ADR, API contract, etc.)
- **Power**: A set of agent instructions for a specific workflow or pattern

Both are created with `spectrl new` and follow the same manifest format.

## Commands

### Local Workflow

| Command                    | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `spectrl new spec <name>`  | Scaffold a new spec directory with a manifest     |
| `spectrl new power <name>` | Scaffold a new power directory with a manifest    |
| `spectrl publish`          | Publish to local or public registry (interactive) |
| `spectrl install [spec]`   | Install all specs from index, or a specific spec  |
| `spectrl list`             | Show all installed specs                          |

### Public Registry

| Command                        | Description                               |
| ------------------------------ | ----------------------------------------- |
| `spectrl login`                | Authenticate with GitHub (Device Flow)    |
| `spectrl logout`               | Remove stored token                       |
| `spectrl whoami`               | Show authenticated user                   |
| `spectrl search <query>`       | Search the public registry                |
| `spectrl info <username/spec>` | Show spec versions and metadata           |
| `spectrl update [spec]`        | Check for and install updates             |
| `spectrl unpublish <spec>`     | Remove a version from the public registry |

## Manifest Format (`spectrl.jsonc`)

Manifests use JSONC format (JSON with comments). The file is named `spectrl.jsonc`.

```jsonc
{
  "name": "user-auth",
  "version": "1.0.0",
  "type": "spec", // or "power"
  // Required for publishing
  "description": "User authentication spec",
  "files": ["index.md", "docs/prd.md"],
  "deps": {
    "security-standards": "2.0.0",
  },
  // Recommended: help agents discover and use this spec
  "agent": {
    "purpose": "Defines authentication patterns and API contracts",
    "tags": ["auth", "api", "security"],
  },
}
```

- `files`: at least one file required; paths relative to spec directory; no `..` traversal
- `deps`: exact semver versions only (no ranges)
- `description`: optional locally, required for public publish
- `agent`: optional metadata for AI agent discovery; recommended for discoverability
- `hash`: computed automatically at publish time — don't set manually
- Cross-type dependencies are not allowed (specs can't depend on powers and vice versa)

## Key Concepts

- **Manifest**: Each spec/power has a `spectrl.jsonc` file defining name, version, type, dependencies, and tracked files
- **Registry**: Published specs stored in `~/.spectrl/registry/{name}/{version}/` (machine-wide, shared across projects)
- **Project Index** (`.spectrl/spectrl-index.json`): maps `name@version` keys to source locations — commit this
- **Lock File** (`.spectrl/lock.json`): pinned closure with SHA-256 hashes — commit this
- **Specs dir** (`.spectrl/specs/`): symlinks to registry — gitignored, restored by `spectrl install`
- **Hash**: Content-derived SHA-256 hash ensures reproducibility

This mirrors npm's model: `spectrl-index.json` ≈ `package.json`, `lock.json` ≈ `package-lock.json`, `.spectrl/specs/` ≈ `node_modules/`.

## AGENTS.md

When `spectrl install` runs for the first time, Spectrl creates (or appends to) an `AGENTS.md` file with instructions for AI assistants on how to discover and use installed specs. This is written once and never auto-updated.

## Publishing Rules

- `description` field is required for public publish
- `index.md` must be listed in `files` for public publish
- `agent` metadata is recommended (warnings shown if missing)
- Public publish requires `spectrl login` first (GitHub Device Flow auth)
