import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { attempts, customDecks, ladderProgress, srsCards, studyStats, users } from './schema';
import { createTestDb } from './test-utils';

const TEST_USER = {
  id: 'user-1',
  email: 'test@example.com',
  createdAt: new Date('2026-01-01'),
};

describe('schema smoke tests', () => {
  it('inserts and reads back an srs_card row', async () => {
    const db = createTestDb();
    await db.insert(users).values(TEST_USER);

    const card = {
      userId: TEST_USER.id,
      language: 'greek' as const,
      wordKey: 'καί',
      interval: 6,
      repetition: 2,
      easeFactor: 2.5,
      dueDate: '2026-06-15',
      lastReviewed: '2026-06-09',
    };

    await db.insert(srsCards).values(card);

    const [result] = await db.select().from(srsCards).where(eq(srsCards.wordKey, 'καί'));

    expect(result).toEqual(card);
  });

  it('upserts study_stats correctly', async () => {
    const db = createTestDb();
    await db.insert(users).values(TEST_USER);

    const stats = {
      userId: TEST_USER.id,
      language: 'greek' as const,
      streak: 5,
      lastStreakDate: '2026-06-09',
      cardsStudiedToday: 12,
      lastStudyDate: '2026-06-09',
      totalReviewed: 120,
      totalCorrect: 105,
    };

    await db.insert(studyStats).values(stats);

    const [result] = await db.select().from(studyStats).where(eq(studyStats.userId, TEST_USER.id));

    // A row written without the Today streak (greek.tools, until #197) takes
    // its defaults.
    expect(result).toEqual({ ...stats, studyStreak: 0, lastSessionDate: '' });
  });

  it('inserts and reads back a custom_deck row', async () => {
    const db = createTestDb();
    await db.insert(users).values(TEST_USER);

    const deck = {
      id: 'deck-1',
      userId: TEST_USER.id,
      language: 'greek' as const,
      name: 'My Vocab',
      wordKeys: JSON.stringify(['καί', 'ὁ', 'αὐτός']),
      createdAt: '2026-06-09T10:00:00.000Z',
    };

    await db.insert(customDecks).values(deck);

    const [result] = await db.select().from(customDecks).where(eq(customDecks.id, 'deck-1'));

    // A row written without the tombstone columns takes their defaults.
    expect(result).toEqual({ ...deck, updatedAt: '', deletedAt: null });

    await db.insert(customDecks).values({
      ...deck,
      id: 'deck-2',
      updatedAt: '2026-06-10T10:00:00.000Z',
      deletedAt: '2026-06-10T10:00:00.000Z',
    });
    const [tomb] = await db.select().from(customDecks).where(eq(customDecks.id, 'deck-2'));
    expect(tomb.deletedAt).toBe('2026-06-10T10:00:00.000Z');
  });

  it('cascades deletes from users to all progress tables', async () => {
    const db = createTestDb();
    await db.insert(users).values(TEST_USER);
    await db.insert(srsCards).values({
      userId: TEST_USER.id,
      language: 'greek' as const,
      wordKey: 'λόγος',
      interval: 1,
      repetition: 0,
      easeFactor: 2.5,
      dueDate: '2026-06-10',
      lastReviewed: '',
    });

    await db.delete(users).where(eq(users.id, TEST_USER.id));

    const cards = await db.select().from(srsCards).where(eq(srsCards.userId, TEST_USER.id));

    expect(cards).toHaveLength(0);
  });

  it('round-trips an attempt, with and without its optional fields', async () => {
    const db = createTestDb();
    await db.insert(users).values(TEST_USER);
    const full = {
      userId: TEST_USER.id,
      language: 'hebrew' as const,
      id: 'a1',
      concept: 'accent-shift/open-pretonic-long',
      correct: false,
      ms: 1840,
      confidence: 2,
      at: 1_793_000_000_000,
    };
    const bare = { ...full, id: 'a2', correct: true, ms: null, confidence: null };
    await db.insert(attempts).values([full, bare]);
    expect(await db.select().from(attempts).orderBy(attempts.id)).toEqual([full, bare]);
  });

  it('cascades deletes from users to the attempt log and ladder progress', async () => {
    const db = createTestDb();
    await db.insert(users).values(TEST_USER);
    await db.insert(attempts).values({
      userId: TEST_USER.id,
      language: 'hebrew',
      id: 'a1',
      concept: 'paradigm/x',
      correct: true,
      at: 1,
    });
    await db
      .insert(ladderProgress)
      .values({ userId: TEST_USER.id, language: 'hebrew', rungId: 'r1', cleanWrites: 2 });
    await db.delete(users).where(eq(users.id, TEST_USER.id));
    expect(await db.select().from(attempts)).toHaveLength(0);
    expect(await db.select().from(ladderProgress)).toHaveLength(0);
  });
});
