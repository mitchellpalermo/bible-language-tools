import { describe, expect, it } from 'vitest';

import { LEXICON_BASE, TBESH_URL, WLC_BASE } from './sources.mjs';

// Reference data is pinned to a commit so an upstream edit cannot change
// generated output that is never committed. A pin's recorded `tbesh` is only
// meaningful against a fixed TBESH. The corpus deliberately tracks master.
describe('upstream sources', () => {
  const commit = /\/[0-9a-f]{40}\//;

  it('pins the lexicon and TBESH to a commit', () => {
    expect(`${LEXICON_BASE}/`).toMatch(commit);
    expect(TBESH_URL).toMatch(commit);
    expect(TBESH_URL).toContain('TBESH');
  });

  it('tracks the corpus on master', () => {
    expect(WLC_BASE).toContain('/master/');
  });
});
