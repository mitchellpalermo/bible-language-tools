import { describe, expect, it } from 'vitest';
import { emptyStats, type SRSCard, type StudyStats } from './srs';
import { mergeSRSStores, mergeStudyStats } from './sync-merge';

function makeCard(overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    key: 'word',
    interval: 1,
    repetition: 1,
    easeFactor: 2.5,
    dueDate: '2026-05-10',
    lastReviewed: '2026-05-09',
    ...overrides,
  };
}

function stats(overrides: Partial<StudyStats> = {}): StudyStats {
  return { ...emptyStats(), ...overrides };
}

// ─── mergeSRSStores ─────────────────────────────────────────────────────────

describe('mergeSRSStores', () => {
  it('keeps cards that exist on only one side', () => {
    const merged = mergeSRSStores({ a: makeCard({ key: 'a' }) }, { b: makeCard({ key: 'b' }) });
    expect(Object.keys(merged).sort()).toEqual(['a', 'b']);
  });

  it('prefers the higher repetition when both were reviewed on the same date', () => {
    const merged = mergeSRSStores(
      { w: makeCard({ repetition: 2, interval: 6 }) },
      { w: makeCard({ repetition: 5, interval: 30 }) },
    );
    expect(merged.w.repetition).toBe(5);
  });

  it('breaks a same-date repetition tie with the later dueDate', () => {
    const merged = mergeSRSStores(
      { w: makeCard({ repetition: 3, dueDate: '2026-05-10' }) },
      { w: makeCard({ repetition: 3, dueDate: '2026-06-01' }) },
    );
    expect(merged.w.dueDate).toBe('2026-06-01');
  });

  it('keeps a failed review — the lapse is what used to be discarded', () => {
    // The bug: nextSRS resets repetition to 0 on a lapse, so under the old
    // "higher repetition wins" rule a failed card could never beat an earlier
    // state of itself. Fail a mature card on one device, sync, and it came back
    // mature — the reset, the ease penalty and the reschedule all thrown away.
    const mature = makeCard({
      repetition: 5,
      interval: 95,
      easeFactor: 2.5,
      dueDate: '2026-08-12',
      lastReviewed: '2026-05-09',
    });
    const lapsed = makeCard({
      repetition: 0,
      interval: 1,
      easeFactor: 1.96,
      dueDate: '2026-05-21',
      lastReviewed: '2026-05-20',
    });

    expect(mergeSRSStores({ w: lapsed }, { w: mature }).w).toEqual(lapsed);
    expect(mergeSRSStores({ w: mature }, { w: lapsed }).w).toEqual(lapsed);
  });

  it('a stale device cannot undo a review made later elsewhere', () => {
    // Same repetition, but the stale card sits further out because its ease had
    // not yet been knocked down. The old rule tie-broke on the later dueDate and
    // so preferred the stale card; recency is what makes the newer one win.
    const stale = makeCard({ repetition: 3, dueDate: '2026-07-01', lastReviewed: '2026-05-01' });
    const current = makeCard({ repetition: 3, dueDate: '2026-06-15', lastReviewed: '2026-05-20' });

    expect(mergeSRSStores({ w: stale }, { w: current }).w.lastReviewed).toBe('2026-05-20');
    expect(mergeSRSStores({ w: current }, { w: stale }).w.lastReviewed).toBe('2026-05-20');
  });

  it('a never-reviewed card cannot displace real progress', () => {
    const studied = makeCard({ repetition: 4 });
    const fresh = makeCard({ repetition: 0, dueDate: '2026-12-31', lastReviewed: '' });

    expect(mergeSRSStores({ w: studied }, { w: fresh }).w).toEqual(studied);
    expect(mergeSRSStores({ w: fresh }, { w: studied }).w).toEqual(studied);
  });

  it('is symmetric', () => {
    const a = { w: makeCard({ repetition: 3, dueDate: '2026-05-10' }) };
    const b = { w: makeCard({ repetition: 7, dueDate: '2026-06-01' }) };
    expect(mergeSRSStores(a, b)).toEqual(mergeSRSStores(b, a));
  });

  it('is symmetric when recency and repetition disagree', () => {
    const a = { w: makeCard({ repetition: 7, dueDate: '2026-08-01', lastReviewed: '2026-05-01' }) };
    const b = { w: makeCard({ repetition: 0, dueDate: '2026-05-21', lastReviewed: '2026-05-20' }) };
    expect(mergeSRSStores(a, b)).toEqual(mergeSRSStores(b, a));
  });
});

// ─── mergeStudyStats ────────────────────────────────────────────────────────

describe('mergeStudyStats', () => {
  it('takes the max of each lifetime counter', () => {
    const merged = mergeStudyStats(
      stats({ totalReviewed: 100, totalCorrect: 90 }),
      stats({ totalReviewed: 40, totalCorrect: 95 }),
    );
    expect(merged.totalReviewed).toBe(100);
    expect(merged.totalCorrect).toBe(95);
  });

  it('keeps the real streak anchor when both streaks have decayed to 0 (regression)', () => {
    // Signing in on a fresh browser: local is empty, the server holds real
    // history. Both streaks read 0, and the old `b.streak > a.streak ? b : a`
    // fell through to the local side and erased the anchor date.
    const local = emptyStats();
    const server = stats({
      lastStreakDate: '2026-07-07',
      lastStudyDate: '2026-07-07',
      totalReviewed: 215,
      totalCorrect: 180,
    });
    const merged = mergeStudyStats(local, server);
    expect(merged.lastStreakDate).toBe('2026-07-07');
    expect(merged.totalReviewed).toBe(215);
  });

  it('prefers the later streak anchor over the larger streak number', () => {
    const stale = stats({ streak: 9, lastStreakDate: '2026-05-01' });
    const current = stats({ streak: 2, lastStreakDate: '2026-06-01' });
    const merged = mergeStudyStats(stale, current);
    expect(merged.lastStreakDate).toBe('2026-06-01');
    expect(merged.streak).toBe(2);
  });

  it('breaks an equal-anchor tie with the higher streak', () => {
    const merged = mergeStudyStats(
      stats({ streak: 4, lastStreakDate: '2026-06-01' }),
      stats({ streak: 6, lastStreakDate: '2026-06-01' }),
    );
    expect(merged.streak).toBe(6);
  });

  it('never splits the streak from the date it was earned', () => {
    const merged = mergeStudyStats(
      stats({ streak: 5, lastStreakDate: '2026-06-01' }),
      stats({ streak: 1, lastStreakDate: '2026-06-09' }),
    );
    expect(merged).toMatchObject({ streak: 1, lastStreakDate: '2026-06-09' });
  });

  it("adopts today's card count from the device that studied most recently (regression)", () => {
    // Choosing by totalReviewed let a stale count ride in attached to an old
    // day, which then blocked the daily threshold from being reached.
    const heavyButOld = stats({
      cardsStudiedToday: 40,
      lastStudyDate: '2026-06-01',
      totalReviewed: 900,
    });
    const lightButToday = stats({
      cardsStudiedToday: 3,
      lastStudyDate: '2026-06-09',
      totalReviewed: 12,
    });
    const merged = mergeStudyStats(heavyButOld, lightButToday);
    expect(merged.lastStudyDate).toBe('2026-06-09');
    expect(merged.cardsStudiedToday).toBe(3);
  });

  it('takes the higher card count when both sides studied the same day', () => {
    const merged = mergeStudyStats(
      stats({ cardsStudiedToday: 3, lastStudyDate: '2026-06-09' }),
      stats({ cardsStudiedToday: 21, lastStudyDate: '2026-06-09' }),
    );
    expect(merged.cardsStudiedToday).toBe(21);
  });

  it('is symmetric', () => {
    const a = stats({
      streak: 4,
      lastStreakDate: '2026-06-01',
      cardsStudiedToday: 12,
      lastStudyDate: '2026-06-02',
      totalReviewed: 300,
      totalCorrect: 250,
    });
    const b = stats({
      streak: 1,
      lastStreakDate: '2026-06-08',
      cardsStudiedToday: 4,
      lastStudyDate: '2026-06-09',
      totalReviewed: 120,
      totalCorrect: 118,
    });
    expect(mergeStudyStats(a, b)).toEqual(mergeStudyStats(b, a));
  });

  it('merging a store with itself changes nothing', () => {
    const only = stats({
      streak: 3,
      lastStreakDate: '2026-06-09',
      cardsStudiedToday: 15,
      lastStudyDate: '2026-06-09',
      totalReviewed: 200,
      totalCorrect: 180,
    });
    expect(mergeStudyStats(only, only)).toEqual(only);
  });
});
