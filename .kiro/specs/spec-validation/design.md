# Design Document: spec-validation

## Overview

This feature introduces a shared validation module in `@spectrl/core` and a new `spectrl validate` CLI command. The validation module collects all errors and warnings into a structured result instead of throwing on the first failure. The existing `spectrl publish` command is refactored to use this module as a pre-publish gate.

The key design decision is placing the validation logic in `@spectrl/core` (not `@spectrl/cli`) so it remains reusable and testable without CLI dependencies. The CLI layer is a thin wrapper that formats and displays results.

## Architecture

```mermaid
graph TD
    A[spectrl validate] --> C[validateSpec<br/>@spectrl/core]
    B[spectrl publish] --> C
    C --> D[Schema Check<br/>ManifestSchema.safeParse]
    C --> E[File Path Security<br/>validateFilePaths]
    C --> F[File Existence<br/>validateFilesExist]
    C --> G[checkEmptyFiles]
    C --> H[checkOrphanedFiles]
    C --> I[checkNameConvention]
    C --> J[checkSemverVersion]
    C --> K[checkDescriptionPresence]
    C --> L[checkDependencies]
    C --> M[checkSelfDependency]
    C --> N[checkAgentCompleteness]
    C --> O[ValidationResult]
    O --> P{Has errors?}
    P -->|Yes| Q[Block publish / exit 1]
    P -->|No| R[Proceed / exit 0]
```

## Components and Interfaces

### 1. Validation Result Types (`@spectrl/core`)

New file: `packages/core/src/validation.ts`

```typescript
type IssueSeverity = 'error' | 'warning';

interface ValidationIssue {
  severity: IssueSeverity;
  message: string;
}

interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function hasErrors(result: ValidationResult): boolean {
  return result.errors.length > 0;
}
```

### 2. Orchestrator Function (`@spectrl/core`)

The main entry point. Reads the manifest, runs all checks, returns a `ValidationResult`. Never throws for validation failures — it collects them.

```typescript
async function validateSpec(cwd: string): Promise<ValidationResult>;
```

Internal flow:

1. Read `spectrl.json` as raw JSON via `readJsonFile`
2. Parse with `ManifestSchema.safeParse()` — if this fails, collect schema errors and skip manifest-dependent checks
3. Wrap existing `validateFilePaths` and `validateFilesExist` in try/catch to convert thrown errors into issues
4. Run new check functions, concatenating their returned issues
5. Return combined `ValidationResult`

### 3. Individual Check Functions (`@spectrl/core`)

All new check functions live in `packages/core/src/validation.ts`. Each returns an array of `ValidationIssue` objects.

```typescript
// Errors if any file has 0 bytes
async function checkEmptyFiles(files: string[], cwd: string): Promise<ValidationIssue[]>;

// Warnings for files in cwd not listed in manifest (excludes spectrl.json, dotfiles, node_modules, dist, .git)
async function checkOrphanedFiles(files: string[], cwd: string): Promise<ValidationIssue[]>;

// Error if name doesn't match /^[a-z0-9-]+$/
function checkNameConvention(name: string): ValidationIssue[];

// Error if version doesn't match /^\d+\.\d+\.\d+$/
function checkSemverVersion(version: string): ValidationIssue[];

// Warning if description is undefined or empty
function checkDescriptionPresence(description: string | undefined): ValidationIssue[];

// Errors if dep names or versions are malformed
function checkDependencies(deps: Record<string, string>): ValidationIssue[];

// Error if spec name appears as a key in deps
function checkSelfDependency(name: string, deps: Record<string, string>): ValidationIssue[];

// Warning if agent.purpose is empty when agent is present
function checkAgentCompleteness(
  agent: { purpose: string; tags?: string[] } | undefined,
): ValidationIssue[];
```

Design rationale: Each check is a pure function (or async for filesystem checks) that takes only the data it needs. This makes them independently testable and composable.

### 4. Orphaned File Exclusion Set

The orphaned file check uses a hardcoded exclusion set:

```typescript
const ORPHAN_EXCLUSIONS = new Set(['spectrl.json', 'node_modules', 'dist', '.git']);

function isExcludedFromOrphanCheck(name: string): boolean {
  return name.startsWith('.') || ORPHAN_EXCLUSIONS.has(name);
}
```

Only top-level entries in the spec directory are scanned (no recursive walk). This keeps the check fast and avoids false positives from nested directories.

### 5. Validate Command (`@spectrl/cli`)

New file: `packages/cli/src/commands/validate/index.ts`

```typescript
async function validate(cwd: string): Promise<void>;
```

- Calls `validateSpec(cwd)` from `@spectrl/core`
- Iterates over all issues, printing each with `formatError` (for errors) or `formatWarning` (for warnings)
- Prints a summary line: "N error(s), M warning(s)"
- If no issues: prints a success message
- Exits with `ExitCode.VALIDATION_ERROR` if any errors, `ExitCode.SUCCESS` otherwise

Registered in `cli.ts` as a new `validateCmd` subcommand with no arguments.

### 6. Publish Command Refactor (`@spectrl/cli`)

The existing `publish` function replaces its three separate validation calls (`readAndValidateManifest`, `validateFilePaths`, `validateFilesExist`) with a single `validateSpec(cwd)` call at the top. If the result has errors, it displays all issues and throws `CLIError`. If only warnings, it displays them and continues. The validated manifest is then obtained from a second `readAndValidateManifest` call (which is cheap since the file is already in OS cache) to get the typed `Manifest` object for the rest of the publish flow.

## Data Models

### ValidationIssue

| Field    | Type                   | Description                       |
| -------- | ---------------------- | --------------------------------- |
| severity | `'error' \| 'warning'` | Whether this issue blocks publish |
| message  | `string`               | Human-readable description        |

### ValidationResult

| Field    | Type                | Description                      |
| -------- | ------------------- | -------------------------------- |
| errors   | `ValidationIssue[]` | Issues with severity `'error'`   |
| warnings | `ValidationIssue[]` | Issues with severity `'warning'` |

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: All issues collected

_For any_ spec directory containing N distinct validation problems (e.g. 2 empty files, 1 bad dep name, 1 missing description), the Validation_Result returned by `validateSpec` should contain at least N issues across its errors and warnings arrays.

**Validates: Requirements 1.2, 1.3**

### Property 2: Empty file detection accuracy

_For any_ manifest with a list of files where some have zero bytes and some have content, `checkEmptyFiles` should return an error for each zero-byte file and no errors for files with content. The set of file paths mentioned in errors should equal exactly the set of zero-byte files.

**Validates: Requirements 2.1, 2.2**

### Property 3: Orphaned file detection accuracy

_For any_ spec directory containing files and a manifest listing a subset of those files, `checkOrphanedFiles` should return a warning for each file that exists in the directory but is not in the manifest's files array and is not in the exclusion set (spectrl.json, hidden files, node_modules, dist, .git). The set of warned files should equal exactly the set of non-excluded untracked files.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 4: Name convention check accuracy

_For any_ string, `checkNameConvention` should return an error if and only if the string does not match `/^[a-z0-9-]+$/`.

**Validates: Requirements 4.1, 4.2**

### Property 5: Semver version check accuracy

_For any_ string, `checkSemverVersion` should return an error if and only if the string does not match `/^\d+\.\d+\.\d+$/`.

**Validates: Requirements 5.1, 5.2**

### Property 6: Description warning accuracy

_For any_ optional string value (undefined, empty string, or non-empty string), `checkDescriptionPresence` should return a warning if and only if the value is undefined or an empty string.

**Validates: Requirements 6.1, 6.2**

### Property 7: Dependency validation accuracy

_For any_ deps record (mapping string keys to string values), `checkDependencies` should return an error for each entry where the key does not match `/^[a-z0-9-]+$/` or the value does not match `/^\d+\.\d+\.\d+$/`, and no errors for well-formed entries.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 8: Self-dependency detection accuracy

_For any_ spec name and deps record, `checkSelfDependency` should return an error if and only if the spec name appears as a key in the deps record.

**Validates: Requirements 8.1, 8.2**

### Property 9: Agent completeness warning accuracy

_For any_ optional agent object, `checkAgentCompleteness` should return a warning if and only if the agent is present and its purpose field is an empty string.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 10: Validate command exit code

_For any_ ValidationResult, the validate command should exit with a non-zero code if and only if the result contains at least one error.

**Validates: Requirements 10.2, 10.3, 10.4**

### Property 11: Validate command displays all issues

_For any_ ValidationResult containing issues, the validate command output should contain the message of every ValidationIssue in the result.

**Validates: Requirements 10.5**

### Property 12: Publish aborts on validation errors

_For any_ ValidationResult, the publish command should abort the publish operation if and only if the result contains at least one error.

**Validates: Requirements 11.2, 11.3**

## Error Handling

- **Manifest not found**: If `spectrl.json` does not exist, `validateSpec` reports an error issue and returns early (no further checks depend on a missing manifest). This reuses the existing `readJsonFile` error path, but catches the thrown error and converts it to a `ValidationIssue`.
- **Manifest parse failure**: If `ManifestSchema.safeParse` fails, Zod errors are converted to `ValidationIssue` entries with severity `'error'`. Checks that depend on parsed manifest fields (empty files, orphaned files, name, version, description, deps, agent) are skipped.
- **File I/O errors**: If `stat` or `readdir` fails for reasons other than "not found" (e.g. permission denied), the error is caught and reported as a `ValidationIssue` with severity `'error'`.
- **Existing validators**: `validateFilePaths` and `validateFilesExist` throw on failure. `validateSpec` wraps each in try/catch and converts the thrown error message into a `ValidationIssue`.

## Testing Strategy

### Property-Based Tests

Use `fast-check` with Vitest. Each property test runs a minimum of 100 iterations.

Properties 4, 5, 6, 7, 8, and 9 are pure functions with simple inputs (strings, records, optional objects) — ideal for property-based testing with generated values. Properties 2 and 3 require filesystem setup, so they use generated file lists with a temp directory fixture. Properties 10, 11, and 12 test CLI behavior against generated `ValidationResult` objects.

Property 1 (all issues collected) is best tested as an integration-level property with a temp directory containing multiple known problems.

Each property test must be tagged with:

```
Feature: spec-validation, Property {N}: {title}
```

### Unit Tests

- Edge cases for orphaned file exclusions (spectrl.json, dotfiles, node_modules, dist, .git)
- Empty ValidationResult produces success message
- Manifest with only warnings still allows publish to proceed
- CLI output formatting for mixed errors and warnings
- Manifest not found produces a clear error issue
- Manifest with invalid JSON produces a clear error issue

### Test Library

- **Property-based testing**: `fast-check` (well-supported with Vitest)
- **Test runner**: Vitest (already in use)
- **Filesystem fixtures**: `tmp` directories created in `beforeEach`, cleaned in `afterEach`
