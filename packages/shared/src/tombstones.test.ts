import { describe, expect, it } from 'vitest';
import {
  isIso,
  isLive,
  isRecord,
  mergeTombstoned,
  pruneTombstones,
  stampOf,
  TOMBSTONE_TTL_DAYS,
  type Tombstonable,
} from './tombstones';

const NOW = new Date('2026-11-05T12:00:00.000Z');

const row = (over: Partial<Tombstonable> = {}): Tombstonable => ({
  id: 'a',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const tomb = (over: Partial<Tombstonable> = {}) =>
  row({ updatedAt: '2026-11-03T00:00:00.000Z', deletedAt: '2026-11-03T00:00:00.000Z', ...over });

describe('the small predicates', () => {
  it('reads a row as live until it has deletedAt', () => {
    expect(isLive(row())).toBe(true);
    expect(isLive(tomb())).toBe(false);
  });

  it('stamps a row by its update time, or its creation when it has none', () => {
    expect(stampOf(row())).toBe('2026-11-01T00:00:00.000Z');
    expect(stampOf(row({ updatedAt: undefined }))).toBe('2026-11-01T00:00:00.000Z');
    expect(stampOf(row({ updatedAt: '' }))).toBe('2026-11-01T00:00:00.000Z');
  });

  it('accepts only real ISO dates and plain objects', () => {
    expect(isIso('2026-11-01T00:00:00.000Z')).toBe(true);
    expect(isIso('')).toBe(false);
    expect(isIso('soon')).toBe(false);
    expect(isIso(5)).toBe(false);
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});

describe('mergeTombstoned', () => {
  it('keeps the later change to a row, whole', () => {
    const older = row({ updatedAt: '2026-11-02T00:00:00.000Z' });
    const newer = row({ updatedAt: '2026-11-04T00:00:00.000Z' });
    expect(mergeTombstoned([older], [newer], NOW)).toEqual([newer]);
    expect(mergeTombstoned([newer], [older], NOW)).toEqual([newer]);
  });

  it('lets a deletion beat an earlier edit, and a later edit beat a deletion', () => {
    expect(mergeTombstoned([row()], [tomb()], NOW)).toEqual([tomb()]);
    const edited = row({ updatedAt: '2026-11-04T00:00:00.000Z' });
    expect(mergeTombstoned([tomb()], [edited], NOW)).toEqual([edited]);
  });

  it('lets a deletion win a tie', () => {
    const at = '2026-11-03T00:00:00.000Z';
    expect(mergeTombstoned([row({ updatedAt: at })], [tomb()], NOW)).toEqual([tomb()]);
    expect(mergeTombstoned([tomb()], [row({ updatedAt: at })], NOW)).toEqual([tomb()]);
  });

  it('is symmetric, including when everything else is tied', () => {
    const x = { ...row(), note: 'x' };
    const y = { ...row(), note: 'y' };
    expect(mergeTombstoned([x], [y], NOW)).toEqual(mergeTombstoned([y], [x], NOW));
  });

  it('unions rows each side lacks, sorted by creation then id', () => {
    const early = row({ id: 'z', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: undefined });
    const late = row({ id: 'b', createdAt: '2026-11-02T00:00:00.000Z', updatedAt: undefined });
    const tied = row({ id: 'a', createdAt: '2026-11-02T00:00:00.000Z', updatedAt: undefined });
    expect(mergeTombstoned([late], [early, tied], NOW).map((r) => r.id)).toEqual(['z', 'a', 'b']);
  });
});

describe('pruneTombstones', () => {
  it('drops a tombstone past the TTL and keeps a recent one and every live row', () => {
    const day = 86_400_000;
    const old = tomb({
      id: 'old',
      deletedAt: new Date(NOW.getTime() - (TOMBSTONE_TTL_DAYS + 1) * day).toISOString(),
    });
    const recent = tomb({
      id: 'recent',
      deletedAt: new Date(NOW.getTime() - (TOMBSTONE_TTL_DAYS - 1) * day).toISOString(),
    });
    expect(pruneTombstones([old, recent, row({ id: 'live' })], NOW).map((r) => r.id)).toEqual([
      'recent',
      'live',
    ]);
  });
});
