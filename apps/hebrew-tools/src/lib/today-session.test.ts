import { BUDGET_TOLERANCE, drillForToday } from '@tools/shared/today-session';
import { beforeEach, describe, expect, it } from 'vitest';
import { daysFromNow, newCard, nextSRS, type SRSCard } from '../data/srs';
import { LADDER_RUNG_IDS } from '../data/suffix-ladder';
import { vocabSrsKey, vocabulary } from '../data/vocabulary';
import { accentCardKey } from './accent-shift';
import { DEFAULT_SELECTION, type DeckSelection } from './deck-selection';
import { buildTableModels, getQuizCells } from './paradigm-quiz';
import { paradigmCardKey } from './paradigm-srs';
import {
  ACCENT_ITEM_SECONDS,
  ACCENT_ITEMS,
  BUDGET_KEY,
  buildSessionPlan,
  DEFAULT_BUDGET,
  DRILL_ROTATION,
  formCells,
  formCount,
  isSessionKey,
  ladderRungForToday,
  loadBudget,
  minutesText,
  NEW_WORDS_PER_SESSION,
  type PlanInput,
  saveBudget,
  sessionDueTomorrow,
  sessionParts,
  WORD_SECONDS,
} from './today-session';

const due = (key: string, daysOverdue = 0): SRSCard => ({
  ...newCard(key),
  interval: 3,
  repetition: 2,
  dueDate: daysFromNow(-daysOverdue),
});
const later = (key: string, easeFactor = 2.5): SRSCard => ({
  ...newCard(key),
  interval: 5,
  repetition: 3,
  easeFactor,
  dueDate: daysFromNow(5),
});

const words = vocabulary.slice(0, 200);
const wordKey = (i: number) => vocabSrsKey(words[i]);

/** A verb table and its cell ids, for building paradigm cards. */
const verbTable = buildTableModels().find((t) => t.layout === 'verb' && !t.rung);
const verbCells = getQuizCells(verbTable as NonNullable<typeof verbTable>).flatMap((c) =>
  c.id ? [c.id] : [],
);

/** A day on which the rotation lands on each drill. */
function dayFor(kind: (typeof DRILL_ROTATION)[number]): Date {
  for (let i = 0; i < 3; i++) {
    const d = new Date(2026, 9, 31 + i);
    if (drillForToday(DRILL_ROTATION, () => true, d) === kind) return d;
  }
  throw new Error('rotation never reached it');
}

function plan(overrides: Partial<PlanInput> = {}) {
  return buildSessionPlan({
    store: {},
    budget: 20,
    selection: DEFAULT_SELECTION,
    ladder: {},
    now: dayFor('accent'),
    random: () => 0.5,
    ...overrides,
  });
}

describe('buildSessionPlan', () => {
  it('never plans more than the budget, at every budget', () => {
    const store = Object.fromEntries(words.map((_, i) => [wordKey(i), due(wordKey(i))]));
    for (const budget of [20, 45, 90] as const) {
      const p = plan({ store, budget });
      expect(p.seconds).toBeLessThanOrEqual(budget * 60);
      expect(p.seconds).toBeLessThanOrEqual(budget * 60 * (1 + BUDGET_TOLERANCE));
    }
  });

  it('fills a short budget with the most overdue words first', () => {
    const store = Object.fromEntries(
      words.map((_, i) => [wordKey(i), due(wordKey(i), i % 2 === 0 ? 10 : 1)]),
    );
    const p = plan({ store });
    const overdue = new Set(words.filter((_, i) => i % 2 === 0).map(vocabSrsKey));
    expect(p.reviewWords.length).toBeGreaterThan(0);
    expect(p.reviewWords.every((w) => overdue.has(vocabSrsKey(w)))).toBe(true);
  });

  it('leaves out new words while due work did not fit', () => {
    const store = Object.fromEntries(words.map((_, i) => [wordKey(i), due(wordKey(i))]));
    expect(plan({ store }).newWords).toEqual([]);
  });

  it('adds weak words after the due ones, and leaves strong ones alone', () => {
    const store = {
      [wordKey(0)]: due(wordKey(0)),
      [wordKey(1)]: later(wordKey(1), 2.0),
      [wordKey(2)]: later(wordKey(2), 2.5),
    };
    expect(plan({ store }).reviewWords.map(vocabSrsKey)).toEqual([wordKey(0), wordKey(1)]);
  });

  it('caps first sightings, whatever the budget', () => {
    const p = plan({ budget: 90 });
    expect(p.newWords).toHaveLength(NEW_WORDS_PER_SESSION);
  });

  it('takes new words from the student’s textbook chapters, unseen ones only', () => {
    const selection: DeckSelection = {
      deck: 'garrett-derouchie',
      chapters: [2],
      categories: ['core'],
    };
    const inChapter = vocabulary.filter((w) =>
      w.chapters?.some((c) => c.textbook === 'garrett-derouchie' && c.chapter === 2),
    );
    const seen = vocabSrsKey(inChapter[0]);
    const p = plan({ selection, store: { [seen]: later(seen) } });
    expect(p.newWords.length).toBeGreaterThan(0);
    expect(p.newWords.map(vocabSrsKey)).not.toContain(seen);
    for (const w of p.newWords) {
      expect(w.chapters?.some((c) => c.textbook === 'garrett-derouchie' && c.chapter === 2)).toBe(
        true,
      );
    }
  });

  it('takes the most frequent words first from the whole vocabulary', () => {
    const p = plan();
    const freqs = p.newWords.map((w) => w.frequency ?? 0);
    expect(freqs).toEqual([...freqs].sort((a, b) => b - a));
  });

  it('plans due forms by table, in the verb’s own table, never a form not yet written', () => {
    const store = {
      [paradigmCardKey(verbCells[0])]: due(paradigmCardKey(verbCells[0])),
      [paradigmCardKey(verbCells[1])]: due(paradigmCardKey(verbCells[1])),
    };
    const p = plan({ store });
    expect(p.reviewForms).toHaveLength(1);
    expect(p.reviewForms[0].table.id).toBe(verbTable?.id);
    expect(p.reviewForms[0].cellIds).toEqual([verbCells[0], verbCells[1]]);
    expect(formCount(p.reviewForms)).toBe(2);
  });

  it('ignores cards the session cannot show', () => {
    const store = {
      'write:א': due('write:א'),
      [paradigmCardKey('gone:3ms')]: due(paradigmCardKey('gone:3ms')),
      [accentCardKey('davar-pl')]: due(accentCardKey('davar-pl')),
    };
    const p = plan({ store });
    expect(p.reviewWords).toEqual([]);
    expect(p.reviewForms).toEqual([]);
  });

  it('sets the drill’s time aside first', () => {
    const p = plan({ budget: 20 });
    expect(p.drill).toEqual({
      kind: 'accent',
      items: ACCENT_ITEMS,
      seconds: ACCENT_ITEMS * ACCENT_ITEM_SECONDS,
    });
    expect(p.seconds).toBe((p.drill?.seconds ?? 0) + p.newWords.length * WORD_SECONDS);
  });

  it('writes a whole rung on a ladder day', () => {
    const p = plan({ now: dayFor('ladder'), ladder: { suffixes: 2 } });
    expect(p.drill?.kind).toBe('ladder');
    if (p.drill?.kind !== 'ladder') return;
    const [{ table, cellIds }] = p.drill.tables;
    expect(table.rung).toBe('sus');
    expect(formCells({ table, cellIds }).every((c) => c.isBlank)).toBe(true);
  });

  it('reviews learned forms on a mixed day, and passes the day on without them', () => {
    const store = Object.fromEntries(
      verbCells.map((id) => [paradigmCardKey(id), later(paradigmCardKey(id))]),
    );
    const mixed = plan({ now: dayFor('mixed'), store });
    expect(mixed.drill?.kind).toBe('mixed');
    if (mixed.drill?.kind === 'mixed') {
      expect(formCount(mixed.drill.tables)).toBeGreaterThan(0);
      expect(formCount(mixed.drill.tables)).toBeLessThanOrEqual(8);
    }
    expect(plan({ now: dayFor('mixed') }).drill?.kind).not.toBe('mixed');
  });
});

describe('ladderRungForToday', () => {
  it('climbs the lowest open rung not yet climbed', () => {
    expect(ladderRungForToday({})).toBe('suffixes');
    expect(ladderRungForToday({ suffixes: 2 })).toBe('sus');
    expect(ladderRungForToday({ suffixes: 1 })).toBe('suffixes');
  });

  it('with every rung climbed, writes the one written least', () => {
    const all = Object.fromEntries(LADDER_RUNG_IDS.map((id) => [id, 3]));
    expect(ladderRungForToday({ ...all, dabar: 2 })).toBe('dabar');
  });
});

describe('sessionParts', () => {
  it('runs review words, review forms, new words, then the drill, skipping empty parts', () => {
    const store = {
      [wordKey(0)]: due(wordKey(0)),
      [paradigmCardKey(verbCells[0])]: due(paradigmCardKey(verbCells[0])),
    };
    expect(sessionParts(plan({ store })).map((p) => p.id)).toEqual([
      'review-words',
      'review-forms',
      'new-words',
      'drill',
    ]);
    expect(sessionParts(plan()).map((p) => p.id)).toEqual(['new-words', 'drill']);
  });
});

describe('formCells', () => {
  it('blanks exactly the planned cells', () => {
    const cells = formCells({
      table: verbTable as NonNullable<typeof verbTable>,
      cellIds: [verbCells[2]],
    });
    expect(cells.filter((c) => c.isBlank).map((c) => c.id)).toEqual([verbCells[2]]);
  });
});

describe('the summary', () => {
  it('counts words, forms and accent items due tomorrow, nothing else', () => {
    const tomorrow = (key: string) => ({ ...nextSRS(newCard(key), 4) });
    const store = {
      [wordKey(0)]: tomorrow(wordKey(0)),
      [paradigmCardKey(verbCells[0])]: tomorrow(paradigmCardKey(verbCells[0])),
      [accentCardKey('davar-pl')]: tomorrow(accentCardKey('davar-pl')),
      'write:א': tomorrow('write:א'),
      [wordKey(1)]: later(wordKey(1)),
    };
    expect(sessionDueTomorrow(store)).toBe(3);
    expect(isSessionKey('write:א')).toBe(false);
  });

  it('rounds an estimate up to whole minutes', () => {
    expect(minutesText(61)).toBe('about 2 min');
    expect(minutesText(0)).toBe('about 1 min');
  });
});

describe('the budget setting', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the last budget and ignores anything that is not one', () => {
    expect(loadBudget()).toBe(DEFAULT_BUDGET);
    saveBudget(45);
    expect(loadBudget()).toBe(45);
    localStorage.setItem(BUDGET_KEY, '30');
    expect(loadBudget()).toBe(DEFAULT_BUDGET);
  });
});
