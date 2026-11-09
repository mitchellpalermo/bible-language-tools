import {
  type Attempt,
  KEEPALIVE_ATTEMPTS,
  MAX_ATTEMPTS_PER_REQUEST,
} from '@tools/shared/attempt-log';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SRSCard } from '../data/srs';
import { loadSRSStore, loadStats, SRS_KEY, STATS_KEY } from '../data/srs';
import { ATTEMPT_LOG_KEY, loadAttempts, logAttempts } from './attempt-log';
import { loadStudyStreak, STUDY_STREAK_KEY } from './study-streak';
import { LADDER_PROGRESS_KEY, loadLadderProgress, saveLadderProgress } from './suffix-ladder';
import {
  ATTEMPT_CURSOR_KEY,
  clearLocalProgress,
  deleteServerProgress,
  drainOwedAttempts,
  formatRelativeTime,
  getLastSyncedAt,
  hasImportBeenOffered,
  hasLocalProgress,
  LAST_SYNCED_KEY,
  markImportOffered,
  pullAndMerge,
  push,
  pushAttempts,
  readLocalProgress,
  registerSessionEndPush,
  setLastSyncedAt,
  writeLocalProgress,
} from './sync-manager';

function card(overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    key: 'מֶלֶךְ',
    interval: 6,
    repetition: 2,
    easeFactor: 2.5,
    dueDate: '2026-08-14',
    lastReviewed: '2026-08-08',
    ...overrides,
  };
}

const emptyStats = {
  streak: 0,
  lastStreakDate: '',
  cardsStudiedToday: 0,
  lastStudyDate: '',
  totalReviewed: 0,
  totalCorrect: 0,
};

function seedLocal(store: Record<string, SRSCard>) {
  localStorage.setItem('hebrew-tools-srs-v1', JSON.stringify(store));
}

function mockFetch(...responses: Array<Partial<Response> | Error>) {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

const okJson = (body: unknown) => ({ ok: true, json: async () => body });

/**
 * One account on a pretend server, behind a fake `fetch` that routes by method
 * and URL — the two pulls run side by side, so call order means nothing. The
 * progress PUT merges like the real one; the attempts POST is a union by id.
 * `fail` makes the named route answer 500.
 */
function fakeAccount() {
  const account = {
    progress: null as null | Record<string, unknown>,
    attempts: [] as Attempt[],
    posts: [] as Attempt[][],
    fail: new Set<string>(),
  };
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const route = `${init.method ?? 'GET'} ${url}`;
    if (account.fail.has(route)) return { ok: false, status: 500 };
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    switch (route) {
      case 'GET /api/progress':
        return okJson({ data: account.progress });
      case 'PUT /api/progress':
        account.progress = { ...body, syncedAt: '2026-11-02T12:00:00.000Z' };
        return okJson({ syncedAt: '2026-11-02T12:00:00.000Z' });
      case 'DELETE /api/progress':
        account.progress = null;
        account.attempts = [];
        return { ok: true };
      case 'GET /api/attempts':
        return okJson({ attempts: account.attempts });
      case 'POST /api/attempts': {
        account.posts.push(body.attempts);
        const have = new Set(account.attempts.map((a) => a.id));
        account.attempts.push(...body.attempts.filter((a: Attempt) => !have.has(a.id)));
        return okJson({ ok: true });
      }
      default:
        throw new Error(`unexpected ${route}`);
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  return { account, fetchMock };
}

/** Switch to another device: same account, empty browser. */
function newDevice() {
  localStorage.clear();
}

function logMany(n: number, at = 1000) {
  logAttempts(
    Array.from({ length: n }, (_, i) => ({ concept: `paradigm/c${i}`, correct: i % 2 === 0 })),
    at,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local snapshot helpers', () => {
  it('reads the SRS store and stats out of localStorage', () => {
    seedLocal({ מֶלֶךְ: card() });

    expect(readLocalProgress().srsStore.מֶלֶךְ.repetition).toBe(2);
  });

  it('writes a snapshot back through the normal save paths', () => {
    writeLocalProgress({ srsStore: { אֵשׁ: card({ key: 'אֵשׁ' }) }, studyStats: emptyStats });

    expect(loadSRSStore().אֵשׁ).toBeDefined();
    expect(loadStats().totalReviewed).toBe(0);
  });

  it('carries ladder progress both ways', () => {
    writeLocalProgress({ srsStore: {}, studyStats: emptyStats, ladderProgress: { r1: 2 } });

    expect(loadLadderProgress()).toEqual({ r1: 2 });
    expect(readLocalProgress().ladderProgress).toEqual({ r1: 2 });
  });

  it('never lowers a rung this device has climbed since the snapshot was taken', () => {
    // A clean write checked while a pull was in flight.
    saveLadderProgress({ r1: 3, r2: 1 });
    writeLocalProgress({ srsStore: {}, studyStats: emptyStats, ladderProgress: { r1: 2, r3: 1 } });

    expect(loadLadderProgress()).toEqual({ r1: 3, r2: 1, r3: 1 });
  });

  it('carries the Today study streak both ways', () => {
    const studyStreak = { streak: 3, lastSessionDate: '2026-11-02' };
    writeLocalProgress({ srsStore: {}, studyStats: emptyStats, studyStreak });

    expect(loadStudyStreak()).toEqual(studyStreak);
    expect(readLocalProgress().studyStreak).toEqual(studyStreak);
  });
});

describe('clearLocalProgress', () => {
  it('erases everything a push would upload, and the attempt cursor', () => {
    seedLocal({ מֶלֶךְ: card() });
    writeLocalProgress({
      srsStore: { מֶלֶךְ: card() },
      studyStats: { ...emptyStats, totalReviewed: 4 },
      studyStreak: { streak: 2, lastSessionDate: '2026-11-02' },
      ladderProgress: { r1: 2 },
    });
    logAttempts([{ concept: 'a', correct: true }]);
    localStorage.setItem(ATTEMPT_CURSOR_KEY, '5');
    localStorage.setItem('unrelated', 'kept');

    clearLocalProgress();

    for (const key of [
      SRS_KEY,
      STATS_KEY,
      STUDY_STREAK_KEY,
      LADDER_PROGRESS_KEY,
      ATTEMPT_LOG_KEY,
      ATTEMPT_CURSOR_KEY,
    ]) {
      expect(localStorage.getItem(key), key).toBeNull();
    }
    expect(localStorage.getItem('unrelated')).toBe('kept');
  });
});

describe('hasLocalProgress', () => {
  it('is false with an empty store', () => {
    expect(hasLocalProgress()).toBe(false);
  });

  it('is false when cards exist but none has been reviewed', () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 0 }) });
    expect(hasLocalProgress()).toBe(false);
  });

  it('is true once any card has a review on it', () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 1 }) });
    expect(hasLocalProgress()).toBe(true);
  });
});

describe('import-offered flag', () => {
  it('is keyed per user, not per browser', () => {
    markImportOffered('user-a');

    expect(hasImportBeenOffered('user-a')).toBe(true);
    expect(hasImportBeenOffered('user-b')).toBe(false);
  });

  it('defaults to not-offered', () => {
    expect(hasImportBeenOffered('nobody')).toBe(false);
  });
});

describe('last-synced timestamp', () => {
  it('round-trips', () => {
    setLastSyncedAt('2026-08-08T12:00:00.000Z');
    expect(getLastSyncedAt()).toBe('2026-08-08T12:00:00.000Z');
    expect(localStorage.getItem(LAST_SYNCED_KEY)).toBe('2026-08-08T12:00:00.000Z');
  });

  it('is null before any sync', () => {
    expect(getLastSyncedAt()).toBeNull();
  });
});

describe('push', () => {
  it('PUTs the local snapshot and records syncedAt', async () => {
    seedLocal({ מֶלֶךְ: card() });
    const fetchMock = mockFetch(okJson({ syncedAt: '2026-08-08T12:00:00.000Z' }));

    expect(await push()).toBe(true);
    expect(getLastSyncedAt()).toBe('2026-08-08T12:00:00.000Z');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/progress');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).srsStore.מֶלֶךְ).toBeDefined();
  });

  it('returns false on a non-ok response without recording a sync', async () => {
    mockFetch({ ok: false, status: 401 });

    expect(await push()).toBe(false);
    expect(getLastSyncedAt()).toBeNull();
  });

  it('swallows network errors — a sync failure must not break studying', async () => {
    mockFetch(new Error('offline'));

    await expect(push()).resolves.toBe(false);
  });

  it('forwards request init, so keepalive pushes stay keepalive', async () => {
    const fetchMock = mockFetch(okJson({ syncedAt: '2026-08-08T12:00:00.000Z' }));

    await push({ keepalive: true });

    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });

  it('sends the ladder with the snapshot', async () => {
    saveLadderProgress({ r1: 2 });
    const { account } = fakeAccount();

    await push();

    expect(account.progress?.ladderProgress).toEqual({ r1: 2 });
  });

  it('sends the attempts logged since the last push, and only those', async () => {
    const { account } = fakeAccount();
    logMany(2, 100);
    expect(await push()).toBe(true);
    expect(account.posts.map((p) => p.length)).toEqual([2]);

    expect(await push()).toBe(true);
    expect(account.posts).toHaveLength(1);

    logAttempts([{ concept: 'paradigm/new', correct: true }]);
    expect(await push()).toBe(true);
    expect(account.posts[1].map((a) => a.concept)).toEqual(['paradigm/new']);
  });

  it('starts both requests before awaiting either, so an unloading page still sends both', () => {
    const { fetchMock } = fakeAccount();
    logMany(1);

    void push({ keepalive: true });

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.keepalive])).toEqual([
      ['/api/attempts', true],
      ['/api/progress', true],
    ]);
  });

  it('caps a keepalive push to what a keepalive request may carry', async () => {
    const { account } = fakeAccount();
    // A long session that never hid the tab: one check a moment, as drills log.
    for (let i = 0; i < KEEPALIVE_ATTEMPTS + 51; i++) {
      logAttempts([{ concept: `paradigm/c${i}`, correct: true }], 100 + i);
    }

    expect(await push({ keepalive: true })).toBe(true);
    expect(account.posts.map((p) => p.length)).toEqual([KEEPALIVE_ATTEMPTS]);

    // The next push, a page load's, sends the rest in full.
    expect(await pushAttempts()).toBe(true);
    expect(account.attempts).toHaveLength(KEEPALIVE_ATTEMPTS + 51);
  });

  it('keeps attempts owed when their request fails, and sends them next time', async () => {
    const { account } = fakeAccount();
    logMany(2);
    account.fail.add('POST /api/attempts');

    expect(await push()).toBe(false);
    // The progress half still landed.
    expect(getLastSyncedAt()).toBe('2026-11-02T12:00:00.000Z');

    account.fail.clear();
    expect(await push()).toBe(true);
    expect(account.attempts).toHaveLength(2);
  });

  it('reads a corrupt cursor as owing the whole log', async () => {
    const { account } = fakeAccount();
    logMany(2, 100);
    localStorage.setItem(ATTEMPT_CURSOR_KEY, 'not a number');

    await pushAttempts();

    expect(account.attempts).toHaveLength(2);
  });

  it('swallows a network error on the attempts', async () => {
    logMany(1);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(pushAttempts()).resolves.toBe(false);
  });
});

describe('drainOwedAttempts', () => {
  it('sends owed attempts on page load when signed in', async () => {
    document.cookie = 'ht-auth=1';
    const { account } = fakeAccount();
    logMany(2);

    drainOwedAttempts();

    await vi.waitFor(() => expect(account.attempts).toHaveLength(2));
  });

  it('sends nothing when nothing is owed', async () => {
    document.cookie = 'ht-auth=1';
    const { fetchMock } = fakeAccount();

    drainOwedAttempts();
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when signed out', () => {
    document.cookie = 'ht-auth=; Max-Age=0';
    const { fetchMock } = fakeAccount();
    logMany(2);

    drainOwedAttempts();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('pullAndMerge', () => {
  it('merges server progress into local and pushes the result', async () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 1 }) });
    const { account } = fakeAccount();
    account.progress = {
      srsStore: { מֶלֶךְ: card({ repetition: 5 }), אֵשׁ: card({ key: 'אֵשׁ' }) },
      studyStats: emptyStats,
      syncedAt: '2026-08-01T00:00:00.000Z',
    };

    const result = await pullAndMerge();

    expect(result).toEqual({ hadServerData: true, ok: true });
    // Local now holds the further-along card plus the one it had never seen.
    const local = loadSRSStore();
    expect(local.מֶלֶךְ.repetition).toBe(5);
    expect(local.אֵשׁ).toBeDefined();
    // And the merged result went back to the server.
    expect((account.progress?.srsStore as Record<string, SRSCard>).אֵשׁ).toBeDefined();
    expect(getLastSyncedAt()).toBe('2026-11-02T12:00:00.000Z');
  });

  it('reports hadServerData false for an account that has never synced', async () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 3 }) });
    fakeAccount();

    const result = await pullAndMerge();

    expect(result).toEqual({ hadServerData: false, ok: true });
    // Local progress survives untouched.
    expect(loadSRSStore().מֶלֶךְ.repetition).toBe(3);
  });

  it('keeps local progress when the pull fails', async () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 3 }) });
    const { account } = fakeAccount();
    account.fail.add('GET /api/progress');

    expect(await pullAndMerge()).toEqual({ hadServerData: false, ok: false });
    expect(loadSRSStore().מֶלֶךְ.repetition).toBe(3);
  });

  it('reports not-ok when the follow-up push fails, but keeps the merge locally', async () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 1 }) });
    const { account } = fakeAccount();
    account.progress = {
      srsStore: { מֶלֶךְ: card({ repetition: 9 }) },
      studyStats: emptyStats,
      syncedAt: '2026-08-01T00:00:00.000Z',
    };
    account.fail.add('PUT /api/progress');

    expect(await pullAndMerge()).toEqual({ hadServerData: true, ok: false });
    expect(loadSRSStore().מֶלֶךְ.repetition).toBe(9);
    expect(getLastSyncedAt()).toBeNull();
  });

  it('swallows network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(pullAndMerge()).resolves.toEqual({ hadServerData: false, ok: false });
  });

  it('merges the ladder by the larger count per rung, both ways', async () => {
    saveLadderProgress({ r1: 1, r2: 2 });
    const { account } = fakeAccount();
    account.progress = {
      srsStore: {},
      studyStats: emptyStats,
      ladderProgress: { r1: 2, r3: 1 },
      syncedAt: '2026-08-01T00:00:00.000Z',
    };

    await pullAndMerge();

    expect(loadLadderProgress()).toEqual({ r1: 2, r2: 2, r3: 1 });
    expect(account.progress?.ladderProgress).toEqual({ r1: 2, r2: 2, r3: 1 });
  });

  it('brings the account’s attempts down and sends up only what it lacks', async () => {
    const { account } = fakeAccount();
    account.attempts = [{ id: 'from-ipad', concept: 'paradigm/x', correct: false, at: 500 }];
    logAttempts([{ concept: 'paradigm/y', correct: true }], 900);

    expect(await pullAndMerge()).toEqual({ hadServerData: false, ok: true });

    expect(loadAttempts().map((a) => a.concept)).toEqual(['paradigm/x', 'paradigm/y']);
    expect(account.posts).toHaveLength(1);
    expect(account.posts[0].map((a) => a.concept)).toEqual(['paradigm/y']);
    expect(account.attempts).toHaveLength(2);
  });

  it('sends a device’s first full log in requests the server accepts', async () => {
    const { account } = fakeAccount();
    logMany(MAX_ATTEMPTS_PER_REQUEST * 2 + 5);

    expect((await pullAndMerge()).ok).toBe(true);

    expect(account.posts.map((p) => p.length)).toEqual([
      MAX_ATTEMPTS_PER_REQUEST,
      MAX_ATTEMPTS_PER_REQUEST,
      5,
    ]);
    // And the cursor moved, so the next push owes nothing.
    account.posts = [];
    expect(await pushAttempts()).toBe(true);
    expect(account.posts).toEqual([]);
  });

  it('reports not-ok when the attempts fail, and keeps the progress merge', async () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 1 }) });
    const { account } = fakeAccount();
    account.progress = {
      srsStore: { מֶלֶךְ: card({ repetition: 4 }) },
      studyStats: emptyStats,
      syncedAt: '2026-08-01T00:00:00.000Z',
    };
    account.fail.add('GET /api/attempts');

    expect(await pullAndMerge()).toEqual({ hadServerData: true, ok: false });
    expect(loadSRSStore().מֶלֶךְ.repetition).toBe(4);
  });

  it('keeps the cursor when sending the missing attempts fails', async () => {
    const { account } = fakeAccount();
    logMany(3);
    account.fail.add('POST /api/attempts');

    expect((await pullAndMerge()).ok).toBe(false);
    expect(localStorage.getItem(ATTEMPT_CURSOR_KEY)).toBeNull();
  });

  it('ignores malformed attempts in the response', async () => {
    const { account } = fakeAccount();
    account.attempts = [
      { id: 'ok', concept: 'c', correct: true, at: 1 },
      { id: 'bad', concept: 'c' } as Attempt,
    ];

    await pullAndMerge();

    expect(loadAttempts().map((a) => a.id)).toEqual(['ok']);
  });

  it('carries one device’s history to another on the same account', async () => {
    const { account } = fakeAccount();
    // The iPad studies, and its session-end push sends the attempts and rungs.
    logMany(4, 100);
    saveLadderProgress({ 'suffix-bare-type1': 2 });
    expect(await push()).toBe(true);

    // The Mac signs in with an empty browser and pulls.
    newDevice();
    expect(await pullAndMerge()).toEqual({ hadServerData: true, ok: true });

    expect(loadAttempts()).toHaveLength(4);
    expect(loadLadderProgress()).toEqual({ 'suffix-bare-type1': 2 });
    // Nothing was sent back: the Mac had nothing the account lacked.
    expect(account.posts).toHaveLength(1);
  });
});

describe('deleteServerProgress', () => {
  it('DELETEs and reports success', async () => {
    const fetchMock = mockFetch({ ok: true });

    expect(await deleteServerProgress()).toBe(true);
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('resets the cursor, so the next push puts the whole log back', async () => {
    const { account } = fakeAccount();
    logMany(3);
    await push();
    expect(account.attempts).toHaveLength(3);

    expect(await deleteServerProgress()).toBe(true);
    expect(account.attempts).toEqual([]);
    await push();

    expect(account.attempts).toHaveLength(3);
  });

  it('returns false on failure or error', async () => {
    mockFetch({ ok: false });
    expect(await deleteServerProgress()).toBe(false);

    mockFetch(new Error('offline'));
    expect(await deleteServerProgress()).toBe(false);
  });
});

describe('registerSessionEndPush', () => {
  function fakeDocument(visibilityState: string) {
    const listeners: Record<string, () => void> = {};
    return {
      visibilityState,
      addEventListener: (event: string, fn: () => void) => {
        listeners[event] = fn;
      },
      fire: () => listeners.visibilitychange?.(),
    };
  }

  it('pushes with keepalive when the tab hides while signed in', async () => {
    document.cookie = 'ht-auth=1';
    const fetchMock = mockFetch(okJson({ syncedAt: '2026-08-08T12:00:00.000Z' }));
    const doc = fakeDocument('hidden');

    registerSessionEndPush(doc as never);
    doc.fire();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });

  it('does nothing when the tab becomes visible rather than hidden', () => {
    document.cookie = 'ht-auth=1';
    const fetchMock = mockFetch(okJson({}));
    const doc = fakeDocument('visible');

    registerSessionEndPush(doc as never);
    doc.fire();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when signed out', () => {
    document.cookie = 'ht-auth=; Max-Age=0';
    const fetchMock = mockFetch(okJson({}));
    const doc = fakeDocument('hidden');

    registerSessionEndPush(doc as never);
    doc.fire();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-08T12:00:00.000Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it.each([
    ['just now', 30_000],
    ['1 minute ago', 60_000],
    ['5 minutes ago', 5 * 60_000],
    ['1 hour ago', 60 * 60_000],
    ['3 hours ago', 3 * 60 * 60_000],
    ['1 day ago', 24 * 60 * 60_000],
    ['4 days ago', 4 * 24 * 60 * 60_000],
  ])('renders %s', (expected, elapsed) => {
    expect(formatRelativeTime(ago(elapsed), now)).toBe(expected);
  });
});
