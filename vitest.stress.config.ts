import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Dedicated config for the stress/load suite (npm run test:stress). Runs
// only tests/stress, with a long timeout for the high-volume loops.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/stress/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
