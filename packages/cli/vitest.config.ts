import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    // Keep isolate: true for CLI tests due to module mocking (@inquirer/prompts)
    isolate: true,
    fileParallelism: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/.spectrl/**'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
