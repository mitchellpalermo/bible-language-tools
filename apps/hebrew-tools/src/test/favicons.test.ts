import { readFileSync } from 'node:fs';
import { faviconProblems } from '@tools/shared/test/favicons';
import { describe, expect, it } from 'vitest';

// Vitest runs from the app directory, so paths are relative to it.
describe('Layout icons', () => {
  it('declares an icon, apple-touch-icon and /favicon.ico, all present in public/', () => {
    const layout = readFileSync('src/layouts/Layout.astro', 'utf8');
    expect(faviconProblems(layout, 'public')).toEqual([]);
  });
});
