import { beforeEach, describe, expect, it } from 'vitest';
import { localDateStr, newCard, type SRSCard } from './srs';
import {
  BUDGET_TOLERANCE,
  createStudyStreak,
  currentStreak,
  drillForToday,
  dueTomorrow,
  fillBudget,
  isSessionBudget,
  isWeak,
  SESSION_BUDGETS,
  type SessionCandidate,
  WEAK_EASE,
} from './today-session';

type C = SessionCandidate & { id: string };
const item = (id: string, tier: C['tier'], seconds: number, extra: Partial<C> = {}): C => ({
  id,
  tier,
  seconds,
  ...extra,
});
const ids = (items: C[]) => items.map((c) => c.id);

function daysFrom(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

const card = (key: string, patch: Partial<SRSCard>): SRSCard => ({ ...newCard(key), ...patch });

describe('budgets', () => {
  it('offers the three budgets the issue names, and allows 10% over', () => {
    expect(SESSION_BUDGETS).toEqual([20, 45, 90]);
    expect(BUDGET_TOLERANCE).toBe(0.1);
  });

  it('recognises a stored budget and rejects anything else', () => {
    expect(isSessionBudget(45)).toBe(true);
    expect(isSessionBudget(30)).toBe(false);
    expect(isSessionBudget('45')).toBe(false);
  });
});

describe('fillBudget', () => {
  it('admits due, then weak, then new, whatever order they arrive in', () => {
    const { items } = fillBudget(
      [item('n1', 'new', 10), item('w1', 'weak', 10), item('d1', 'due', 10), item('d2', 'due', 10)],
      100,
    );
    expect(ids(items)).toEqual(['d1', 'd2', 'w1', 'n1']);
  });

  it('keeps the caller’s order within a tier', () => {
    const { items } = fillBudget([item('b', 'due', 1), item('a', 'due', 1)], 10);
    expect(ids(items)).toEqual(['b', 'a']);
  });

  it('never adds up to more than the budget', () => {
    const many = Array.from({ length: 50 }, (_, i) => item(`d${i}`, 'due', 7));
    const { items, seconds } = fillBudget(many, 60);
    expect(seconds).toBeLessThanOrEqual(60);
    expect(items).toHaveLength(8);
    expect(seconds).toBe(56);
  });

  it('lets a short item use time a long one in the same tier could not', () => {
    const { items } = fillBudget(
      [item('long', 'due', 50), item('short', 'due', 5), item('fits', 'due', 30)],
      40,
    );
    expect(ids(items)).toEqual(['short', 'fits']);
  });

  it('admits nothing new once due work was left out', () => {
    const { items } = fillBudget(
      [item('d1', 'due', 30), item('d2', 'due', 30), item('n1', 'new', 1)],
      40,
    );
    expect(ids(items)).toEqual(['d1']);
  });

  it('admits nothing new once weak work was left out, but keeps the due', () => {
    const { items } = fillBudget(
      [item('d1', 'due', 10), item('w1', 'weak', 50), item('w2', 'weak', 5), item('n1', 'new', 1)],
      20,
    );
    expect(ids(items)).toEqual(['d1', 'w2']);
  });

  it('charges a group’s cost once, to its first admitted item', () => {
    const { items, seconds } = fillBudget(
      [
        item('t1a', 'due', 20, { group: 't1', groupSeconds: 30 }),
        item('t1b', 'due', 20, { group: 't1', groupSeconds: 30 }),
        item('t2a', 'due', 20, { group: 't2', groupSeconds: 30 }),
      ],
      100,
    );
    expect(ids(items)).toEqual(['t1a', 't1b']);
    expect(seconds).toBe(70);
  });

  it('returns an empty plan for an empty list or no time', () => {
    expect(fillBudget([], 100)).toEqual({ items: [], seconds: 0 });
    expect(fillBudget([item('d', 'due', 1)], 0).items).toEqual([]);
  });
});

describe('isWeak', () => {
  const today = '2026-10-31';

  it('flags a scheduled card whose ease has fallen below the line', () => {
    expect(isWeak(card('a', { dueDate: '2026-11-03', easeFactor: 2.15 }), today)).toBe(true);
  });

  it('leaves alone a card missed only once, or one that is due anyway', () => {
    expect(isWeak(card('a', { dueDate: '2026-11-03', easeFactor: 2.3 }), today)).toBe(false);
    expect(isWeak(card('a', { dueDate: today, easeFactor: 1.5 }), today)).toBe(false);
    expect(WEAK_EASE).toBeLessThan(2.3);
  });
});

describe('drillForToday', () => {
  const rotation = ['accent', 'ladder', 'mixed'] as const;
  const base = new Date(2026, 9, 31);

  it('moves on one place a day and comes round again', () => {
    const week = Array.from({ length: 4 }, (_, i) =>
      drillForToday(rotation, () => true, daysFrom(base, i)),
    );
    expect(new Set(week.slice(0, 3)).size).toBe(3);
    expect(week[3]).toBe(week[0]);
  });

  it('passes an unavailable drill’s day to the next one', () => {
    const today = drillForToday(rotation, () => true, base);
    const next = rotation[(rotation.indexOf(today as (typeof rotation)[number]) + 1) % 3];
    expect(drillForToday(rotation, (d) => d !== today, base)).toBe(next);
  });

  it('is null when nothing is available', () => {
    expect(drillForToday(rotation, () => false, base)).toBeNull();
    expect(drillForToday([], () => true, base)).toBeNull();
  });
});

describe('dueTomorrow', () => {
  const now = new Date(2026, 9, 31, 21, 0);

  it('counts what is due by the end of tomorrow among the keys asked for', () => {
    const store = {
      a: card('a', { dueDate: '2026-10-30' }),
      b: card('b', { dueDate: '2026-11-01' }),
      c: card('c', { dueDate: '2026-11-02' }),
      'x:d': card('x:d', { dueDate: '2026-11-01' }),
    };
    expect(dueTomorrow(store, (k) => !k.startsWith('x:'), now)).toBe(2);
    expect(dueTomorrow(store, () => true, now)).toBe(3);
  });

  it('crosses a month end on the local calendar', () => {
    const store = { a: card('a', { dueDate: localDateStr(daysFrom(now, 1)) }) };
    expect(dueTomorrow(store, () => true, now)).toBe(1);
  });
});

describe('the study streak', () => {
  const data: Record<string, string> = {};
  beforeEach(() => {
    for (const k of Object.keys(data)) delete data[k];
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => data[k] ?? null,
        setItem: (k: string, v: string) => {
          data[k] = v;
        },
      },
    });
  });

  it('counts one day per finished session, under its own key', () => {
    const study = createStudyStreak('study-v1');
    const verse = createStudyStreak('verse-v1');
    const today = new Date(2026, 9, 31);
    study.markStudiedToday(daysFrom(today, -1));
    expect(study.markStudiedToday(today).streak).toBe(2);
    expect(study.markStudiedToday(today).streak).toBe(2);
    expect(verse.loadStudyStreak().streak).toBe(0);
  });

  it('reads a lapsed streak as 0 and a live one as stored', () => {
    const now = new Date(2026, 9, 31);
    const on = (n: number) => localDateStr(daysFrom(now, n));
    expect(currentStreak({ streak: 4, lastReadDate: on(0) }, now)).toBe(4);
    expect(currentStreak({ streak: 4, lastReadDate: on(-1) }, now)).toBe(4);
    expect(currentStreak({ streak: 4, lastReadDate: on(-2) }, now)).toBe(0);
    expect(currentStreak({ streak: 0, lastReadDate: '' }, now)).toBe(0);
  });
});
