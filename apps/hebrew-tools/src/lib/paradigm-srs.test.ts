import { emptyStats } from '@tools/shared/srs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { daysFromNow, newCard, type SRSCard, todayStr } from '../data/srs';
import { getParadigm } from '../data/verb-paradigms';
import { buildVerbTable, cellId, getQuizCells, type QuizCell } from './paradigm-quiz';
import {
  blankForReview,
  gradeForResult,
  isCellDue,
  isParadigmKey,
  PARADIGM_KEY_PREFIX,
  paradigmCardKey,
  recordAttempt,
  tableProgress,
} from './paradigm-srs';

const STRONG = 'qal-qatal-strong';
const key = (pgn: string) => paradigmCardKey(cellId(STRONG, pgn as '3ms'));

function table() {
  const p = getParadigm(STRONG);
  if (!p) throw new Error('missing paradigm');
  return buildVerbTable(p);
}

/** A card answered on some earlier day and next due `dueIn` days from now. */
function seen(k: string, dueIn: number, overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    ...newCard(k),
    interval: 3,
    repetition: 2,
    dueDate: daysFromNow(dueIn),
    lastReviewed: daysFromNow(-3),
    ...overrides,
  };
}

beforeEach(() => vi.useRealTimers());

describe('paradigm card keys', () => {
  it('prefixes the cell id, so a form is one card in either layout', () => {
    expect(paradigmCardKey('qal-qatal-strong:3ms')).toBe('paradigm:qal-qatal-strong:3ms');
    expect(isParadigmKey(key('3ms'))).toBe(true);
    // Vocabulary keys are bare lemmas, writing keys carry write:.
    expect(isParadigmKey('קָטַל')).toBe(false);
    expect(isParadigmKey('write:letter:ק')).toBe(false);
    expect(PARADIGM_KEY_PREFIX).toBe('paradigm:');
  });
});

describe('gradeForResult', () => {
  it('passes exactly what the score counts, and never infers easy', () => {
    expect(gradeForResult('correct', false)).toBe('good');
    expect(gradeForResult('correct', true)).toBe('good');
    expect(gradeForResult('wrong', false)).toBe('again');
  });

  it('makes a forgiven pointing slip hard, and a counted one again', () => {
    expect(gradeForResult('dagesh-only', false)).toBe('hard');
    expect(gradeForResult('nikud-only', false)).toBe('hard');
    expect(gradeForResult('dagesh-only', true)).toBe('again');
    expect(gradeForResult('nikud-only', true)).toBe('again');
  });
});

describe('recordAttempt', () => {
  const opts = { strict: false, peeked: false };

  it('creates and schedules a card per graded cell', () => {
    const { store, scheduled } = recordAttempt(
      {},
      emptyStats(),
      [
        { id: cellId(STRONG, '3ms'), result: 'correct' },
        { id: cellId(STRONG, '3fs'), result: 'wrong' },
      ],
      opts,
    );

    expect(store[key('3ms')]).toMatchObject({ repetition: 1, lastReviewed: todayStr() });
    expect(store[key('3fs')]).toMatchObject({ repetition: 0, interval: 1 });
    expect(scheduled).toHaveLength(2);
  });

  it('counts every graded cell in the stats, right or wrong', () => {
    const { stats } = recordAttempt(
      {},
      emptyStats(),
      [
        { id: cellId(STRONG, '3ms'), result: 'correct' },
        { id: cellId(STRONG, '3fs'), result: 'dagesh-only' },
        { id: cellId(STRONG, '2ms'), result: 'wrong' },
      ],
      opts,
    );

    expect(stats.totalReviewed).toBe(3);
    expect(stats.totalCorrect).toBe(2);
    expect(stats.cardsStudiedToday).toBe(3);
  });

  it('does not promote a form already answered today, but still demotes it', () => {
    const first = recordAttempt(
      {},
      emptyStats(),
      [{ id: cellId(STRONG, '3ms'), result: 'correct' }],
      opts,
    );
    const again = recordAttempt(
      first.store,
      first.stats,
      [{ id: cellId(STRONG, '3ms'), result: 'correct' }],
      opts,
    );
    expect(again.store[key('3ms')]).toEqual(first.store[key('3ms')]);
    expect(again.scheduled).toHaveLength(0);

    const missed = recordAttempt(
      first.store,
      first.stats,
      [{ id: cellId(STRONG, '3ms'), result: 'wrong' }],
      opts,
    );
    expect(missed.store[key('3ms')].repetition).toBe(0);
  });

  it('promotes nothing after a peek, and still records the misses', () => {
    const before = { [key('3ms')]: seen(key('3ms'), 0) };
    const { store } = recordAttempt(
      before,
      emptyStats(),
      [
        { id: cellId(STRONG, '3ms'), result: 'correct' },
        { id: cellId(STRONG, '3fs'), result: 'wrong' },
      ],
      { strict: false, peeked: true },
    );

    expect(store[key('3ms')]).toEqual(before[key('3ms')]);
    expect(store[key('3fs')]).toMatchObject({ repetition: 0, lastReviewed: todayStr() });
  });

  it('counts a cell with no id in the stats but schedules no card for it', () => {
    const { store, stats } = recordAttempt({}, emptyStats(), [{ result: 'correct' }], opts);
    expect(store).toEqual({});
    expect(stats.totalReviewed).toBe(1);
  });

  it('leaves the store it was given untouched', () => {
    const before = {};
    recordAttempt(before, emptyStats(), [{ id: cellId(STRONG, '3ms'), result: 'correct' }], opts);
    expect(before).toEqual({});
  });
});

describe('tableProgress', () => {
  it('counts forms never answered and forms due now', () => {
    const store = {
      [key('3ms')]: seen(key('3ms'), 0),
      [key('3fs')]: seen(key('3fs'), -2),
      [key('2ms')]: seen(key('2ms'), 5),
    };

    expect(tableProgress(table(), store)).toEqual({ total: 9, fresh: 6, due: 2 });
  });

  it('ignores cards from other features', () => {
    expect(tableProgress(table(), { קָטַל: newCard('קָטַל') })).toEqual({
      total: 9,
      fresh: 9,
      due: 0,
    });
  });
});

describe('isCellDue', () => {
  it('treats a cell without an id as due, since nothing schedules it', () => {
    const cell: QuizCell = { index: 0, rowIndex: 0, colIndex: 0, answer: 'x', isBlank: false };
    expect(isCellDue(cell, {})).toBe(true);
  });
});

describe('blankForReview', () => {
  /** Every form seen and scheduled ahead, except the PGNs given, which are due. */
  function storeWithDue(...pgns: string[]) {
    const store: Record<string, SRSCard> = {};
    for (const c of getQuizCells(table())) {
      const k = paradigmCardKey(c.id as string);
      store[k] = seen(k, pgns.some((p) => c.id?.endsWith(`:${p}`)) ? 0 : 4);
    }
    return store;
  }

  const blanked = (cells: QuizCell[]) =>
    cells.filter((c) => c.isBlank).map((c) => c.id?.split(':')[1]);

  it('blanks exactly the due forms in due mode', () => {
    const cells = blankForReview(getQuizCells(table()), 'due', storeWithDue('3fs', '1cp'));
    expect(blanked(cells).sort()).toEqual(['1cp', '3fs']);
  });

  it('blanks nothing in due mode when nothing is due', () => {
    expect(blanked(blankForReview(getQuizCells(table()), 'due', storeWithDue()))).toEqual([]);
  });

  it('spends a density on due forms before any other', () => {
    // Easy on nine cells is two blanks; exactly two are due.
    for (let seed = 0; seed < 5; seed++) {
      const random = () => (seed + 0.5) / 6;
      const cells = blankForReview(
        getQuizCells(table()),
        'easy',
        storeWithDue('2fs', '3cp'),
        random,
      );
      expect(blanked(cells).sort()).toEqual(['2fs', '3cp']);
    }
  });

  it('fills the rest of a density from forms not yet due', () => {
    const cells = blankForReview(getQuizCells(table()), 'medium', storeWithDue('3ms'));
    const blanks = blanked(cells);
    expect(blanks).toHaveLength(5);
    expect(blanks).toContain('3ms');
  });

  it('blanks the whole table on hard, due or not', () => {
    expect(blanked(blankForReview(getQuizCells(table()), 'hard', storeWithDue()))).toHaveLength(9);
  });

  it('treats a table never studied as entirely due', () => {
    expect(blanked(blankForReview(getQuizCells(table()), 'due', {}))).toHaveLength(9);
  });
});
