import { describe, expect, it } from 'vitest';
import { CHECKS, type Check, selectChecks } from './check-list.ts';

const ids = (checks: Check[]) => checks.map((c) => c.id);

describe('selectChecks', () => {
  it('defaults to the data checks, with the corpus they read first', () => {
    expect(ids(selectChecks([]))).toEqual([
      'hebrew:corpus',
      'hebrew:tests',
      'hebrew:vocab',
      'hebrew:morph-codes',
      'hebrew:verses',
      'hebrew:pins',
    ]);
  });

  it('pulls in what a single check needs', () => {
    expect(ids(selectChecks(['hebrew:vocab']))).toEqual(['hebrew:corpus', 'hebrew:vocab']);
  });

  it('keeps list order however the names are given', () => {
    expect(ids(selectChecks(['greek:typecheck', 'lint']))).toEqual(['lint', 'greek:typecheck']);
  });

  it('runs the corpus gate with CI set, so a missing corpus fails instead of skipping', () => {
    const tests = CHECKS.find((c) => c.id === 'hebrew:tests');
    expect(tests?.env).toEqual({ CI: '1' });
    expect(tests?.needs).toContain('hebrew:corpus');
  });

  it('ci is every check except the ones no workflow runs', () => {
    const ci = ids(selectChecks(['ci']));
    expect(ci).toContain('hebrew:tests');
    expect(ci).toContain('shared:tests');
    expect(ci).not.toContain('hebrew:pins');
    expect(ci).not.toContain('hebrew:vocab');
  });

  it('has a group per app', () => {
    expect(ids(selectChecks(['greek']))).toEqual(['greek:tests', 'greek:typecheck']);
    expect(ids(selectChecks(['shared']))).toEqual(['shared:tests', 'shared:typecheck']);
    expect(selectChecks(['hebrew']).every((c) => c.id.startsWith('hebrew:'))).toBe(true);
    expect(selectChecks(['all'])).toHaveLength(CHECKS.length);
  });

  it('refuses an unknown name instead of running less than asked', () => {
    expect(() => selectChecks(['hebrew:vocabulary'])).toThrow(
      /Unknown check or group: hebrew:vocabulary/,
    );
  });

  it('refuses a need that does not exist, or a loop', () => {
    const run = ['true'];
    expect(() => selectChecks(['a'], [{ id: 'a', title: '', command: run, needs: ['z'] }])).toThrow(
      /needs unknown check "z"/,
    );
    expect(() =>
      selectChecks(
        ['a'],
        [
          { id: 'a', title: '', command: run, needs: ['b'] },
          { id: 'b', title: '', command: run, needs: ['a'] },
        ],
      ),
    ).toThrow(/loop: a → b → a/);
  });

  it('gives every check a unique id and only real needs', () => {
    const all = new Set(ids(CHECKS));
    expect(all.size).toBe(CHECKS.length);
    for (const c of CHECKS) for (const n of c.needs ?? []) expect(all.has(n)).toBe(true);
  });
});
