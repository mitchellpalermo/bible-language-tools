import { CLEAN_WRITES_TO_UNLOCK } from '@tools/shared/ladder';
import { afterEach, describe, expect, it } from 'vitest';
import { SHIFT_ITEMS } from '../data/accent-shift';
import { daysFromNow, newCard, type SRSCard, todayStr } from '../data/srs';
import { LADDER_RUNG_IDS } from '../data/suffix-ladder';
import { vocabulary } from '../data/vocabulary';
import { accentCardKey } from './accent-shift';
import { DEFAULT_SELECTION } from './deck-selection';
import { buildTableModels, getQuizCells } from './paradigm-quiz';
import { paradigmCardKey } from './paradigm-srs';
import {
  BUDGET_KEY,
  buildDrill,
  buildHebrewPlan,
  countForms,
  currentRung,
  DRILL_ROTATION,
  dueTomorrow,
  formCandidates,
  formHomes,
  isWeak,
  loadBudget,
  MAX_CELLS_PER_ITEM,
  saveBudget,
  todaysDrill,
  vocabCandidates,
  vocabSrsKey,
} from './today';

/** A card last reviewed `ago` days back and due `due` days from now. */
function card(key: string, { ago = 3, due = 0, ease = 2.5, reps = 2 } = {}): SRSCard {
  return {
    key,
    interval: 3,
    repetition: reps,
    easeFactor: ease,
    dueDate: daysFromNow(due),
    lastReviewed: daysFromNow(-ago),
  };
}

const fixed = () => 0.42;
const tables = buildTableModels();
const homes = formHomes(tables);
const formIds = [...homes.keys()];

describe('isWeak', () => {
  it('is a card not due that keeps being missed', () => {
    expect(isWeak(card('a', { due: 3, ease: 1.7 }))).toBe(true);
    expect(isWeak(card('a', { due: 3, reps: 0 }))).toBe(true);
  });

  it('is never a due card, a healthy one, one seen today or a fresh one', () => {
    expect(isWeak(card('a', { due: 0, ease: 1.5 }))).toBe(false);
    expect(isWeak(card('a', { due: 3 }))).toBe(false);
    expect(isWeak(card('a', { due: 1, ago: 0, ease: 1.5 }))).toBe(false);
    expect(isWeak({ ...newCard('a'), dueDate: daysFromNow(2) })).toBe(false);
  });
});

describe('vocabCandidates', () => {
  const [w1, w2, w3] = vocabulary;

  it('puts due cards first, most overdue first, then weak, then new from the deck', () => {
    const store = {
      [vocabSrsKey(w1)]: card(vocabSrsKey(w1), { due: 0 }),
      [vocabSrsKey(w2)]: card(vocabSrsKey(w2), { due: -4 }),
      [vocabSrsKey(w3)]: card(vocabSrsKey(w3), { due: 5, ease: 1.6 }),
    };
    const out = vocabCandidates(store, DEFAULT_SELECTION);
    expect(out.slice(0, 3).map((c) => [c.id, c.tier])).toEqual([
      [vocabSrsKey(w2), 'due'],
      [vocabSrsKey(w1), 'due'],
      [vocabSrsKey(w3), 'weak'],
    ]);
    expect(out.slice(3).every((c) => c.tier === 'new')).toBe(true);
    expect(new Set(out.map((c) => c.id)).size).toBe(out.length);
  });

  it('leaves out a card that is scheduled and healthy', () => {
    const store = { [vocabSrsKey(w1)]: card(vocabSrsKey(w1), { due: 5 }) };
    expect(vocabCandidates(store, DEFAULT_SELECTION).some((c) => c.id === vocabSrsKey(w1))).toBe(
      false,
    );
  });

  it('takes new words from a textbook selection in its own order', () => {
    const out = vocabCandidates(
      {},
      { deck: 'garrett-derouchie', chapters: [2], categories: ['core'] },
    );
    expect(out.length).toBeGreaterThan(0);
    expect(
      out.every((c) =>
        c.payload.kind === 'vocab'
          ? c.payload.word.chapters?.some((r) => r.chapter === 2 && r.category === 'core')
          : false,
      ),
    ).toBe(true);
  });

  it('orders the whole vocabulary by frequency', () => {
    const freqs = vocabCandidates({}, DEFAULT_SELECTION)
      .slice(0, 20)
      .map((c) => (c.payload.kind === 'vocab' ? (c.payload.word.frequency ?? -1) : 0));
    expect(freqs).toEqual([...freqs].sort((a, b) => b - a));
  });
});

describe('formHomes', () => {
  it('gives every form the narrowest table it appears in', () => {
    for (const [id, home] of homes) {
      const widths = tables
        .filter((t) => getQuizCells(t).some((c) => c.id === id))
        .map((t) => t.cols.length);
      expect(home.table.cols.length).toBe(Math.min(...widths));
    }
  });
});

describe('formCandidates', () => {
  it('groups due forms by table, in pieces of at most MAX_CELLS_PER_ITEM', () => {
    const home = homes.get(formIds[0])?.table;
    const ids = formIds.filter((id) => homes.get(id)?.table === home);
    const store = Object.fromEntries(ids.map((id) => [paradigmCardKey(id), card(id, { due: -1 })]));
    const out = formCandidates(store, homes);
    const due = out.filter((c) => c.tier === 'due');
    const blanks = due.flatMap((c) => (c.payload.kind === 'forms' ? c.payload.blankIds : []));
    expect(blanks.sort()).toEqual([...ids].sort());
    for (const c of due) {
      if (c.payload.kind !== 'forms') throw new Error('not forms');
      expect(c.payload.blankIds.length).toBeLessThanOrEqual(MAX_CELLS_PER_ITEM);
      expect(c.seconds).toBe(c.payload.blankIds.length * 15);
    }
  });

  it('offers new forms only from tables the student has started', () => {
    expect(formCandidates({}, homes)).toEqual([]);
    const started = formIds[0];
    const table = homes.get(started)?.table;
    const out = formCandidates({ [paradigmCardKey(started)]: card(started, { due: 5 }) }, homes);
    expect(out.length).toBeGreaterThan(0);
    expect(
      out.every((c) => c.tier === 'new' && c.payload.kind === 'forms' && c.payload.table === table),
    ).toBe(true);
  });

  it('marks forms that are not due but keep being missed as weak', () => {
    const id = formIds[0];
    const out = formCandidates({ [paradigmCardKey(id)]: card(id, { due: 4, ease: 1.5 }) }, homes);
    expect(out.find((c) => c.tier === 'weak')?.payload).toMatchObject({ blankIds: [id] });
  });
});

describe('the drill', () => {
  const context = { budget: 20 as const, store: {}, ladder: {}, homes, random: fixed };

  it('fills the accent slot with as many words as fit', () => {
    const drill = buildDrill('accent', context);
    expect(drill?.payload.kind).toBe('accent');
    if (drill?.payload.kind !== 'accent') return;
    expect(drill.payload.items).toHaveLength(2);
    expect(drill.seconds).toBe(180);
  });

  it('puts the item that needs review first', () => {
    // Every item seen and scheduled ahead except the last, which is due.
    const pending = SHIFT_ITEMS[SHIFT_ITEMS.length - 1];
    const store = Object.fromEntries(
      SHIFT_ITEMS.map((item) => [
        accentCardKey(item.id),
        card(accentCardKey(item.id), { due: item === pending ? 0 : 5 }),
      ]),
    );
    const drill = buildDrill('accent', { ...context, store });
    expect(drill?.payload.kind === 'accent' && drill.payload.items[0].id).toBe(pending.id);
  });

  it('climbs the ladder from the highest open rung', () => {
    expect(currentRung({}, tables).rung).toBe(LADDER_RUNG_IDS[0]);
    const progress = { [LADDER_RUNG_IDS[0]]: CLEAN_WRITES_TO_UNLOCK };
    expect(currentRung(progress, tables).rung).toBe(LADDER_RUNG_IDS[1]);
    const drill = buildDrill('ladder', { ...context, ladder: progress });
    expect(drill?.payload).toMatchObject({ kind: 'ladder', table: { rung: LADDER_RUNG_IDS[1] } });
  });

  it('has no mixed review until some forms are learned', () => {
    expect(buildDrill('mixed', context)).toBeNull();
    const learned = formIds.slice(0, 30);
    const store = Object.fromEntries(
      learned.map((id) => [paradigmCardKey(id), card(id, { due: 6 })]),
    );
    const drill = buildDrill('mixed', { ...context, store });
    if (drill?.payload.kind !== 'mixed') throw new Error('expected a mixed drill');
    const picked = drill.payload.rounds.flatMap((r) => r.blankIds);
    expect(picked).toHaveLength(16);
    expect(picked.every((id) => learned.includes(id))).toBe(true);
    expect(drill.seconds).toBe(240);
  });

  it('rotates by day and skips a drill with nothing to offer', () => {
    // Local dates, a day apart, so the rotation's index moves by one.
    const days = [0, 1, 2].map((d) => new Date(2026, 10, 2 + d, 12));
    const kinds = days.map((d) => todaysDrill(context, d)?.payload.kind);
    // With no learned forms, the mixed day falls through to the next in line.
    expect(kinds).not.toContain('mixed');
    expect(new Set(kinds)).toEqual(new Set(['accent', 'ladder']));
    expect(DRILL_ROTATION).toEqual(['accent', 'ladder', 'mixed']);
  });
});

describe('buildHebrewPlan', () => {
  it('fits the budget, due before new, and plans a drill', () => {
    const due = vocabulary.slice(0, 300);
    const store = Object.fromEntries(
      due.map((w) => [vocabSrsKey(w), card(vocabSrsKey(w), { due: -1 })]),
    );
    const plan = buildHebrewPlan({
      budget: 20,
      store,
      selection: DEFAULT_SELECTION,
      ladder: {},
      random: fixed,
    });
    expect(plan.plannedSeconds).toBeLessThanOrEqual(20 * 60);
    expect(plan.drill).not.toBeNull();
    const vocab = plan.sections.find((s) => s.id === 'vocab')?.items ?? [];
    expect(vocab.length).toBeGreaterThan(0);
    expect(vocab.every((i) => i.tier === 'due')).toBe(true);
    expect(plan.leftOut.due).toBeGreaterThan(0);
  });

  it('plans new vocabulary for a first-day student, capped', () => {
    const plan = buildHebrewPlan({
      budget: 20,
      store: {},
      selection: DEFAULT_SELECTION,
      ladder: {},
      random: fixed,
    });
    const vocab = plan.sections.find((s) => s.id === 'vocab')?.items ?? [];
    expect(vocab).toHaveLength(10);
    expect(countForms(plan)).toBe(0);
  });
});

describe('dueTomorrow', () => {
  it('counts vocabulary, forms and accent items due by tomorrow, and nothing else', () => {
    const w = vocabSrsKey(vocabulary[0]);
    const store = {
      [w]: card(w, { due: 1 }),
      [paradigmCardKey(formIds[0])]: card(formIds[0], { due: 0 }),
      [accentCardKey('davar-pl')]: card('x', { due: -2 }),
      'write:letter:א': card('x', { due: 0 }),
      [paradigmCardKey(formIds[1])]: card(formIds[1], { due: 4 }),
    };
    expect(dueTomorrow(store)).toBe(3);
    expect(todayStr() <= daysFromNow(1)).toBe(true);
  });
});

describe('the budget setting', () => {
  afterEach(() => localStorage.clear());

  it('defaults to 20 and remembers a pick', () => {
    expect(loadBudget()).toBe(20);
    saveBudget(90);
    expect(loadBudget()).toBe(90);
  });

  it('ignores anything that is not a budget', () => {
    localStorage.setItem(BUDGET_KEY, '30');
    expect(loadBudget()).toBe(20);
  });
});
