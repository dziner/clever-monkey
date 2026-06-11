import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Stress tests run on demand via `npm run test:stress` — they mutate
    // module-scope singletons (key pool) and run large loops, so they stay
    // out of the fast default unit run.
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/tests/stress/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
