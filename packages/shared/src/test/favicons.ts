import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ICON_RELS = new Set(['icon', 'shortcut icon', 'apple-touch-icon']);

/** The `href` of every icon `<link>` in a layout's source. */
export function iconHrefs(layoutSource: string): string[] {
  const hrefs: string[] = [];
  for (const [tag] of layoutSource.matchAll(/<link\b[^>]*>/g)) {
    const rel = /\brel="([^"]*)"/.exec(tag)?.[1];
    const href = /\bhref="([^"]*)"/.exec(tag)?.[1];
    if (rel && href && ICON_RELS.has(rel)) hrefs.push(href);
  }
  return hrefs;
}

/**
 * Problems with a layout's icons: a declared icon with no file in `publicDir`,
 * or no `/favicon.ico`. Browsers that skip the SVG `<link>` (Safari, a cached
 * tab, an error page) request `/favicon.ico` unprompted, so it must be both
 * declared and the app's own: a leftover starter icon showed the Astro logo on
 * greek.tools (Nov 2026) while hebrew.tools had none at all.
 */
export function faviconProblems(layoutSource: string, publicDir: string): string[] {
  const hrefs = iconHrefs(layoutSource);
  const problems = hrefs
    .filter((h) => h.startsWith('/') && !existsSync(join(publicDir, h)))
    .map((h) => `${h} is declared but missing from ${publicDir}`);
  if (!hrefs.includes('/favicon.ico')) problems.push('no /favicon.ico link');
  if (!hrefs.includes('/favicon.svg')) problems.push('no /favicon.svg link');
  if (!hrefs.includes('/apple-touch-icon.png')) problems.push('no apple-touch-icon link');
  return problems;
}
