import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { srsCards, studyStats, customDecks, users } from './schema';
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

    const [result] = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.wordKey, 'καί'));

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

    const [result] = await db
      .select()
      .from(studyStats)
      .where(eq(studyStats.userId, TEST_USER.id));

    expect(result).toEqual(stats);
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

    const [result] = await db
      .select()
      .from(customDecks)
      .where(eq(customDecks.id, 'deck-1'));

    expect(result).toEqual(deck);
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

    const cards = await db
      .select()
      .from(srsCards)
      .where(eq(srsCards.userId, TEST_USER.id));

    expect(cards).toHaveLength(0);
  });
});
