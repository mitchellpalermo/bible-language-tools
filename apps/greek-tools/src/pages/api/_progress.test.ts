import { users } from '@tools/db/schema';
import { createTestDb } from '@tools/db/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SRSCard, StudyStats } from '../../data/srs';

// Route handlers call createDb(binding); point them at a real in-memory
// SQLite database so these tests exercise route → store → SQL end to end.
let testDb: ReturnType<typeof createTestDb>;
vi.mock('@tools/db', () => ({
  createDb: vi.fn(() => testDb),
}));

import { DELETE, GET, MAX_BODY_BYTES, PUT } from './progress';

const USER_ID = 'user-1';

const stats: StudyStats = {
  streak: 4,
  lastStreakDate: '2026-06-09',
  cardsStudiedToday: 12,
  lastStudyDate: '2026-06-09',
  totalReviewed: 250,
  totalCorrect: 210,
};

function makeCard(key: string): SRSCard {
  return {
    key,
    interval: 6,
    repetition: 2,
    easeFactor: 2.5,
    dueDate: '2026-06-15',
    lastReviewed: '2026-06-09',
  };
}

const validPayload = {
  srsStore: { λόγος: makeCard('λόγος') },
  studyStats: stats,
  customDecks: [
    { id: 'deck-1', name: 'John 1', wordKeys: ['λόγος'], createdAt: '2026-06-01T12:00:00.000Z' },
  ],
};

function makeContext({
  user = { id: USER_ID, email: 'test@example.com' },
  body,
  contentType = 'application/json',
}: {
  user?: { id: string; email: string } | null;
  body?: string;
  contentType?: string;
} = {}) {
  const request = new Request('http://localhost/api/progress', {
    method: body === undefined ? 'GET' : 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  return {
    request,
    locals: {
      runtime: { env: { DB: {} as D1Database, BETTER_AUTH_SECRET: 'test-secret' } },
      user,
    },
  } as never;
}

describe('/api/progress', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await testDb
      .insert(users)
      .values({ id: USER_ID, email: 'test@example.com', createdAt: new Date('2026-01-01') });
  });

  describe('auth guard', () => {
    it.each([
      ['GET', () => GET(makeContext({ user: null }))],
      ['PUT', () => PUT(makeContext({ user: null, body: JSON.stringify(validPayload) }))],
      ['DELETE', () => DELETE(makeContext({ user: null }))],
    ])('%s returns 401 without a session', async (_method, call) => {
      const response = await call();
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('GET', () => {
    it('returns { data: null } for a user with no prior progress', async () => {
      const response = await GET(makeContext());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: null });
    });
  });

  describe('PUT then GET', () => {
    it('round-trips the full payload exactly', async () => {
      const putResponse = await PUT(makeContext({ body: JSON.stringify(validPayload) }));
      expect(putResponse.status).toBe(200);
      const { syncedAt } = (await putResponse.json()) as { syncedAt: string };

      const getResponse = await GET(makeContext());
      const { data } = (await getResponse.json()) as { data: unknown };
      expect(data).toEqual({ ...validPayload, syncedAt });
    });

    it('assigns syncedAt on the server, ignoring a client-provided value', async () => {
      const body = JSON.stringify({ ...validPayload, syncedAt: '1999-01-01T00:00:00.000Z' });
      const response = await PUT(makeContext({ body }));
      const { syncedAt } = (await response.json()) as { syncedAt: string };
      expect(syncedAt).not.toBe('1999-01-01T00:00:00.000Z');
      expect(new Date(syncedAt).getFullYear()).toBeGreaterThanOrEqual(2026);
    });

    it('accepts non-JSON content types (keepalive pushes)', async () => {
      const response = await PUT(
        makeContext({ body: JSON.stringify(validPayload), contentType: 'text/plain' }),
      );
      expect(response.status).toBe(200);
    });
  });

  describe('PUT validation', () => {
    it('rejects bodies over the size limit with 413', async () => {
      const oversized = JSON.stringify({
        ...validPayload,
        padding: 'x'.repeat(MAX_BODY_BYTES),
      });
      const response = await PUT(makeContext({ body: oversized }));
      expect(response.status).toBe(413);
    });

    it('rejects malformed JSON with 400', async () => {
      const response = await PUT(makeContext({ body: 'not json{' }));
      expect(response.status).toBe(400);
    });

    it.each([
      ['srsStore is an array', { ...validPayload, srsStore: [] }],
      ['srsStore is null', { ...validPayload, srsStore: null }],
      ['studyStats is missing fields', { ...validPayload, studyStats: { streak: 1 } }],
      ['studyStats has wrong types', { ...validPayload, studyStats: { ...stats, streak: 'high' } }],
      ['customDecks is not an array', { ...validPayload, customDecks: {} }],
      ['a deck is missing its id', { ...validPayload, customDecks: [{ name: 'x' }] }],
      [
        'a card has non-numeric fields',
        { ...validPayload, srsStore: { καί: { ...makeCard('καί'), repetition: 'two' } } },
      ],
    ])('rejects payload where %s', async (_label, payload) => {
      const response = await PUT(makeContext({ body: JSON.stringify(payload) }));
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE', () => {
    it('removes all progress; subsequent GET returns { data: null }', async () => {
      await PUT(makeContext({ body: JSON.stringify(validPayload) }));

      const deleteResponse = await DELETE(makeContext());
      expect(deleteResponse.status).toBe(200);
      expect(await deleteResponse.json()).toEqual({ ok: true });

      const getResponse = await GET(makeContext());
      expect(await getResponse.json()).toEqual({ data: null });
    });
  });
});
