# e2e

End-to-end black-box tests for Spectrl CLI.

## Purpose

These tests verify the entire system works correctly by:

- Executing the actual `spectrl` CLI binary
- Working with real files and directories
- Testing complete workflows (init → publish → install)
- Validating exit codes and output

## Why This Exists

E2E tests provide confidence that:

1. **Integration works**: All packages work together correctly
2. **CLI behaves correctly**: Argument parsing, output, exit codes
3. **Determinism holds**: Same inputs produce same outputs
4. **Errors are clear**: Users get helpful error messages
5. **Real-world usage**: Tests match how users actually use the tool

## Test Strategy

### Black-Box Testing

Tests treat the CLI as a black box:

- Execute commands via child process
- Inspect file system results
- Check stdout/stderr output
- Verify exit codes

No direct imports from `@spectrl/core` or `@spectrl/cli`.

### Test Isolation

Each test runs in a temporary directory:

- No shared state between tests
- Clean environment for each test
- Parallel execution safe

### Golden File Testing

Compare registry snapshots to known-good fixtures:

- Ensures deterministic output
- Detects unintended changes
- Documents expected structure

## Test Coverage

### Init Workflow

```typescript
it('should create manifest with spectrl init', async () => {
  await exec('spectrl init');
  expect(await fileExists('spectrl.json')).toBe(true);
  const manifest = await readJSON('spectrl.json');
  expect(manifest.version).toBe('0.1.0');
});
```

### Publish Workflow

```typescript
it('should publish spec to registry', async () => {
  await exec('spectrl init');
  await writeFile('README.md', '# Test');
  await updateManifest({ files: ['README.md'] });

  await exec('spectrl publish');

  const registryPath = '.spectrl/registry/test-spec/versions/0.1.0';
  expect(await dirExists(registryPath)).toBe(true);
  expect(await fileExists(`${registryPath}/files/README.md`)).toBe(true);
});
```

### Install Workflow

```typescript
it('should install spec with dependencies', async () => {
  const indexPath = './test-index.json';
  await writeIndex(indexPath, {
    'example-spec@1.0.0': {
      manifest: {
        /* ... */
      },
      source: 'file:./specs/example-spec',
    },
  });

  await exec(`spectrl install example-spec --index ${indexPath}`);

  const registryPath = '.spectrl/registry/example-spec/versions/1.0.0';
  expect(await dirExists(registryPath)).toBe(true);
});
```

### Error Scenarios

```typescript
it('should exit with code 1 on validation error', async () => {
  await writeFile('spectrl.json', '{ "invalid": true }');

  const result = await exec('spectrl publish', { expectError: true });

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('Validation failed');
});
```

## Test Utilities

### Temp Directory Management

```typescript
const tmpDir = await createTempDir();
// Run tests in tmpDir
await cleanup(tmpDir);
```

### CLI Execution

```typescript
const result = await exec('spectrl init', {
  cwd: tmpDir,
  expectError: false,
});

expect(result.exitCode).toBe(0);
expect(result.stdout).toContain('Created spectrl.json');
```

### File System Helpers

```typescript
await writeFile('README.md', '# Test');
await writeJSON('spectrl.json', manifest);
const exists = await fileExists('spectrl.json');
const content = await readFile('README.md');
```

## Running Tests

```bash
# Run all e2e tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e init.test.ts

# Watch mode
pnpm test:e2e --watch
```

## Test Organization

```
e2e/
├── init.test.ts         # spectrl init tests
├── publish.test.ts      # spectrl publish tests
├── install.test.ts      # spectrl install tests
├── errors.test.ts       # Error handling tests
├── determinism.test.ts  # Reproducibility tests
└── utils/
    ├── exec.ts          # CLI execution helpers
    ├── fs.ts            # File system helpers
    └── fixtures.ts      # Test data generators
```

## Development

```bash
# Install dependencies
pnpm install

# Build CLI first (e2e tests use the built binary)
pnpm -C packages/cli build

# Run tests
pnpm test
```

## Dependencies

- `vitest`: Test runner
- Node.js built-ins: `child_process`, `fs/promises`, `path`, `os`

## No Production Dependencies

E2E tests only run in development. They're not included in published packages.
