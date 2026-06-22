import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { mkdir, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { newContent, newSpec } from './index.js';
import { CLIError, ExitCode } from '../../errors.js';
import { parseJsoncString } from '@spectrl/core';

// Arbitrary for valid spec/power names
const validNameArb = fc
  .stringMatching(/^[a-z0-9-]+$/)
  .filter((s) => s.length > 0 && s.length <= 50);

const typeArb = fc.constantFrom('spec' as const, 'power' as const);

describe('new command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `spectrl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // Property 4: Scaffold output correctness
  // For any valid name and type, the scaffold produces:
  //   - spectrl.jsonc with correct type, name, version, files: ["index.md"]
  //   - index.md that exists
  //   - JSONC content with inline comments about description and agent fields
  // Validates: Requirements 2.1, 2.2, 2.3, 2.6, 5.3, 8.1
  // ---------------------------------------------------------------------------
  describe('Property 4: Scaffold output correctness', () => {
    it('should produce correct spectrl.jsonc and index.md for any valid name and type', async () => {
      await fc.assert(
        fc.asyncProperty(validNameArb, typeArb, async (name, type) => {
          // Use a fresh subdirectory per run to avoid collisions
          const runDir = join(
            testDir,
            `run-${name}-${type}-${Math.random().toString(36).slice(2)}`,
          );
          await mkdir(runDir, { recursive: true });

          await newContent(name, runDir, type);

          const contentDir = join(runDir, name);

          // spectrl.jsonc must exist
          const manifestPath = join(contentDir, 'spectrl.jsonc');
          await expect(access(manifestPath)).resolves.toBeUndefined();

          // spectrl.json must NOT exist (we write .jsonc now)
          const legacyPath = join(contentDir, 'spectrl.json');
          await expect(access(legacyPath)).rejects.toThrow();

          // index.md must exist
          const indexPath = join(contentDir, 'index.md');
          await expect(access(indexPath)).resolves.toBeUndefined();

          // Parse the JSONC manifest
          const raw = await readFile(manifestPath, 'utf-8');
          const manifest = parseJsoncString(raw) as Record<string, unknown>;

          // Correct name, type, version, files
          expect(manifest.name).toBe(name);
          expect(manifest.type).toBe(type);
          expect(manifest.version).toBe('0.1.0');
          expect(manifest.files).toEqual(['index.md']);

          // Inline comments about description and agent must be present
          expect(raw).toContain('description');
          expect(raw).toContain('agent');
        }),
        { numRuns: 20 },
      );
    });

    it('power index.md should contain instruction template sections and checklist', async () => {
      await fc.assert(
        fc.asyncProperty(validNameArb, async (name) => {
          const runDir = join(testDir, `power-${name}-${Math.random().toString(36).slice(2)}`);
          await mkdir(runDir, { recursive: true });

          await newContent(name, runDir, 'power');

          const indexContent = await readFile(join(runDir, name, 'index.md'), 'utf-8');
          expect(indexContent).toContain('When to Use');
          expect(indexContent).toContain('Instructions');
          expect(indexContent).toContain('Quality Checklist');
        }),
        { numRuns: 10 },
      );
    });

    it('spec index.md should contain guidance and checklist', async () => {
      await fc.assert(
        fc.asyncProperty(validNameArb, async (name) => {
          const runDir = join(testDir, `spec-${name}-${Math.random().toString(36).slice(2)}`);
          await mkdir(runDir, { recursive: true });

          await newContent(name, runDir, 'spec');

          const indexContent = await readFile(join(runDir, name, 'index.md'), 'utf-8');
          expect(indexContent).toContain('Overview');
          expect(indexContent).toContain('Quality Checklist');
        }),
        { numRuns: 10 },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Property 5: Invalid name rejection
  // For any string not matching ^[a-z0-9-]+$, scaffold rejects with CLIError
  // Validates: Requirements 2.4
  // ---------------------------------------------------------------------------
  describe('Property 5: Invalid name rejection', () => {
    it('should reject any name not matching ^[a-z0-9-]+$', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter((s) => s.length > 0 && !/^[a-z0-9-]+$/.test(s)),
          typeArb,
          async (invalidName, type) => {
            await expect(newContent(invalidName, testDir, type)).rejects.toThrow(CLIError);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should throw VALIDATION_ERROR exit code for invalid names', async () => {
      const invalidNames = ['MySpec', 'my spec', 'my_spec', 'my@spec', 'MY-SPEC', ''];
      for (const name of invalidNames) {
        if (name === '') continue; // empty string handled separately
        try {
          await newContent(name, testDir, 'spec');
          expect.fail(`Should have thrown for name: ${name}`);
        } catch (error) {
          expect(error).toBeInstanceOf(CLIError);
          expect((error as CLIError).exitCode).toBe(ExitCode.VALIDATION_ERROR);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Unit tests
  // ---------------------------------------------------------------------------
  describe('newContent — spec creation', () => {
    it('should create spectrl.jsonc with type "spec"', async () => {
      await newContent('my-spec', testDir, 'spec');
      const raw = await readFile(join(testDir, 'my-spec', 'spectrl.jsonc'), 'utf-8');
      const manifest = parseJsoncString(raw) as Record<string, unknown>;
      expect(manifest.type).toBe('spec');
    });

    it('should create index.md for spec', async () => {
      await newContent('my-spec', testDir, 'spec');
      await expect(access(join(testDir, 'my-spec', 'index.md'))).resolves.toBeUndefined();
    });

    it('should include files: ["index.md"] in manifest', async () => {
      await newContent('my-spec', testDir, 'spec');
      const raw = await readFile(join(testDir, 'my-spec', 'spectrl.jsonc'), 'utf-8');
      const manifest = parseJsoncString(raw) as Record<string, unknown>;
      expect(manifest.files).toEqual(['index.md']);
    });

    it('should default version to 0.1.0', async () => {
      await newContent('my-spec', testDir, 'spec');
      const raw = await readFile(join(testDir, 'my-spec', 'spectrl.jsonc'), 'utf-8');
      const manifest = parseJsoncString(raw) as Record<string, unknown>;
      expect(manifest.version).toBe('0.1.0');
    });

    it('should use custom version when provided', async () => {
      await newContent('my-spec', testDir, 'spec', '1.2.3');
      const raw = await readFile(join(testDir, 'my-spec', 'spectrl.jsonc'), 'utf-8');
      const manifest = parseJsoncString(raw) as Record<string, unknown>;
      expect(manifest.version).toBe('1.2.3');
    });
  });

  describe('newContent — power creation', () => {
    it('should create spectrl.jsonc with type "power"', async () => {
      await newContent('my-power', testDir, 'power');
      const raw = await readFile(join(testDir, 'my-power', 'spectrl.jsonc'), 'utf-8');
      const manifest = parseJsoncString(raw) as Record<string, unknown>;
      expect(manifest.type).toBe('power');
    });

    it('should create index.md with instruction template for power', async () => {
      await newContent('my-power', testDir, 'power');
      const content = await readFile(join(testDir, 'my-power', 'index.md'), 'utf-8');
      expect(content).toContain('When to Use');
      expect(content).toContain('Instructions');
      expect(content).toContain('Quality Checklist');
    });

    it('should include files: ["index.md"] in power manifest', async () => {
      await newContent('my-power', testDir, 'power');
      const raw = await readFile(join(testDir, 'my-power', 'spectrl.jsonc'), 'utf-8');
      const manifest = parseJsoncString(raw) as Record<string, unknown>;
      expect(manifest.files).toEqual(['index.md']);
    });
  });

  describe('newContent — JSONC comments', () => {
    it('should include commented-out description field', async () => {
      await newContent('my-spec', testDir, 'spec');
      const raw = await readFile(join(testDir, 'my-spec', 'spectrl.jsonc'), 'utf-8');
      expect(raw).toContain('description');
      expect(raw).toContain('//');
    });

    it('should include commented-out agent field', async () => {
      await newContent('my-spec', testDir, 'spec');
      const raw = await readFile(join(testDir, 'my-spec', 'spectrl.jsonc'), 'utf-8');
      expect(raw).toContain('agent');
    });

    it('should be parseable as JSONC despite comments', async () => {
      await newContent('my-spec', testDir, 'spec');
      const raw = await readFile(join(testDir, 'my-spec', 'spectrl.jsonc'), 'utf-8');
      expect(() => parseJsoncString(raw)).not.toThrow();
    });
  });

  describe('directory exists error', () => {
    it('should throw CLIError when directory already exists', async () => {
      await mkdir(join(testDir, 'existing-spec'));
      await expect(newContent('existing-spec', testDir, 'spec')).rejects.toThrow(CLIError);
    });

    it('should include directory name in error message', async () => {
      await mkdir(join(testDir, 'existing-spec'));
      try {
        await newContent('existing-spec', testDir, 'spec');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as CLIError).message).toContain('existing-spec');
        expect((error as CLIError).message).toContain('already exists');
      }
    });
  });

  describe('newSpec backward compat shim', () => {
    it('should create a spec via the deprecated newSpec function', async () => {
      await newSpec('compat-spec', testDir);
      const raw = await readFile(join(testDir, 'compat-spec', 'spectrl.jsonc'), 'utf-8');
      const manifest = parseJsoncString(raw) as Record<string, unknown>;
      expect(manifest.type).toBe('spec');
      expect(manifest.name).toBe('compat-spec');
    });
  });
});
