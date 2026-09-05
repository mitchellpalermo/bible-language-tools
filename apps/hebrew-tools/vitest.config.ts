import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // `scripts/lib` holds the pure parsing behind `build-morphhb.mjs` — the build
    // script itself is only fetch and write, so everything worth testing is here.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/lib/**/*.{test,spec}.mjs'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}', 'scripts/lib/**/*.mjs'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/pages/**', 'src/layouts/**', 'src/env.d.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
  },
});
