import { readFileSync } from 'node:fs';
import { studyModeProblems } from '@tools/shared/study-modes';
import { describe, expect, it } from 'vitest';
import { studyModes } from '../lib/study-modes';

// Vitest runs from the app directory, so paths are relative to it.
describe('Study area', () => {
  it('gives every study mode a /study card, a nav child and a page', () => {
    expect(
      studyModeProblems(studyModes, {
        layoutSource: readFileSync('src/layouts/Layout.astro', 'utf8'),
        studyPageSource: readFileSync('src/pages/study.astro', 'utf8'),
        pagesDir: 'src/pages',
      }),
    ).toEqual([]);
  });

  it('keeps Today, which is the routine rather than a mode, in the nav', () => {
    expect(readFileSync('src/layouts/Layout.astro', 'utf8')).toContain(
      "{ href: '/today', label: 'Today' }",
    );
  });
});
