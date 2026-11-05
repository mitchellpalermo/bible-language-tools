import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STUDY_LABELS, type StudyMode, studyModeProblems, studyNavChildren } from './study-modes';

const mode = (href: string, label: string): StudyMode => ({
  href,
  label,
  description: 'd',
  detail: 'x',
  accentColor: '#000',
  bgColor: '#fff',
  icon: '<svg/>',
});

const LAYOUT = 'children: studyNavChildren(studyModes)';
const HUB = '{studyModes.map(({ href }) => <a href={href} />)}';

function pagesDir(...files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'pages-'));
  for (const f of files) {
    mkdirSync(join(dir, f, '..'), { recursive: true });
    writeFileSync(join(dir, f), '');
  }
  return dir;
}

describe('studyNavChildren', () => {
  it('lists the app’s own entries first, then each mode', () => {
    const children = studyNavChildren(
      [mode('/flashcards', 'Flashcards'), mode('/paradigms', 'Paradigms')],
      [{ href: '/today', label: 'Today' }],
    );
    expect(children).toEqual([
      { href: '/today', label: 'Today' },
      { href: '/flashcards', label: 'Flashcards' },
      { href: '/paradigms', label: 'Paradigms' },
    ]);
  });

  it('passes only href and label to the nav', () => {
    expect(studyNavChildren([mode('/parse', 'Parse')])).toEqual([
      { href: '/parse', label: 'Parse' },
    ]);
  });
});

describe('studyModeProblems', () => {
  const sources = (dir: string) => ({ layoutSource: LAYOUT, studyPageSource: HUB, pagesDir: dir });

  it('is empty for modes that are wired, named and have pages', () => {
    const dir = pagesDir('flashcards.astro', 'parse/index.astro');
    const modes = [mode('/flashcards', 'Flashcards'), mode('/parse', 'Parse')];
    expect(studyModeProblems(modes, sources(dir))).toEqual([]);
  });

  it('reports an empty list', () => {
    expect(studyModeProblems([], sources(pagesDir()))).toEqual(['no study modes are listed']);
  });

  it('reports a nav that is not built from the list', () => {
    const dir = pagesDir('flashcards.astro');
    const problems = studyModeProblems([mode('/flashcards', 'Flashcards')], {
      ...sources(dir),
      layoutSource: "children: [{ href: '/flashcards', label: 'Flashcards' }]",
    });
    expect(problems).toEqual([
      'Layout.astro does not build the Study nav children from studyModes',
    ]);
  });

  it('reports a hub that is not built from the list', () => {
    const dir = pagesDir('flashcards.astro');
    const problems = studyModeProblems([mode('/flashcards', 'Flashcards')], {
      ...sources(dir),
      studyPageSource: '<a href="/flashcards">Flashcards</a>',
    });
    expect(problems).toEqual(['study.astro does not draw a card for each of studyModes']);
  });

  it('reports a duplicate and a mode with no page', () => {
    const dir = pagesDir('flashcards.astro');
    const problems = studyModeProblems(
      [mode('/flashcards', 'Flashcards'), mode('/flashcards', 'Flashcards'), mode('/gone', 'Gone')],
      sources(dir),
    );
    expect(problems).toContain('/flashcards is listed twice');
    expect(problems).toContain(`/gone has no page in ${dir}`);
  });

  it('reports a shared mode that has drifted from its agreed name', () => {
    const dir = pagesDir('paradigms.astro');
    const problems = studyModeProblems([mode('/paradigms', 'Paradigm Quiz')], sources(dir));
    expect(problems).toEqual([
      '/paradigms is labelled "Paradigm Quiz", both apps call it "Paradigms"',
    ]);
  });

  it('lets an app-only mode choose its own name', () => {
    const dir = pagesDir('accent.astro');
    expect(studyModeProblems([mode('/accent', 'Accent Shift')], sources(dir))).toEqual([]);
  });

  it('reports a card with nothing to show', () => {
    const dir = pagesDir('flashcards.astro');
    const blank = { ...mode('/flashcards', 'Flashcards'), description: ' ', icon: '' };
    expect(studyModeProblems([blank], sources(dir))).toEqual([
      '/flashcards has an empty description',
      '/flashcards has an empty icon',
    ]);
  });

  it('names the modes both apps share', () => {
    expect(Object.keys(STUDY_LABELS).sort()).toEqual(['/flashcards', '/paradigms', '/parse']);
  });
});
