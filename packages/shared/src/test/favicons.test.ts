import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { faviconProblems, iconHrefs } from './favicons';

const FULL = `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="stylesheet" href="/x.css" />`;

function publicDirWith(...files: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'favicons-'));
  for (const f of files) writeFileSync(join(dir, f), '');
  return dir;
}

describe('iconHrefs', () => {
  it('lists icon links and ignores other links', () => {
    expect(iconHrefs(FULL)).toEqual(['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png']);
  });
});

describe('faviconProblems', () => {
  it('passes when every icon is declared and present', () => {
    const dir = publicDirWith('favicon.svg', 'favicon.ico', 'apple-touch-icon.png');
    expect(faviconProblems(FULL, dir)).toEqual([]);
  });

  it('reports a declared icon whose file is missing', () => {
    const dir = publicDirWith('favicon.svg', 'apple-touch-icon.png');
    expect(faviconProblems(FULL, dir)).toEqual([expect.stringContaining('/favicon.ico')]);
  });

  it('reports icons that are never declared', () => {
    const dir = publicDirWith('favicon.svg');
    const src = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
    expect(faviconProblems(src, dir)).toEqual(['no /favicon.ico link', 'no apple-touch-icon link']);
  });
});
