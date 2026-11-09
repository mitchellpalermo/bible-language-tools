/**
 * The checks a capture must pass before its PNG is written. Each one guards a
 * way a screenshot has gone wrong here before (see "Screenshots are required"
 * in the root CLAUDE.md).
 */

import type { App, ViewportName } from './shot-list.ts';

/** Each app's script face, as its global.css names it. */
export const SCRIPT_FONT: Record<App, string> = {
  greek: 'Noto Sans',
  hebrew: 'Noto Sans Hebrew',
};

const SCRIPT_CHARS: Record<App, RegExp> = {
  greek: /[Ͱ-Ͽἀ-῿]/,
  hebrew: /[֐-׿יִ-ﭏ]/,
};

export interface FaceInfo {
  family: string;
  status: string;
  /** The face's CSS `unicode-range`; empty means every code point. */
  unicodeRange: string;
}

/** `U+1F00-1FFF, U+38C, U+4??` → [[start, end], …]. */
export function parseUnicodeRange(range: string): [number, number][] {
  if (range.trim() === '') return [[0, 0x10ffff]];
  return range.split(',').map((part) => {
    const body = part.trim().replace(/^U\+/i, '');
    if (body.includes('?'))
      return [
        Number.parseInt(body.replace(/\?/g, '0'), 16),
        Number.parseInt(body.replace(/\?/g, 'F'), 16),
      ];
    const [start, end = start] = body.split('-');
    return [Number.parseInt(start, 16), Number.parseInt(end, 16)];
  });
}

const sameFamily = (a: string, b: string) =>
  a.replace(/["']/g, '').trim().toLowerCase() === b.toLowerCase();

/**
 * The app's script characters on the page that no *loaded* face of its script
 * font covers. Google Fonts splits a family into files by range — Noto Sans
 * serves basic Greek and polytonic Greek separately from Latin — so "some
 * Noto Sans face loaded" does not mean the Greek ones did.
 */
export function uncoveredChars(app: App, text: string, faces: FaceInfo[]): string[] {
  const ranges = faces
    .filter((f) => f.status === 'loaded' && sameFamily(f.family, SCRIPT_FONT[app]))
    .flatMap((f) => parseUnicodeRange(f.unicodeRange));
  const chars = new Set([...text].filter((c) => SCRIPT_CHARS[app].test(c)));
  return [...chars].filter((c) => {
    const cp = c.codePointAt(0) as number;
    return !ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
  });
}

/**
 * Every page title ends `| greek.tools` or `| hebrew.tools`. The dev server
 * runs on a fresh port, so the other app answering should be impossible; this
 * is the check that proves it, and also catches a page that rendered without
 * the app's layout.
 */
export function titleMatchesApp(app: App, title: string): boolean {
  return title.trim().endsWith(`| ${app}.tools`);
}

export type Label = 'before' | 'after';

export function fileName(shot: string, viewport: ViewportName, label: Label): string {
  return `${shot}-${viewport}-${label}.png`;
}

export const HIDE_DEV_TOOLBAR = 'astro-dev-toolbar { display: none !important; }';
