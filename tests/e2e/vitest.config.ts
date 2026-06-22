import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run tests sequentially to match real-world usage (one command at a time)
    fileParallelism: false,
    // Global setup to clean registry once before all tests
    setupFiles: ['./setup.ts'],
  },
});
