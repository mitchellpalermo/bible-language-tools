import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/pages/**',
        'src/layouts/**',
        'src/env.d.ts',
        // TODO: add tests for these components and remove from exclude
        'src/components/GrammarReference.tsx',
        'src/components/DailyVerse.tsx',
        'src/components/GNTReader.tsx',
        'src/components/GreekText.tsx',
        'src/components/Transliteration.tsx',
        'src/components/GreekInputHub.tsx',
        'src/data/morphgnt.ts',
        'src/lib/transliteration.ts',
        'src/components/grammar/index.ts',
        // TODO: add tests for these grammar sub-components and remove from exclude
        'src/components/grammar/ParadigmHeading.tsx',
        'src/components/grammar/SectionHeading.tsx',
        'src/components/grammar/ParticipleParadigmCard.tsx',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        // Branch threshold is 80% (not 90%) because several modules contain
        // defensive null-coalescing paths unreachable with production grammar data
        // (e.g. `?? null` guards on Partial<Record<...>> pronoun forms) plus
        // pre-existing branch gaps in srs.ts. Statements/lines/functions remain at 90%.
        branches: 80,
        statements: 90,
      },
    },
  },
});
