import { afterEach, describe, expect, it } from 'vitest';
import {
  countSession,
  createStudyStreak,
  currentStudyStreak,
  emptyStudyStreak,
  mergeStudyStreak,
  parseStudyStreak,
  studiedToday,
} from './study-streak';

// Local dates, built the way the app builds them (never toISOString).
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('countSession', () => {
  it('starts at 1', () => {
    expect(countSession(emptyStudyStreak(), at(2026, 11, 2))).toEqual({
      streak: 1,
      lastSessionDate: '2026-11-02',
    });
  });

  it('extends from yesterday, across a month end', () => {
    expect(countSession({ streak: 4, lastSessionDate: '2026-10-31' }, at(2026, 11, 1))).toEqual({
      streak: 5,
      lastSessionDate: '2026-11-01',
    });
  });

  it('is idempotent within a day', () => {
    const prev = { streak: 3, lastSessionDate: '2026-11-02' };
    expect(countSession(prev, at(2026, 11, 2, 23))).toBe(prev);
  });

  it('restarts at 1 after a gap', () => {
    expect(countSession({ streak: 9, lastSessionDate: '2026-10-30' }, at(2026, 11, 2)).streak).toBe(
      1,
    );
  });

  it('uses the local day, so a late evening is still today', () => {
    const late = at(2026, 11, 2, 23);
    expect(countSession(emptyStudyStreak(), late).lastSessionDate).toBe('2026-11-02');
  });
});

describe('currentStudyStreak and studiedToday', () => {
  const data = { streak: 6, lastSessionDate: '2026-11-01' };

  it('holds through yesterday', () => {
    expect(currentStudyStreak(data, at(2026, 11, 1))).toBe(6);
    expect(currentStudyStreak(data, at(2026, 11, 2))).toBe(6);
  });

  it('reads 0 once broken', () => {
    expect(currentStudyStreak(data, at(2026, 11, 3))).toBe(0);
  });

  it('knows whether today is done', () => {
    expect(studiedToday(data, at(2026, 11, 1))).toBe(true);
    expect(studiedToday(data, at(2026, 11, 2))).toBe(false);
  });
});

describe('mergeStudyStreak', () => {
  const old = { streak: 40, lastSessionDate: '2026-09-01' };
  const recent = { streak: 2, lastSessionDate: '2026-11-02' };

  it('picks by date, not by number', () => {
    expect(mergeStudyStreak(old, recent)).toEqual(recent);
  });

  it('takes the longer streak on the same date', () => {
    const other = { streak: 5, lastSessionDate: '2026-11-02' };
    expect(mergeStudyStreak(recent, other)).toEqual(other);
  });

  it('keeps a real streak over a never-synced empty one', () => {
    expect(mergeStudyStreak(emptyStudyStreak(), recent)).toEqual(recent);
  });

  it('is symmetric', () => {
    const cases = [old, recent, emptyStudyStreak(), { streak: 7, lastSessionDate: '2026-11-02' }];
    for (const a of cases) {
      for (const b of cases) expect(mergeStudyStreak(a, b)).toEqual(mergeStudyStreak(b, a));
    }
  });
});

describe('parseStudyStreak', () => {
  it('accepts the stored shape', () => {
    expect(parseStudyStreak({ streak: 2, lastSessionDate: '2026-11-02' })).toEqual({
      streak: 2,
      lastSessionDate: '2026-11-02',
    });
    expect(parseStudyStreak({ streak: 0, lastSessionDate: '' })).toEqual(emptyStudyStreak());
  });

  it.each([
    null,
    'x',
    { streak: -1, lastSessionDate: '' },
    { streak: 1.5, lastSessionDate: '' },
    { streak: 1, lastSessionDate: 'yesterday' },
    { streak: 1 },
  ])('rejects %j', (v) => {
    expect(parseStudyStreak(v)).toBeNull();
  });
});

describe('createStudyStreak', () => {
  const KEY = 'test-study-streak';
  const { loadStudyStreak, markSessionComplete, saveStudyStreak } = createStudyStreak(KEY);

  afterEach(() => localStorage.clear());

  it('reads empty when nothing or garbage is stored', () => {
    expect(loadStudyStreak()).toEqual(emptyStudyStreak());
    localStorage.setItem(KEY, '{not json');
    expect(loadStudyStreak()).toEqual(emptyStudyStreak());
  });

  it('marks, saves and reloads', () => {
    const marked = markSessionComplete(at(2026, 11, 2));
    expect(marked).toEqual({ streak: 1, lastSessionDate: '2026-11-02' });
    expect(loadStudyStreak()).toEqual(marked);
    expect(markSessionComplete(at(2026, 11, 3)).streak).toBe(2);
  });

  it('keeps apps apart by key', () => {
    saveStudyStreak({ streak: 3, lastSessionDate: '2026-11-02' });
    expect(createStudyStreak('other-key').loadStudyStreak()).toEqual(emptyStudyStreak());
  });
});
