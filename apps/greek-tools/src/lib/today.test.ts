import type { Attempt } from '@tools/shared/attempt-log';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FocusPassage } from '../data/focusPassages';
import { daysFromNow, type SRSCard } from '../data/srs';
import { vocabulary } from '../data/vocabulary';
import { parseConcept, parseFormConcept } from './parse-attempts';
import {
  BUDGET_KEY,
  buildGreekPlan,
  DEFAULT_BUDGET,
  DRILL_PROVIDERS,
  DRILL_ROTATION,
  DRILL_SECONDS,
  type DrillContext,
  type DrillKind,
  dueTomorrow,
  loadBudget,
  parseFormAccuracy,
  parseWeakness,
  rankParseItems,
  SECONDS,
  saveBudget,
  todaysDrill,
  vocabCandidates,
  vocabSrsKey,
  weakestPassage,
} from './today';
import { buildSession, DEFAULT_PARSE_SETTINGS } from './verb-parse';

function card(key: string, due: number, overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    key,
    interval: 4,
    repetition: 2,
    easeFactor: 2.5,
    dueDate: daysFromNow(due),
    lastReviewed: daysFromNow(-3),
    ...overrides,
  };
}

/** Every word scheduled ahead except the first `due`, which are due today. */
function seed(due: number, overrides: Partial<SRSCard> = {}) {
  return Object.fromEntries(
    vocabulary.map((w, i) => [vocabSrsKey(w), card(vocabSrsKey(w), i < due ? 0 : 7, overrides)]),
  );
}

let n = 0;
function attempt(concept: string, correct: boolean): Attempt {
  return { id: `a${n++}`, concept, correct, at: 1 };
}

beforeEach(() => localStorage.clear());

describe('vocabCandidates', () => {
  it('offers due cards only: no new words, no weak ones', () => {
    const [a, b, c] = vocabulary;
    const store = {
      [vocabSrsKey(a)]: card(vocabSrsKey(a), 0),
      // Weak (low ease) but not due: practice, not review.
      [vocabSrsKey(b)]: card(vocabSrsKey(b), 5, { easeFactor: 1.3, repetition: 0 }),
      // `c` was never studied: no card.
    };
    const out = vocabCandidates(store);
    expect(out.map((o) => o.id)).toEqual([vocabSrsKey(a)]);
    expect(out.every((o) => o.tier === 'due')).toBe(true);
    expect(out.some((o) => o.id === vocabSrsKey(c))).toBe(false);
  });

  it('puts the most overdue first and each store key once', () => {
    const [a, b] = vocabulary;
    const out = vocabCandidates({
      [vocabSrsKey(a)]: card(vocabSrsKey(a), -1),
      [vocabSrsKey(b)]: card(vocabSrsKey(b), -9),
    });
    expect(out.map((o) => o.id)).toEqual([vocabSrsKey(b), vocabSrsKey(a)]);
    expect(new Set(out.map((o) => o.id)).size).toBe(out.length);
  });
});

describe('parse history as the log sees it', () => {
  const [tense, voice, mood] = ['present', 'active', 'indicative'] as const;
  const item = { tense, voice, mood };

  it('tallies paradigm answers by kind of form and ignores other concepts', () => {
    const acc = parseFormAccuracy([
      attempt(parseFormConcept(item), true),
      attempt(parseFormConcept(item), false),
      attempt(parseConcept('passage-1'), false),
    ]);
    expect(acc.get(parseFormConcept(item))).toEqual({ correct: 1, total: 2 });
    expect(acc.size).toBe(1);
  });

  it('calls a kind weak only after enough answers, and leaves unseen ones in the middle', () => {
    const few = parseFormAccuracy([attempt(parseFormConcept(item), false)]);
    const unseen = parseWeakness(item, new Map());
    expect(parseWeakness(item, few)).toBe(unseen);

    const many = parseFormAccuracy([
      attempt(parseFormConcept(item), false),
      attempt(parseFormConcept(item), false),
      attempt(parseFormConcept(item), true),
    ]);
    expect(parseWeakness(item, many)).toBeCloseTo(1 / 3);
  });

  it('ranks the kinds the student misses first', () => {
    const pool = buildSession(DEFAULT_PARSE_SETTINGS, Number.MAX_SAFE_INTEGER);
    const target = pool[0];
    const log = Array.from({ length: 4 }, () => attempt(parseFormConcept(target), false));
    const ranked = rankParseItems(pool, log);
    expect(parseFormConcept(ranked[0])).toBe(parseFormConcept(target));
    expect(ranked).toHaveLength(pool.length);
  });
});

describe('weakestPassage', () => {
  const passage = (id: string): FocusPassage => ({
    id,
    book: 'JHN',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 18,
    createdAt: '2026-10-01',
  });

  it('reads old totals as attempts and names the worst passage below 70%', () => {
    const found = weakestPassage(
      [passage('a'), passage('b'), passage('c')],
      { a: { correct: 4, total: 10 }, b: { correct: 2, total: 10 }, c: { correct: 9, total: 10 } },
      [],
    );
    expect(found).toEqual({ id: 'b', label: 'JHN 1:1', accuracy: 0.2 });
  });

  it('uses the label when there is one', () => {
    const found = weakestPassage(
      [{ ...passage('a'), label: 'Prologue' }],
      { a: { correct: 1, total: 10 } },
      [],
    );
    expect(found?.label).toBe('Prologue');
  });

  it('says nothing for a strong passage, or one with too few answers', () => {
    expect(weakestPassage([passage('a')], { a: { correct: 9, total: 10 } }, [])).toBeNull();
    expect(weakestPassage([passage('a')], { a: { correct: 0, total: 3 } }, [])).toBeNull();
  });
});

describe('the drill', () => {
  const ctx = (over: Partial<DrillContext> = {}): DrillContext => ({
    budget: 20,
    store: {},
    attempts: [],
    random: () => 0.5,
    ...over,
  });

  it('has a provider for every drill that exists, and the ladder is the one seam still open', () => {
    const missing = DRILL_ROTATION.filter((k) => !DRILL_PROVIDERS[k]);
    expect(missing).toEqual(['ladder']);
  });

  it('sizes the parse drill to the budget', () => {
    for (const budget of [20, 45, 90] as const) {
      const slot = DRILL_PROVIDERS.parse?.(ctx({ budget }));
      expect(slot?.payload.kind).toBe('parse');
      expect(slot?.seconds).toBeLessThanOrEqual(DRILL_SECONDS[budget]);
      expect(slot?.seconds).toBeGreaterThan(0);
    }
  });

  it('offers a mixed review only of learned words that are not due', () => {
    expect(DRILL_PROVIDERS.mixed?.(ctx())).toBeNull();
    const [a, b, c] = vocabulary;
    const store = {
      [vocabSrsKey(a)]: card(vocabSrsKey(a), 5),
      [vocabSrsKey(b)]: card(vocabSrsKey(b), 0),
      [vocabSrsKey(c)]: card(vocabSrsKey(c), 5, { repetition: 0 }),
    };
    const slot = DRILL_PROVIDERS.mixed?.(ctx({ store }));
    expect(slot?.payload).toEqual({ kind: 'mixed', words: [a] });
    expect(slot?.seconds).toBe(SECONDS.vocab);
  });

  it('rotates by day among the drills that exist', () => {
    const kinds = new Set<string>();
    const store = seed(0);
    for (let d = 0; d < 6; d++) {
      const slot = todaysDrill(ctx({ store }), new Date(2026, 10, 1 + d));
      kinds.add(slot?.payload.kind ?? 'none');
    }
    expect(kinds).toEqual(new Set(['parse', 'mixed']));
  });

  it('falls through to the next drill when the day’s has nothing to offer', () => {
    // No learned words: the mixed day deals the parse drill instead.
    for (let d = 0; d < 4; d++) {
      expect(todaysDrill(ctx(), new Date(2026, 10, 1 + d))?.payload.kind).toBe('parse');
    }
  });

  it('is none when no provider has anything', () => {
    expect(todaysDrill(ctx(), new Date(), {})).toBeNull();
    expect(todaysDrill(ctx(), new Date(), { parse: () => null })).toBeNull();
  });

  it('joins a ladder provider to the rotation with no other change', () => {
    const ladder: DrillKind = 'ladder';
    const slot = { id: 'ladder', seconds: 60, payload: { kind: 'parse' as const, items: [] } };
    const providers = { [ladder]: () => slot };
    expect(todaysDrill(ctx(), new Date(2026, 10, 1), providers)).toBe(slot);
  });
});

describe('buildGreekPlan', () => {
  it('fills the budget with due cards and one drill, never past the budget', () => {
    for (const budget of [20, 45, 90] as const) {
      const plan = buildGreekPlan({ budget, store: seed(500) });
      expect(plan.plannedSeconds).toBeLessThanOrEqual(budget * 60);
      expect(plan.sections[0].items.every((i) => i.tier === 'due')).toBe(true);
      expect(plan.drill).not.toBeNull();
    }
  });

  it('counts what did not fit, and offers nothing new', () => {
    const plan = buildGreekPlan({ budget: 20, store: seed(500) });
    expect(plan.leftOut.due).toBeGreaterThan(0);
    expect(plan.leftOut.new).toBe(0);
    const empty = buildGreekPlan({ budget: 20, store: {} });
    expect(empty.sections[0].items).toEqual([]);
  });
});

describe('dueTomorrow', () => {
  it('counts vocabulary due by tomorrow, and nothing else in the store', () => {
    const [a, b, c] = vocabulary;
    expect(
      dueTomorrow({
        [vocabSrsKey(a)]: card(vocabSrsKey(a), 0),
        [vocabSrsKey(b)]: card(vocabSrsKey(b), 1),
        [vocabSrsKey(c)]: card(vocabSrsKey(c), 2),
        unrelated: card('unrelated', 0),
      }),
    ).toBe(2);
  });
});

describe('the budget preference', () => {
  afterEach(() => localStorage.clear());

  it('defaults, round-trips, and ignores a bad value', () => {
    expect(loadBudget()).toBe(DEFAULT_BUDGET);
    saveBudget(45);
    expect(loadBudget()).toBe(45);
    localStorage.setItem(BUDGET_KEY, '33');
    expect(loadBudget()).toBe(DEFAULT_BUDGET);
  });

  it('survives storage failing', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('denied');
    };
    expect(loadBudget()).toBe(DEFAULT_BUDGET);
    Storage.prototype.getItem = original;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('full');
    };
    expect(() => saveBudget(20)).not.toThrow();
    Storage.prototype.setItem = set;
  });
});
