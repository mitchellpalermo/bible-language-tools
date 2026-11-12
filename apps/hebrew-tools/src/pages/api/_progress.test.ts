// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tools/db', () => ({ createDb: vi.fn(() => ({})) }));
vi.mock('../../lib/progress-store', () => ({
  getProgress: vi.fn(),
  putProgress: vi.fn(),
  deleteProgress: vi.fn(),
}));

import { deleteProgress, getProgress, putProgress } from '../../lib/progress-store';
import { DELETE, GET, MAX_BODY_BYTES, MAX_RUNG_ID_LENGTH, MAX_RUNGS, PUT } from './progress';

const validStats = {
  streak: 3,
  lastStreakDate: '2026-08-08',
  cardsStudiedToday: 7,
  lastStudyDate: '2026-08-08',
  totalReviewed: 42,
  totalCorrect: 35,
};

const validCard = {
  interval: 6,
  repetition: 2,
  easeFactor: 2.5,
  dueDate: '2026-08-14',
  lastReviewed: '2026-08-08',
};

function ctx(body?: unknown, { signedIn = true } = {}) {
  return {
    locals: {
      user: signedIn ? { id: 'user-1', email: 'me@example.com' } : null,
      runtime: { env: { DB: {} as D1Database } },
    },
    request: new Request('http://localhost/api/progress', {
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth', () => {
  it.each([
    ['GET', () => GET(ctx(undefined, { signedIn: false }) as never)],
    ['PUT', () => PUT(ctx({ srsStore: {}, studyStats: validStats }, { signedIn: false }) as never)],
    ['DELETE', () => DELETE(ctx(undefined, { signedIn: false }) as never)],
  ])('%s returns 401 when signed out', async (_method, call) => {
    const response = await call();
    expect(response.status).toBe(401);
    // Identical message for missing and expired sessions — do not leak which.
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('does not touch the database when signed out', async () => {
    await GET(ctx(undefined, { signedIn: false }) as never);
    expect(getProgress).not.toHaveBeenCalled();
  });
});

describe('GET', () => {
  it('returns the stored payload', async () => {
    const payload = { srsStore: {}, studyStats: validStats, syncedAt: '2026-08-08T12:00:00.000Z' };
    vi.mocked(getProgress).mockResolvedValue(payload);

    const response = await GET(ctx() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: payload });
  });

  it('returns data: null for an account that has never synced', async () => {
    vi.mocked(getProgress).mockResolvedValue(null);

    expect(await (await GET(ctx() as never)).json()).toEqual({ data: null });
  });
});

describe('PUT validation', () => {
  it('accepts a well-formed payload and returns the server syncedAt', async () => {
    vi.mocked(putProgress).mockResolvedValue('2026-08-08T12:00:00.000Z');

    const response = await PUT(
      ctx({ srsStore: { מֶלֶךְ: validCard }, studyStats: validStats }) as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ syncedAt: '2026-08-08T12:00:00.000Z' });
  });

  it('ignores a client-supplied syncedAt', async () => {
    vi.mocked(putProgress).mockResolvedValue('server-time');

    await PUT(ctx({ srsStore: {}, studyStats: validStats, syncedAt: 'client-lies' }) as never);

    expect(vi.mocked(putProgress).mock.calls[0][2]).not.toHaveProperty('syncedAt');
  });

  it('passes a valid Today study streak through', async () => {
    vi.mocked(putProgress).mockResolvedValue('server-time');
    const studyStreak = { streak: 2, lastSessionDate: '2026-11-02' };

    const response = await PUT(ctx({ srsStore: {}, studyStats: validStats, studyStreak }) as never);

    expect(response.status).toBe(200);
    expect(vi.mocked(putProgress).mock.calls[0][2].studyStreak).toEqual(studyStreak);
  });

  it('accepts a payload with no study streak, from a page loaded before it existed', async () => {
    vi.mocked(putProgress).mockResolvedValue('server-time');
    const response = await PUT(ctx({ srsStore: {}, studyStats: validStats }) as never);
    expect(response.status).toBe(200);
    expect(vi.mocked(putProgress).mock.calls[0][2].studyStreak).toBeUndefined();
  });

  it.each([
    { streak: '2', lastSessionDate: '2026-11-02' },
    { streak: 2, lastSessionDate: 'Monday' },
    { streak: -1, lastSessionDate: '' },
    null,
  ])('rejects a malformed study streak %j with 400', async (studyStreak) => {
    const response = await PUT(ctx({ srsStore: {}, studyStats: validStats, studyStreak }) as never);
    expect(response.status).toBe(400);
    expect(putProgress).not.toHaveBeenCalled();
  });

  it('passes valid ladder progress through, and accepts a payload without it', async () => {
    vi.mocked(putProgress).mockResolvedValue('server-time');
    const ladderProgress = { 'suffix-bare-type1': 2, 'suffix-prep-le': 0 };

    expect(
      (await PUT(ctx({ srsStore: {}, studyStats: validStats, ladderProgress }) as never)).status,
    ).toBe(200);
    expect(vi.mocked(putProgress).mock.calls[0][2].ladderProgress).toEqual(ladderProgress);

    expect((await PUT(ctx({ srsStore: {}, studyStats: validStats }) as never)).status).toBe(200);
    expect(vi.mocked(putProgress).mock.calls[1][2].ladderProgress).toBeUndefined();
  });

  it('passes valid custom decks through, tombstones included, and accepts a payload without them', async () => {
    vi.mocked(putProgress).mockResolvedValue('server-time');
    const live = {
      id: 'deck-1',
      name: 'Genesis 1',
      wordKeys: ['b', 'a'],
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };
    const gone = {
      ...live,
      id: 'deck-2',
      wordKeys: [],
      deletedAt: '2026-11-02T00:00:00.000Z',
    };

    expect(
      (await PUT(ctx({ srsStore: {}, studyStats: validStats, customDecks: [live, gone] }) as never))
        .status,
    ).toBe(200);
    // Parsed, so the words arrive sorted.
    expect(vi.mocked(putProgress).mock.calls[0][2].customDecks).toEqual([
      { ...live, wordKeys: ['a', 'b'] },
      gone,
    ]);

    expect((await PUT(ctx({ srsStore: {}, studyStats: validStats }) as never)).status).toBe(200);
    expect(vi.mocked(putProgress).mock.calls[1][2].customDecks).toBeUndefined();
  });

  const at = '2026-11-01T00:00:00.000Z';
  it.each([
    ['not an array', { id: 'x' }],
    ['a deck with no id', [{ name: 'x', wordKeys: [], createdAt: at }]],
    [
      'a deck with an over-long name',
      [{ id: 'x', name: 'n'.repeat(61), wordKeys: [], createdAt: at }],
    ],
    ['a deck with a non-string word', [{ id: 'x', name: 'n', wordKeys: [1], createdAt: at }]],
    ['a deck with a bad date', [{ id: 'x', name: 'n', wordKeys: [], createdAt: 'soon' }]],
    [
      'two decks with one id',
      [
        { id: 'x', name: 'n', wordKeys: [], createdAt: at },
        { id: 'x', name: 'm', wordKeys: [], createdAt: at },
      ],
    ],
  ])('rejects custom decks that are %s with 400', async (_label, customDecks) => {
    const response = await PUT(ctx({ srsStore: {}, studyStats: validStats, customDecks }) as never);
    expect(response.status).toBe(400);
    expect(putProgress).not.toHaveBeenCalled();
  });

  it('passes valid focus passages through, tombstones included, and accepts a payload without them', async () => {
    vi.mocked(putProgress).mockResolvedValue('server-time');
    const live = {
      id: 'p-1',
      label: ' Creation ',
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 5,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };
    const gone = { ...live, id: 'p-2', deletedAt: '2026-11-02T00:00:00.000Z' };

    expect(
      (
        await PUT(
          ctx({ srsStore: {}, studyStats: validStats, focusPassages: [live, gone] }) as never,
        )
      ).status,
    ).toBe(200);
    // Parsed, so the label arrives trimmed and a tombstone carries none.
    const sent = vi.mocked(putProgress).mock.calls[0][2].focusPassages;
    expect(sent?.[0]).toEqual({ ...live, label: 'Creation' });
    expect(sent?.[1].label).toBeUndefined();
    expect(sent?.[1].deletedAt).toBeDefined();

    expect((await PUT(ctx({ srsStore: {}, studyStats: validStats }) as never)).status).toBe(200);
    expect(vi.mocked(putProgress).mock.calls[1][2].focusPassages).toBeUndefined();
  });

  const passageAt = '2026-11-01T00:00:00.000Z';
  const validPassage = {
    id: 'x',
    book: 'GEN',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 5,
    createdAt: passageAt,
  };
  it.each([
    ['not an array', { id: 'x' }],
    ['a passage with no id', [{ ...validPassage, id: undefined }]],
    ['a passage that ends before it starts', [{ ...validPassage, endVerse: 0, startVerse: 3 }]],
    ['a passage with a non-numeric verse', [{ ...validPassage, endVerse: '5' }]],
    ['a passage with an over-long name', [{ ...validPassage, label: 'n'.repeat(101) }]],
    ['a passage with a bad date', [{ ...validPassage, createdAt: 'soon' }]],
    ['two passages with one id', [validPassage, validPassage]],
  ])('rejects focus passages that are %s with 400', async (_label, focusPassages) => {
    const response = await PUT(
      ctx({ srsStore: {}, studyStats: validStats, focusPassages }) as never,
    );
    expect(response.status).toBe(400);
    expect(putProgress).not.toHaveBeenCalled();
  });

  it.each([
    ['an array', []],
    ['null', null],
    ['a negative count', { r1: -1 }],
    ['a fractional count', { r1: 1.5 }],
    ['a string count', { r1: '2' }],
    ['an empty rung id', { '': 1 }],
    ['an over-long rung id', { ['r'.repeat(MAX_RUNG_ID_LENGTH + 1)]: 1 }],
    [
      'too many rungs',
      Object.fromEntries(Array.from({ length: MAX_RUNGS + 1 }, (_, i) => [`r${i}`, 1])),
    ],
  ])('rejects ladder progress that is %s with 400', async (_label, ladderProgress) => {
    const response = await PUT(
      ctx({ srsStore: {}, studyStats: validStats, ladderProgress }) as never,
    );
    expect(response.status).toBe(400);
    expect(putProgress).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await PUT(ctx('{not json') as never);
    expect(response.status).toBe(400);
  });

  it('rejects a body over the size cap with 413', async () => {
    const huge = 'x'.repeat(MAX_BODY_BYTES + 1);
    const response = await PUT(ctx(JSON.stringify({ pad: huge })) as never);

    expect(response.status).toBe(413);
    expect(putProgress).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-object body', '"just a string"'],
    ['a missing srsStore', JSON.stringify({ studyStats: validStats })],
    ['an array srsStore', JSON.stringify({ srsStore: [], studyStats: validStats })],
    ['missing studyStats', JSON.stringify({ srsStore: {} })],
    [
      'a non-numeric stats counter',
      JSON.stringify({ srsStore: {}, studyStats: { ...validStats, streak: 'three' } }),
    ],
    [
      'a non-string stats date',
      JSON.stringify({ srsStore: {}, studyStats: { ...validStats, lastStudyDate: 20260808 } }),
    ],
    [
      'a card with a non-numeric interval',
      JSON.stringify({
        srsStore: { מֶלֶךְ: { ...validCard, interval: 'six' } },
        studyStats: validStats,
      }),
    ],
    [
      'a card missing dueDate',
      JSON.stringify({
        srsStore: { מֶלֶךְ: { interval: 1, repetition: 1, easeFactor: 2.5, lastReviewed: '' } },
        studyStats: validStats,
      }),
    ],
    ['a null card', JSON.stringify({ srsStore: { מֶלֶךְ: null }, studyStats: validStats })],
  ])('rejects %s with 400', async (_label, body) => {
    const response = await PUT(ctx(body) as never);

    expect(response.status).toBe(400);
    expect(putProgress).not.toHaveBeenCalled();
  });
});

describe('DELETE', () => {
  it('clears progress for the signed-in user', async () => {
    vi.mocked(deleteProgress).mockResolvedValue(undefined);

    const response = await DELETE(ctx() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(vi.mocked(deleteProgress).mock.calls[0][1]).toBe('user-1');
  });
});
