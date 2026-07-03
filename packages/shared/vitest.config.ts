import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        // Pre-existing code that predates test infrastructure in this package
        // (added alongside srs.test.ts, the first consumer to actually need
        // coverage here — see hebrew-tools' Flashcards feature).
        // TODO: add tests and remove from this list as each gets a real consumer:
        // quiz-settings.ts is for the Paradigm Quiz phase, the components for
        // Grammar Reference / Paradigm Quiz.
        'src/quiz-settings.ts',
        'src/components/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
  },
});
