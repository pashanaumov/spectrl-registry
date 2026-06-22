#!/usr/bin/env node
/**
 * Script to compute hashes for test fixtures
 * Run with: bun run packages/examples/scripts/compute-hashes.ts
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeHash } from '../../core/dist/hasher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures/specs');

async function computeSpecHash(specName: string): Promise<string> {
  const specDir = join(FIXTURES_DIR, specName);

  // Read manifest
  const manifestPath = join(specDir, 'spectrl.json');
  const manifestData = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestData);

  // Read all files
  const fileContents: Record<string, string> = {};
  for (const filePath of manifest.files) {
    const fullPath = join(specDir, filePath);
    const content = await readFile(fullPath, 'utf-8');
    fileContents[filePath] = content;
  }

  // Compute hash
  return computeHash({ manifest, fileContents });
}

async function main() {
  console.log('Computing hashes for test fixtures...\n');

  const specs = ['base-spec', 'app-spec', 'lib-spec'];

  for (const spec of specs) {
    const hash = await computeSpecHash(spec);
    console.log(`${spec}: ${hash}`);
  }
}

main().catch(console.error);
