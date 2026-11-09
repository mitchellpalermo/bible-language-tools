// A returning student's progress survives the move onto the shared study-rhythm
// modules (#209). The stores are seeded as literal JSON in the shapes written
// before the move, so a rename in the code under test cannot rewrite the
// fixture to match itself.

import { parseAttempt } from '@tools/shared/attempt-log';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadParseHistoryStore } from '../data/focusPassages';
import { loadSRSStore, loadStats } from '../data/srs';
import { loadAttempts } from './attempt-log';
import { parseConcept, parseHistoryAsAttempts } from './parse-attempts';
import { pullAndMerge, readLocalProgress } from './sync-manager';

const SRS = {
  λόγος: {
    key: 'λόγος',
    interval: 21,
    repetition: 4,
    easeFactor: 2.36,
    dueDate: '2026-11-20',
    lastReviewed: '2026-10-30',
  },
  ἀγάπη: {
    key: 'ἀγάπη',
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    dueDate: '2026-11-01',
    lastReviewed: '',
  },
};
const STATS = {
  streak: 9,
  lastStreakDate: '2026-11-04',
  cardsStudiedToday: 14,
  lastStudyDate: '2026-11-04',
  totalReviewed: 812,
  totalCorrect: 640,
};
const PASSAGES = [
  {
    id: 'jn1',
    label: 'Prologue',
    book: 'JHN',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 18,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];
const PARSE = { jn1: { correct: 37, total: 52 }, gone: { correct: 0, total: 0 } };
const DECKS = [{ id: 'd1', name: 'Romans 8', wordKeys: ['λόγος'], createdAt: '2026-10-01' }];

function seedBeforeTheMove() {
  localStorage.setItem('greek-tools-srs-v2', JSON.stringify(SRS));
  localStorage.setItem('greek-tools-stats-v1', JSON.stringify(STATS));
  localStorage.setItem('greek-tools-focus-passages-v1', JSON.stringify(PASSAGES));
  localStorage.setItem('greek-tools-focus-parse-v1', JSON.stringify(PARSE));
  localStorage.setItem('greek-tools-custom-decks-v1', JSON.stringify(DECKS));
}

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // The seeded stats are "today's": loadStats resets the daily counter on a new day.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 4, 12) });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a returning student, seeded as before the move', () => {
  it('reads every store unchanged', () => {
    seedBeforeTheMove();
    expect(loadSRSStore()).toEqual(SRS);
    expect(loadStats()).toEqual(STATS);
    expect(loadParseHistoryStore()).toEqual(PARSE);
    expect(readLocalProgress().focusPassages).toEqual(PASSAGES);
  });

  it('reads the parse history as attempts without losing a single answer', () => {
    seedBeforeTheMove();
    const attempts = parseHistoryAsAttempts(loadParseHistoryStore(), loadAttempts());
    const jn1 = attempts.filter((a) => a.concept === parseConcept('jn1'));
    expect(jn1).toHaveLength(52);
    expect(jn1.filter((a) => a.correct)).toHaveLength(37);
    expect(attempts.filter((a) => a.concept === parseConcept('gone'))).toHaveLength(0);
    // Every one is a valid attempt as the shared parser (the server's gate) sees it.
    for (const a of attempts) expect(parseAttempt(a)).toEqual(a);
  });

  it('does not write the attempt log just by being read', () => {
    seedBeforeTheMove();
    parseHistoryAsAttempts(loadParseHistoryStore(), loadAttempts());
    expect(localStorage.getItem('greek-tools-attempts-v1')).toBeNull();
  });

  it('keeps everything through a sync with an empty account, and pushes it unchanged', async () => {
    seedBeforeTheMove();
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ syncedAt: '2026-11-05T00:00:00Z' })));

    expect(await pullAndMerge()).toEqual({ hadServerData: false, ok: true });

    expect(loadSRSStore()).toEqual(SRS);
    expect(loadStats()).toEqual(STATS);
    expect(loadParseHistoryStore()).toEqual(PARSE);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).toEqual({
      srsStore: SRS,
      studyStats: STATS,
      customDecks: DECKS,
      focusPassages: PASSAGES,
      parseHistory: PARSE,
      ladderProgress: {},
    });
  });

  it('keeps the larger history when the account holds a smaller one', async () => {
    seedBeforeTheMove();
    const server = {
      srsStore: {},
      studyStats: { ...STATS, streak: 0, lastStreakDate: '', lastStudyDate: '' },
      customDecks: [],
      focusPassages: [],
      parseHistory: { jn1: { correct: 5, total: 10 } },
      syncedAt: '2026-11-01T00:00:00Z',
    };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: server })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ syncedAt: '2026-11-05T00:00:00Z' })));

    await pullAndMerge();

    expect(loadSRSStore()).toEqual(SRS);
    expect(loadStats().streak).toBe(9);
    expect(loadParseHistoryStore().jn1).toEqual({ correct: 37, total: 52 });
  });
});
