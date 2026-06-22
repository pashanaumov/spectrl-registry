import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@spectrl/schema': resolve(__dirname, '../schema/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'threads',
    isolate: false,
    fileParallelism: true,
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
