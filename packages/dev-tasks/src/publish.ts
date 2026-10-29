/** The PR-body markdown for a set of captured screenshots. */

import { VIEWPORTS, type ViewportName } from './shot-list.ts';

const FILE = /^(.+)-(mobile|desktop)-(before|after)\.png$/;

interface Row {
  shot: string;
  viewport: ViewportName;
  before?: string;
  after?: string;
}

/** Group `<shot>-<viewport>-<label>.png` files into before/after rows. */
export function groupShots(files: string[]): Row[] {
  const rows = new Map<string, Row>();
  for (const f of [...files].sort()) {
    const m = f.match(FILE);
    if (!m) continue;
    const [, shot, viewport, label] = m as [string, string, ViewportName, 'before' | 'after'];
    const key = `${shot}|${viewport}`;
    const row = rows.get(key) ?? { shot, viewport };
    row[label] = f;
    rows.set(key, row);
  }
  // Mobile first within a shot, as the PR template reads top to bottom.
  return [...rows.values()].sort(
    (a, b) =>
      a.shot.localeCompare(b.shot) || VIEWPORTS[a.viewport].width - VIEWPORTS[b.viewport].width,
  );
}

export function rawUrl(repo: string, pr: number, file: string): string {
  return `https://raw.githubusercontent.com/${repo}/assets/pr-${pr}/${file}`;
}

/** A table with a Before column only when some shot has a "before". */
export function screenshotsMarkdown(files: string[], repo: string, pr: number): string {
  const rows = groupShots(files);
  if (rows.length === 0) return '';
  const hasBefore = rows.some((r) => r.before);
  const img = (f: string | undefined, alt: string) =>
    f ? `<img src="${rawUrl(repo, pr, f)}" alt="${alt}" width="400">` : '—';
  const head = hasBefore
    ? '| Shot | Before | After |\n|---|---|---|'
    : '| Shot | Screenshot |\n|---|---|';
  const body = rows.map((r) => {
    const name = `${r.shot} (${r.viewport}, ${VIEWPORTS[r.viewport].width}px)`;
    return hasBefore
      ? `| ${name} | ${img(r.before, `${name} before`)} | ${img(r.after, `${name} after`)} |`
      : `| ${name} | ${img(r.after, name)} |`;
  });
  return ['## Screenshots', '', head, ...body].join('\n');
}
