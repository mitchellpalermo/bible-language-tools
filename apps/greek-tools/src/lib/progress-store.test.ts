import { users } from '@tools/db/schema';
import { createTestDb } from '@tools/db/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CustomDeck } from '../data/customDecks';
import type { FocusPassage, ParseHistory } from '../data/focusPassages';
import type { SRSCard, StudyStats } from '../data/srs';
import { deleteProgress, getProgress, type ProgressDb, putProgress } from './progress-store';

const USER_ID = 'user-1';

function makeCard(key: string, overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    key,
    interval: 6,
    repetition: 2,
    easeFactor: 2.5,
    dueDate: '2026-06-15',
    lastReviewed: '2026-06-09',
    ...overrides,
  };
}

const stats: StudyStats = {
  streak: 4,
  lastStreakDate: '2026-06-09',
  cardsStudiedToday: 12,
  lastStudyDate: '2026-06-09',
  totalReviewed: 250,
  totalCorrect: 210,
};

const deck: CustomDeck = {
  id: 'deck-1',
  name: 'John 1 vocab',
  wordKeys: ['λόγος', 'θεός', 'ἀρχή'],
  createdAt: '2026-06-01T12:00:00.000Z',
};

const passage: FocusPassage = {
  id: 'passage-1',
  label: 'John 1:1-14',
  book: 'JHN',
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 14,
  createdAt: '2026-06-01T12:00:00.000Z',
};

const parseHistory: Record<string, ParseHistory> = {
  'passage-1': { correct: 18, total: 20 },
};

describe('progress-store', () => {
  let db: ProgressDb;

  beforeEach(async () => {
    db = createTestDb() as unknown as ProgressDb;
    await db
      .insert(users)
      .values({ id: USER_ID, email: 'test@example.com', createdAt: new Date('2026-01-01') });
  });

  it('returns null for a user who has never synced', async () => {
    expect(await getProgress(db, USER_ID)).toBeNull();
  });

  it('round-trips a full payload through put + get', async () => {
    const srsStore = { λόγος: makeCard('λόγος'), καί: makeCard('καί', { repetition: 5 }) };

    const syncedAt = await putProgress(db, USER_ID, {
      srsStore,
      studyStats: stats,
      customDecks: [deck],
      focusPassages: [passage],
      parseHistory,
    });

    const result = await getProgress(db, USER_ID);
    expect(result).toEqual({
      srsStore,
      studyStats: stats,
      customDecks: [deck],
      focusPassages: [passage],
      parseHistory,
      syncedAt,
    });
  });

  it('assigns syncedAt on the server as an ISO timestamp', async () => {
    const before = Date.now();
    const syncedAt = await putProgress(db, USER_ID, {
      srsStore: {},
      studyStats: stats,
      customDecks: [],
      focusPassages: [],
      parseHistory: {},
    });
    expect(new Date(syncedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('replaces prior progress entirely on put', async () => {
    await putProgress(db, USER_ID, {
      srsStore: { λόγος: makeCard('λόγος') },
      studyStats: stats,
      customDecks: [deck],
      focusPassages: [passage],
      parseHistory,
    });
    await putProgress(db, USER_ID, {
      srsStore: { καί: makeCard('καί') },
      studyStats: { ...stats, totalReviewed: 300 },
      customDecks: [],
      focusPassages: [],
      parseHistory: {},
    });

    const result = await getProgress(db, USER_ID);
    expect(Object.keys(result?.srsStore ?? {})).toEqual(['καί']);
    expect(result?.studyStats.totalReviewed).toBe(300);
    expect(result?.customDecks).toEqual([]);
    expect(result?.focusPassages).toEqual([]);
    expect(result?.parseHistory).toEqual({});
  });

  it('handles stores larger than one insert chunk', async () => {
    const srsStore: Record<string, SRSCard> = {};
    for (let i = 0; i < 50; i++) {
      srsStore[`word-${i}`] = makeCard(`word-${i}`);
    }
    const manyPassages: FocusPassage[] = Array.from({ length: 20 }, (_, i) => ({
      id: `p-${i}`,
      book: 'JHN',
      startChapter: 1,
      startVerse: i + 1,
      endChapter: 1,
      endVerse: i + 1,
      createdAt: '2026-06-01T12:00:00.000Z',
    }));

    await putProgress(db, USER_ID, {
      srsStore,
      studyStats: stats,
      customDecks: [],
      focusPassages: manyPassages,
      parseHistory: {},
    });

    const result = await getProgress(db, USER_ID);
    expect(Object.keys(result?.srsStore ?? {})).toHaveLength(50);
    expect(result?.focusPassages).toHaveLength(20);
  });

  it('deleteProgress removes everything; subsequent get returns null', async () => {
    await putProgress(db, USER_ID, {
      srsStore: { λόγος: makeCard('λόγος') },
      studyStats: stats,
      customDecks: [deck],
      focusPassages: [passage],
      parseHistory,
    });

    await deleteProgress(db, USER_ID);

    expect(await getProgress(db, USER_ID)).toBeNull();
  });

  it('round-trips a passage without a label', async () => {
    const unlabeled: FocusPassage = {
      id: 'no-label',
      book: 'ROM',
      startChapter: 8,
      startVerse: 1,
      endChapter: 8,
      endVerse: 11,
      createdAt: '2026-06-01T12:00:00.000Z',
    };

    await putProgress(db, USER_ID, {
      srsStore: {},
      studyStats: stats,
      customDecks: [],
      focusPassages: [unlabeled],
      parseHistory: {},
    });

    const result = await getProgress(db, USER_ID);
    expect(result?.focusPassages).toEqual([unlabeled]);
    expect(result?.focusPassages[0]).not.toHaveProperty('label');
  });

  it('round-trips parse history', async () => {
    const history: Record<string, ParseHistory> = {
      'p-a': { correct: 9, total: 10 },
      'p-b': { correct: 0, total: 5 },
    };

    await putProgress(db, USER_ID, {
      srsStore: {},
      studyStats: stats,
      customDecks: [],
      focusPassages: [],
      parseHistory: history,
    });

    const result = await getProgress(db, USER_ID);
    expect(result?.parseHistory).toEqual(history);
  });

  it('issues writes through db.batch when the driver supports it', async () => {
    const statements: unknown[] = [];
    const batchingDb = new Proxy(db as object, {
      get(target, prop, receiver) {
        if (prop === 'batch') {
          return async (stmts: unknown[]) => {
            statements.push(...stmts);
            for (const stmt of stmts) await stmt;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as ProgressDb;

    await putProgress(batchingDb, USER_ID, {
      srsStore: { λόγος: makeCard('λόγος') },
      studyStats: stats,
      customDecks: [deck],
      focusPassages: [passage],
      parseHistory,
    });

    // All writes went through a single batch call — atomic on D1.
    expect(statements.length).toBeGreaterThan(0);
    const result = await getProgress(db, USER_ID);
    expect(result?.srsStore['λόγος']).toEqual(makeCard('λόγος'));
  });
});
