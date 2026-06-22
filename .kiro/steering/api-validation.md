---
inclusion: always
---

# API Response Validation

## Critical Rule: Never Trust External Data

**ALL external data MUST be validated with Zod schemas before use.**

This includes:

- API responses from backend services
- Data downloaded from S3/CloudFront
- User input from CLI arguments
- File contents read from disk (when from external sources)
- Environment variables

## The Problem with Type Casting

```typescript
// ❌ NEVER DO THIS - Dangerous type casting
const manifest = (await response.json()) as Manifest;

// ✅ ALWAYS DO THIS - Validate with Zod
const data = await response.json();
const parseResult = ManifestSchema.safeParse(data);
if (!parseResult.success) {
  throw new CLIError(
    `Invalid manifest format: ${parseResult.error.message}`,
    ExitCode.VALIDATION_ERROR,
  );
}
const manifest = parseResult.data;
```

## Why This Matters

1. **Security**: Prevents injection attacks and malformed data from causing crashes
2. **Reliability**: Catches API contract changes immediately
3. **Debugging**: Clear error messages when data doesn't match expectations
4. **Type Safety**: Zod provides both runtime validation AND compile-time types
5. **Production Readiness**: Professional-grade error handling

## Required Pattern for API Calls

### 1. Define Zod Schema

```typescript
// In api-client.ts or appropriate schema file
import { z } from 'zod';

export const SpecMetadataSchema = z.object({
  specId: z.string(),
  username: z.string(),
  specName: z.string(),
  versions: z.array(
    z.object({
      version: z.string(),
      s3Path: z.string(),
      hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
      publishedAt: z.string(),
      description: z.string().optional(),
      agentTags: z.array(z.string()).optional(),
      downloads: z.number().optional(),
    }),
  ),
});

export type SpecMetadata = z.infer<typeof SpecMetadataSchema>;
```

### 2. Validate API Response

```typescript
export async function getSpec(username: string, name: string): Promise<SpecMetadata> {
  const response = await fetch(`${getApiUrl()}/specs/${username}/${name}`);

  if (!response.ok) {
    throw new ApiError(`Failed to get spec: ${response.statusText}`, response.status);
  }

  const data = await response.json();

  // CRITICAL: Validate before using
  const parseResult = SpecMetadataSchema.safeParse(data);

  if (!parseResult.success) {
    throw new ApiError(
      `Invalid API response format: ${parseResult.error.message}`,
      response.status,
      data,
    );
  }

  return parseResult.data;
}
```

### 3. Validate Downloaded Files

```typescript
// When downloading manifest from S3/CloudFront
const manifestResponse = await fetch(manifestUrl);
const data = await manifestResponse.json();

// CRITICAL: Validate manifest structure
const parseResult = ManifestSchema.safeParse(data);

if (!parseResult.success) {
  throw new CLIError(
    `Downloaded manifest is invalid: ${parseResult.error.message}`,
    ExitCode.VALIDATION_ERROR,
  );
}

const manifest = parseResult.data;
```

## Existing Schemas to Use

The project already has Zod schemas defined in `@spectrl/schema`:

- `ManifestSchema` - For spec manifests
- `IndexSchema` - For project indexes
- `LockFileSchema` - For lock files

Import and use these schemas:

```typescript
import { ManifestSchema } from '@spectrl/schema';
```

## Error Handling Pattern

```typescript
try {
  const data = await response.json();
  const parseResult = SomeSchema.safeParse(data);

  if (!parseResult.success) {
    // Log the validation error for debugging
    console.error('Validation failed:', parseResult.error.format());

    throw new CLIError(
      `Invalid data format: ${parseResult.error.issues[0].message}`,
      ExitCode.VALIDATION_ERROR,
    );
  }

  return parseResult.data;
} catch (error) {
  if (error instanceof CLIError) {
    throw error;
  }

  throw new CLIError(
    `Failed to process response: ${error instanceof Error ? error.message : String(error)}`,
    ExitCode.IO_ERROR,
  );
}
```

## When to Use `.parse()` vs `.safeParse()`

- **Use `.safeParse()`** for external data (API responses, user input, downloaded files)
  - Returns `{ success: true, data }` or `{ success: false, error }`
  - Allows custom error handling
  - Better for production code

- **Use `.parse()`** only for internal data you control
  - Throws ZodError on validation failure
  - Acceptable for test fixtures or known-good data

## Testing Validation

**Use MSW (Mock Service Worker) for HTTP mocking - never override `global.fetch`**

MSW is the industry standard for API mocking in JavaScript. It provides a clean, type-safe way to mock HTTP requests.

### Setup MSW for Node.js Tests

```bash
pnpm add -D msw
```

```typescript
// test/setup.ts or in your test file
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Test Validation with MSW

Always test validation logic:

```typescript
import { http, HttpResponse } from 'msw';

it('should reject invalid API response', async () => {
  // Mock API to return invalid data using MSW
  server.use(
    http.get('https://api.example.com/specs/:username/:name', () => {
      return HttpResponse.json({ invalid: 'data' });
    }),
  );

  await expect(getSpec('user', 'spec')).rejects.toThrow('Invalid API response format');
});

it('should handle valid API response', async () => {
  // Mock API to return valid data
  server.use(
    http.get('https://api.example.com/specs/:username/:name', () => {
      return HttpResponse.json({
        specId: 'user/spec',
        username: 'user',
        specName: 'spec',
        versions: [
          {
            version: '1.0.0',
            s3Path: 'specs/user/spec/1.0.0',
            hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000001',
            publishedAt: '2024-01-01T00:00:00Z',
          },
        ],
      });
    }),
  );

  const result = await getSpec('user', 'spec');
  expect(result.username).toBe('user');
});

it('should reject manifest with invalid hash format', async () => {
  const invalidManifest = {
    name: 'test',
    version: '1.0.0',
    files: ['test.md'],
    hash: 'invalid-hash', // Wrong format
    deps: {},
  };

  const result = ManifestSchema.safeParse(invalidManifest);
  expect(result.success).toBe(false);
});
```

### Why MSW Instead of Overriding fetch

- ✅ **Type-safe**: Full TypeScript support with proper types
- ✅ **Realistic**: Intercepts at the network level, just like real requests
- ✅ **Maintainable**: Clean, declarative API for defining mocks
- ✅ **Reliable**: Industry standard used by major projects
- ✅ **Flexible**: Easy to test different scenarios (success, errors, timeouts)
- ❌ **Never override `global.fetch`**: Fragile, hard to maintain, breaks easily

````

## Immediate Action Required

**All code that currently uses type casting for external data must be refactored:**

1. Identify all instances of `as SomeType` for external data
2. Replace with proper Zod validation using `.safeParse()`
3. Add appropriate error handling
4. Add tests for validation failures

## Code Review Checklist

Before merging any PR that handles external data:

- [ ] All API responses validated with Zod schemas
- [ ] All downloaded files validated with Zod schemas
- [ ] No type casting (`as Type`) for external data
- [ ] Proper error messages for validation failures
- [ ] Tests cover validation failure cases
- [ ] Schemas are properly typed with `z.infer<typeof Schema>`

## Examples of What Needs Fixing

### Current Code (WRONG)
```typescript
const manifest = (await response.json()) as Manifest;
````

### Fixed Code (CORRECT)

```typescript
const data = await response.json();
const parseResult = ManifestSchema.safeParse(data);

if (!parseResult.success) {
  throw new CLIError(
    `Invalid manifest: ${parseResult.error.issues[0].message}`,
    ExitCode.VALIDATION_ERROR,
  );
}

const manifest = parseResult.data;
```

## Priority

This is a **P0 issue** that affects:

- Security
- Reliability
- Production readiness
- User experience (better error messages)

All new code MUST follow this pattern. Existing code should be refactored as soon as possible.
