import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    /**
     * Integration `beforeAll` hooks build a whole fixture graph (roles, branches, users, patients,
     * clinical records) over a remote cluster, which regularly exceeds Vitest's 10s hook default —
     * the affected suites then report as failures with every assertion skipped, which reads as a
     * broken fix rather than a slow network. Matches testTimeout's intent.
     */
    hookTimeout: 60000,
    /**
     * Integration suites each get their own database but share one MongoDB server. Running 13
     * files concurrently against a remote (Atlas) cluster exhausts connections and produces
     * failures that move between runs — two identical runs failed 6 then 3 different files.
     * Serialised, the same suites pass 84/84. Correctness over wall-clock: a suite that fails
     * randomly gets ignored, which is worse than one that takes ~75s.
     */
    fileParallelism: false,
  },
});
