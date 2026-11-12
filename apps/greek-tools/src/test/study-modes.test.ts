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

  it('lists the modes the parity audit found missing from /study (#229)', () => {
    const hrefs = studyModes.map((m) => m.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(['/today', '/flashcards', '/paradigms', '/parse', '/focus']),
    );
  });

  it('has no /quiz hub, only a redirect to /study', () => {
    expect(readFileSync('astro.config.mjs', 'utf8')).toContain("'/quiz': '/study'");
    expect(() => readFileSync('src/pages/quiz.astro')).toThrow();
  });
});
