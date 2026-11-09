import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // capture.test.ts launches a real browser.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        // Process and git glue: they spawn dev servers, create worktrees and
        // push branches. Exercised by running `pnpm shots` / `pnpm checks`,
        // not by unit tests; every decision they act on lives in a tested
        // module beside them.
        'src/shots-cli.ts',
        'src/checks-cli.ts',
        'src/dev-server.ts',
        'src/git.ts',
        // Runs inside the browser, where Node's V8 coverage cannot see it.
        // capture.test.ts runs every function in it in a real Chromium.
        'src/in-page.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
