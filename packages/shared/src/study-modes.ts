// The Study area, as data both apps render from (#229).
//
// An app lists its study modes once, in `src/lib/study-modes.ts`. The `/study`
// hub draws a card per mode and the nav's Study group takes its children from
// the same list (`studyNavChildren`), so a mode cannot have one without the
// other. `studyModeProblems` is the test that keeps it so, in the way
// `faviconProblems` does for icons.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NavLink } from './nav';

/** One study mode: a card on `/study` and a child of the Study nav group. */
export interface StudyMode {
  href: string;
  /** The nav label and the page's own title. Both apps spell it the same way. */
  label: string;
  description: string;
  /** The small line of keywords above the description. */
  detail: string;
  accentColor: string;
  bgColor: string;
  /** Inline SVG markup. */
  icon: string;
}

export interface StudyModeSources {
  layoutSource: string;
  studyPageSource: string;
  pagesDir: string;
}

/**
 * What each shared mode is called, in both apps. A mode in only one app is not
 * listed here and may be called whatever it likes (hebrew.tools' Accent Shift).
 * Naming it once is what stopped "Paradigms" in the nav and "Paradigm Quiz" on
 * the page from drifting apart again.
 */
export const STUDY_LABELS: Readonly<Record<string, string>> = {
  '/flashcards': 'Flashcards',
  '/paradigms': 'Paradigms',
  '/parse': 'Parse',
  '/focus': 'Focus Passages',
};

/**
 * The nav children for the Study group: `before` first (an app's own entry
 * points that are not modes, like hebrew.tools' Today), then every mode.
 */
export function studyNavChildren(modes: readonly StudyMode[], before: NavLink[] = []): NavLink[] {
  return [...before, ...modes.map(({ href, label }) => ({ href, label }))];
}

/** Whether `src/pages` has a page that serves `href`, as a file or an index file. */
function pageExists(pagesDir: string, href: string): boolean {
  const name = href.replace(/^\//, '');
  return ['.astro', '/index.astro'].some((ext) => existsSync(join(pagesDir, `${name}${ext}`)));
}

/**
 * Problems with an app's study modes. Empty means every mode is reachable
 * from `/study`, from the nav, and from a page that exists, under one name.
 *
 * `layoutSource` and `studyPageSource` are the `.astro` sources: the nav and
 * the hub must each be built from the list, not from a second copy of it that
 * a new mode would have to be added to by hand.
 */
export function studyModeProblems(
  modes: readonly StudyMode[],
  { layoutSource, studyPageSource, pagesDir }: StudyModeSources,
): string[] {
  const problems: string[] = [];
  if (modes.length === 0) problems.push('no study modes are listed');
  if (!/studyNavChildren\(\s*studyModes\b/.test(layoutSource)) {
    problems.push('Layout.astro does not build the Study nav children from studyModes');
  }
  if (!/studyModes\.map\(/.test(studyPageSource)) {
    problems.push('study.astro does not draw a card for each of studyModes');
  }
  const seen = new Set<string>();
  for (const mode of modes) {
    if (seen.has(mode.href)) problems.push(`${mode.href} is listed twice`);
    seen.add(mode.href);
    if (!pageExists(pagesDir, mode.href)) problems.push(`${mode.href} has no page in ${pagesDir}`);
    const expected = STUDY_LABELS[mode.href];
    if (expected && mode.label !== expected) {
      problems.push(`${mode.href} is labelled "${mode.label}", both apps call it "${expected}"`);
    }
    for (const field of ['label', 'description', 'detail', 'icon'] as const) {
      if (!mode[field].trim()) problems.push(`${mode.href} has an empty ${field}`);
    }
  }
  return problems;
}
