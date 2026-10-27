import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        // Pre-existing code that predates test infrastructure in this package
        // (added alongside srs.test.ts, the first consumer to actually need
        // coverage here — see hebrew-tools' Flashcards feature).
        // TODO: add tests and remove from this list as each gets a real consumer
        // (Grammar Reference / Paradigm Quiz).
        //
        // Listed one by one rather than as `src/components/**`: GradeButtons and
        // ToggleSwitch are tested, and a blanket glob would quietly stop
        // counting the next tested component too.
        'src/components/DescriptionBar.tsx',
        'src/components/EndingsToggle.tsx',
        'src/components/NumberToggle.tsx',
        'src/components/SectionHeading.tsx',
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
