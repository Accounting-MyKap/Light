import { defineConfig } from 'vitest/config';

// Integration tests talk to the local Supabase stack (`npm run db:start`). They are kept out of the unit-test
// config on purpose: `npm test` never needs Docker.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
    include: ['tests/integration/**/*.int.test.ts'],
    globalSetup: ['./tests/integration/globalSetup.ts'],
    // Every test resets the whole database, so files must never overlap.
    fileParallelism: false,
    // Real network round trips (a percentile test signs in 21 guests).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
