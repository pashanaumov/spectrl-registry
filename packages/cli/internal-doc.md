# spectrl

Command-line interface for Spectrl.

## Purpose

This package provides the `spectrl` binary that users interact with. It's a thin wrapper around `@spectrl/core` that handles:

- Argument parsing
- Output formatting
- Exit codes
- Error messages

## Why This Exists

The CLI is deliberately thin to:

1. **Keep logic testable**: All business logic lives in `@spectrl/core`
2. **Enable reuse**: Other interfaces (MCP, web UI) can use core directly
3. **Simplify maintenance**: CLI only handles user interaction, not logic
4. **Improve testing**: Core can be unit tested; CLI gets e2e tests

## Commands

### `spectrl init`

Initialize a project index in the current directory.

```bash
spectrl init
```

**What it does:**

- Creates `.spectrl/` directory
- Creates `.spectrl/spectrl-index.json` with empty object
- Prepares project for spec installation

**Exit codes:**

- `0`: Success
- `1`: Index already exists

### `spectrl publish`

Publish the current spec to the local registry.

```bash
spectrl publish
```

**What it does:**

- Validates `spectrl.json` in current directory
- Checks that all tracked files exist
- Computes SHA-256 content hash in format `sha256:<hex>`
- Copies files to `~/.spectrl/registry/{name}/{version}/files/`
- Writes manifest with hash to `~/.spectrl/registry/{name}/{version}/spectrl.json`
- Preserves directory structure

**Exit codes:**

- `0`: Success
- `1`: Validation error (invalid manifest, bad paths)
- `2`: I/O error (file not found, permission denied)

### `spectrl install`

Install specs from the local registry. Supports two modes:

**Bulk mode (no arguments):** Restore all specs from project index
**Single spec mode:** Install a specific spec and update the index

```bash
# Bulk mode: restore all specs from index
spectrl install

# Single spec mode: install specific spec
spectrl install [name[@version]]
```

**Bulk Mode (no arguments):**

- Reads `.spectrl/spectrl-index.json` from current directory
- Resolves complete dependency closure using breadth-first traversal
- Validates all transitive dependencies are listed in the index
- For each spec:
  - Checks if already installed with matching hash (skips if so)
  - Computes SHA-256 hashes for verification
  - Materializes to `~/.spectrl/registry/{name}/{version}/` if needed
  - Copies files to `.spectrl/specs/{name}/` if not already installed
- Writes `.spectrl/lock.json` with resolved closure and hashes
- Reports install/skip statistics

**Single Spec Mode (with name or name@version):**

- Parses spec reference (accepts `name` or `name@version` format)
- If no version provided:
  - Calls `Registry.listVersions(name)` to get all available versions
  - Sorts versions using semver comparison (descending)
  - Selects highest version (latest)
  - Displays resolution message: "Resolving {name}... found version {version}"
- Checks if spec already installed with matching hash (skips if so)
- Reads manifest from registry at `~/.spectrl/registry/{name}/{version}/`
- Copies files to `.spectrl/specs/{name}/` if not already installed
- **Automatically updates** `.spectrl/spectrl-index.json` with registry source and hash
- Updates `.spectrl/lock.json` with resolved dependency closure
- Displays install or skip message

**Version Resolution Implementation:**

The version resolution feature uses:

1. `Registry.listVersions(name: string): Promise<string[]>`
   - Lists all version directories in `~/.spectrl/registry/{name}/`
   - Filters to valid semver format (`\d+\.\d+\.\d+`)
   - Returns empty array if spec doesn't exist

2. `compareSemver(a: string, b: string): number`
   - Splits versions into [major, minor, patch] arrays
   - Compares numerically component by component
   - Returns 1 (a > b), -1 (a < b), or 0 (equal)

3. `resolveLatestVersion(name: string, registry: Registry): Promise<string>`
   - Calls `listVersions()` and sorts descending
   - Returns highest version
   - Throws error if no versions found

**Skip Logic Implementation:**

The skip logic uses:

1. `isAlreadyInstalled(name: string, version: string, expectedHash: string, cwd: string): Promise<boolean>`
   - Reads manifest from `.spectrl/specs/{name}/{version}/spectrl.json`
   - Compares manifest hash with expected hash
   - Returns true if match, false if mismatch or file missing
   - Handles I/O errors gracefully (returns false)

2. Integration in both modes:
   - Called before copying files
   - If true: skip copy, display skip message, increment skipCount
   - If false: proceed with copy, display install message, increment installCount

**Exit codes:**

- `0`: Success
- `1`: Validation error (invalid manifest, manifest mismatch, invalid spec reference)
- `2`: I/O error (file not found, hash mismatch)
- `3`: Dependency resolution error (missing dependency, cycle detected, spec not found)

## Configuration

### Index Location

The CLI reads the project index from `.spectrl/spectrl-index.json` in the current directory.

## Error Handling

All errors are written to stderr with format:

```
Error: <operation> failed: <reason>
```

Examples:

- `Error: Validation failed: manifest.name must be lowercase`
- `Error: File not found: docs/missing.md`
- `Error: Missing dependency missing-spec@1.0.0. Add it to .spectrl/spectrl-index.json`
- `Error: Manifest mismatch for dep-a@0.2.0: found name=dep-a, version=0.1.9`
- `Error: Cyclic dependency detected: dep-x@1.0.0 → dep-y@1.0.0 → dep-x@1.0.0`
- `Error: Integrity breach: hash mismatch for example-spec@1.0.0`
- `Error: Spec my-spec not found in registry` (version resolution failure)
- `Error: Invalid spec reference format. Use: name or name@version` (parse error)

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Test
pnpm test
```

## Installation

```bash
# Run directly with npx (no install required)
npx spectrl init

# Or install globally
npm install -g spectrl

# Or use with pnpm
pnpm add -g spectrl
```

## Dependencies

- `@spectrl/core`: Business logic
- `@spectrl/schema`: Types
- Node.js built-ins: `util` (parseArgs), `path`, `process`

## No External Runtime Dependencies

This package only depends on workspace packages and Node.js standard library.
