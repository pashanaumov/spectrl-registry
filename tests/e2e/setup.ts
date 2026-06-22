import { beforeAll } from 'vitest';
import { cleanRegistry } from './utils/index.js';

/**
 * Global setup - clean registry once before all tests
 * This matches real-world usage where specs accumulate over time
 */
beforeAll(async () => {
  await cleanRegistry();
});
