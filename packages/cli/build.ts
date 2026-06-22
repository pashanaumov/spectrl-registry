import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import { config } from 'dotenv';

// Load production environment variables for build
config({ path: '.env.production', quiet: true });

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
}
fs.mkdirSync('dist', { recursive: true });

console.log('Building CLI with esbuild...\n');

// Get API URL from environment (loaded from .env.production)
const defaultApiUrl = process.env.DEFAULT_API_URL || '';

if (defaultApiUrl) {
  console.log(`✓ Using default API URL: ${defaultApiUrl}`);
} else {
  console.log('⚠ No default API URL set - will require API_URL environment variable at runtime');
}

try {
  await esbuild.build({
    entryPoints: ['src/entry.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: 'dist/cli.js',
    format: 'esm',
    external: [
      // Keep external dependencies that users will install
      '@inquirer/prompts',
      'chalk',
      'cmd-ts',
      'fs-extra',
      'ora',
      'keytar',
      'node-machine-id',
      'dotenv', // Keep dotenv external for runtime .env file support
    ],
    // jsonc-parser uses CJS dynamic require() internally; inject a require shim
    // so those calls work when bundled into an ESM output file.
    banner: {
      js: [
        "import { createRequire as __createRequire } from 'node:module';",
        'const require = __createRequire(import.meta.url);',
        // Ensure chalk detects color support correctly in the bundled binary
        "if (process.stdout.isTTY && !process.env.NO_COLOR) process.env.FORCE_COLOR = process.env.FORCE_COLOR || '3';",
      ].join('\n'),
    },
    sourcemap: false,
    minify: true,
    treeShaking: true,
    logLevel: 'info',
    define: {
      // Replace all occurrences of process.env.DEFAULT_API_URL in the bundled code
      // with this literal string value; JSON.stringify ensures it is injected as a
      // proper quoted string at build time.
      'process.env.DEFAULT_API_URL': JSON.stringify(defaultApiUrl),
    },
  });

  console.log('\n✓ CLI built successfully');

  // Make executable
  await fs.promises.chmod('dist/cli.js', 0o755);
  console.log('✓ Made cli.js executable');
} catch (error) {
  console.error('✗ Build failed:', error);
  process.exit(1);
}
