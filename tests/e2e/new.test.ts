import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { ManifestSchema } from '@spectrl/schema';
import {
  createTempDir,
  newSpec,
  newContent,
  newTypeWithPromptedName,
  exists,
  readText,
} from './utils/index.js';

/**
 * Strip JSONC comments and trailing commas so we can use JSON.parse.
 */
function parseJsonc(content: string): unknown {
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
  stripped = stripped.replace(/\/\/[^\n]*/g, '');
  stripped = stripped.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(stripped);
}

describe('spectrl new', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  describe('spectrl new <name> (default spec)', () => {
    it('should create directory with spectrl.jsonc and index.md', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      const result = await newSpec(tmpDir, 'my-spec');

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('my-spec');

      // Directory created
      expect(await exists(join(tmpDir, 'my-spec'))).toBe(true);

      // spectrl.jsonc created (not spectrl.json)
      expect(await exists(join(tmpDir, 'my-spec/spectrl.jsonc'))).toBe(true);
      expect(await exists(join(tmpDir, 'my-spec/spectrl.json'))).toBe(false);

      // index.md created
      expect(await exists(join(tmpDir, 'my-spec/index.md'))).toBe(true);
    });

    it('should write a valid JSONC manifest with type "spec"', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newSpec(tmpDir, 'my-spec');

      const jsoncContent = await readText(join(tmpDir, 'my-spec/spectrl.jsonc'));

      // Must be parseable as JSONC
      const parsed = parseJsonc(jsoncContent);
      const result = ManifestSchema.omit({ hash: true })
        .partial({ description: true })
        .safeParse(parsed);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.name).toBe('my-spec');
        expect(result.data.version).toBe('0.1.0');
        expect(result.data.type).toBe('spec');
        expect(result.data.files).toContain('index.md');
      }
    });

    it('should include inline JSONC comments for description and agent fields', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newSpec(tmpDir, 'my-spec');

      const jsoncContent = await readText(join(tmpDir, 'my-spec/spectrl.jsonc'));

      // Must contain comment prompts for required/recommended fields
      expect(jsoncContent).toContain('description');
      expect(jsoncContent).toContain('agent');
      expect(jsoncContent).toContain('//');
    });

    it('should write spec index.md with spec template content', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newSpec(tmpDir, 'my-spec');

      const indexContent = await readText(join(tmpDir, 'my-spec/index.md'));

      // Spec template has Overview section, not "When to Use"
      expect(indexContent).toContain('## Overview');
      expect(indexContent.length).toBeGreaterThan(50);
    });

    it('should respect custom --version flag', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newSpec(tmpDir, 'versioned-spec', '2.0.0');

      const jsoncContent = await readText(join(tmpDir, 'versioned-spec/spectrl.jsonc'));
      const parsed = parseJsonc(jsoncContent) as { version: string };
      expect(parsed.version).toBe('2.0.0');
    });

    it('should error when name contains invalid characters', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      const result = await newSpec(tmpDir, 'My_Invalid Name!');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/lowercase|alphanumeric|invalid/i);
    });

    it('should error when directory already exists', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      // Create it once
      await newSpec(tmpDir, 'duplicate-spec');

      // Try again — should fail
      const result = await newSpec(tmpDir, 'duplicate-spec');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('duplicate-spec');
    });
  });

  describe('spectrl new spec <name> (positional type)', () => {
    it('should create a spec with explicit positional type', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      const result = await newContent(tmpDir, 'explicit-spec', 'spec');

      expect(result.exitCode).toBe(0);
      expect(await exists(join(tmpDir, 'explicit-spec/spectrl.jsonc'))).toBe(true);
      expect(await exists(join(tmpDir, 'explicit-spec/index.md'))).toBe(true);

      const jsoncContent = await readText(join(tmpDir, 'explicit-spec/spectrl.jsonc'));
      const parsed = parseJsonc(jsoncContent) as { type: string };
      expect(parsed.type).toBe('spec');
    });
  });

  describe('spectrl new power <name> (positional type)', () => {
    it('should create directory with spectrl.jsonc and index.md', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      const result = await newContent(tmpDir, 'my-power', 'power');

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('my-power');

      // Directory created
      expect(await exists(join(tmpDir, 'my-power'))).toBe(true);

      // spectrl.jsonc created (not spectrl.json)
      expect(await exists(join(tmpDir, 'my-power/spectrl.jsonc'))).toBe(true);
      expect(await exists(join(tmpDir, 'my-power/spectrl.json'))).toBe(false);

      // index.md created
      expect(await exists(join(tmpDir, 'my-power/index.md'))).toBe(true);
    });

    it('should write a valid JSONC manifest with type "power"', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newContent(tmpDir, 'my-power', 'power');

      const jsoncContent = await readText(join(tmpDir, 'my-power/spectrl.jsonc'));

      const parsed = parseJsonc(jsoncContent);
      const result = ManifestSchema.omit({ hash: true })
        .partial({ description: true })
        .safeParse(parsed);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.name).toBe('my-power');
        expect(result.data.version).toBe('0.1.0');
        expect(result.data.type).toBe('power');
        expect(result.data.files).toContain('index.md');
      }
    });

    it('should include inline JSONC comments for description and agent fields', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newContent(tmpDir, 'my-power', 'power');

      const jsoncContent = await readText(join(tmpDir, 'my-power/spectrl.jsonc'));

      expect(jsoncContent).toContain('description');
      expect(jsoncContent).toContain('agent');
      expect(jsoncContent).toContain('//');
    });

    it('should write power index.md with "When to Use" template', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newContent(tmpDir, 'my-power', 'power');

      const indexContent = await readText(join(tmpDir, 'my-power/index.md'));

      // Power template has "When to Use" section
      expect(indexContent).toContain('## When to Use');
      expect(indexContent).toContain('## Instructions');
      expect(indexContent.length).toBeGreaterThan(50);
    });

    it('should respect custom --version flag', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newContent(tmpDir, 'versioned-power', 'power', '1.2.0');

      const jsoncContent = await readText(join(tmpDir, 'versioned-power/spectrl.jsonc'));
      const parsed = parseJsonc(jsoncContent) as { version: string };
      expect(parsed.version).toBe('1.2.0');
    });

    it('should error when name contains invalid characters', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      const result = await newContent(tmpDir, 'Bad_Power Name', 'power');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/lowercase|alphanumeric|invalid/i);
    });

    it('should error when directory already exists', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newContent(tmpDir, 'duplicate-power', 'power');
      const result = await newContent(tmpDir, 'duplicate-power', 'power');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('duplicate-power');
    });
  });

  describe('spectrl new power (interactive name prompt)', () => {
    it('should prompt for name when only type is provided', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      const result = await newTypeWithPromptedName(tmpDir, 'power', 'prompted-power');

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('prompted-power');

      expect(await exists(join(tmpDir, 'prompted-power'))).toBe(true);
      expect(await exists(join(tmpDir, 'prompted-power/spectrl.jsonc'))).toBe(true);
      expect(await exists(join(tmpDir, 'prompted-power/index.md'))).toBe(true);

      const jsoncContent = await readText(join(tmpDir, 'prompted-power/spectrl.jsonc'));
      const parsed = parseJsonc(jsoncContent) as { type: string; name: string };
      expect(parsed.type).toBe('power');
      expect(parsed.name).toBe('prompted-power');
    });

    it('should create power index.md with instruction template', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newTypeWithPromptedName(tmpDir, 'power', 'template-power');

      const indexContent = await readText(join(tmpDir, 'template-power/index.md'));
      expect(indexContent).toContain('## When to Use');
      expect(indexContent).toContain('## Instructions');
    });
  });

  describe('spectrl new spec (interactive name prompt)', () => {
    it('should prompt for name when only type is provided', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      const result = await newTypeWithPromptedName(tmpDir, 'spec', 'prompted-spec');

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('prompted-spec');

      expect(await exists(join(tmpDir, 'prompted-spec'))).toBe(true);
      expect(await exists(join(tmpDir, 'prompted-spec/spectrl.jsonc'))).toBe(true);

      const jsoncContent = await readText(join(tmpDir, 'prompted-spec/spectrl.jsonc'));
      const parsed = parseJsonc(jsoncContent) as { type: string; name: string };
      expect(parsed.type).toBe('spec');
      expect(parsed.name).toBe('prompted-spec');
    });

    it('should create spec index.md with overview template', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      await newTypeWithPromptedName(tmpDir, 'spec', 'template-spec');

      const indexContent = await readText(join(tmpDir, 'template-spec/index.md'));
      expect(indexContent).toContain('## Overview');
      expect(indexContent).toContain('## Quality Checklist');
    });
  });

  describe('new → publish integration', () => {
    it('should scaffold a spec that can be published after adding description', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      // Scaffold
      await newContent(tmpDir, 'publishable-spec', 'spec');

      const specDir = join(tmpDir, 'publishable-spec');

      // The scaffolded JSONC has description commented out — publish should fail
      const { publish } = await import('./utils/index.js');
      const failResult = await publish(specDir);
      expect(failResult.exitCode).not.toBe(0);
      expect(failResult.stderr).toMatch(/description/i);
    });

    it('should scaffold a power that can be published after adding description', async () => {
      const { path: tmpDir, cleanup: cleanupFn } = await createTempDir();
      cleanup = cleanupFn;

      // Scaffold
      await newContent(tmpDir, 'publishable-power', 'power');

      const powerDir = join(tmpDir, 'publishable-power');

      // The scaffolded JSONC has description commented out — publish should fail
      const { publish, writeText } = await import('./utils/index.js');
      const failResult = await publish(powerDir);
      expect(failResult.exitCode).not.toBe(0);
      expect(failResult.stderr).toMatch(/description/i);

      // Add description by replacing the JSONC with a valid one
      await writeText(
        join(powerDir, 'spectrl.jsonc'),
        `{
  "name": "publishable-power",
  "version": "0.1.0",
  "type": "power",
  "description": "A publishable power for testing",
  "files": ["index.md"],
  "deps": {}
}
`,
      );

      const successResult = await publish(powerDir);
      expect(successResult.exitCode).toBe(0);
      expect(successResult.stdout).toContain('publishable-power');
    });
  });
});
