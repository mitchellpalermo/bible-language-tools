import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SRSCard } from '../data/srs';
import { loadSRSStore, loadStats } from '../data/srs';
import {
  deleteServerProgress,
  formatRelativeTime,
  getLastSyncedAt,
  hasImportBeenOffered,
  hasLocalProgress,
  LAST_SYNCED_KEY,
  markImportOffered,
  pullAndMerge,
  push,
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
});

describe('pullAndMerge', () => {
  it('merges server progress into local and pushes the result', async () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 1 }) });
    const fetchMock = mockFetch(
      okJson({
        data: {
          srsStore: { מֶלֶךְ: card({ repetition: 5 }), אֵשׁ: card({ key: 'אֵשׁ' }) },
          studyStats: emptyStats,
          syncedAt: '2026-08-01T00:00:00.000Z',
        },
      }),
      okJson({ syncedAt: '2026-08-08T12:00:00.000Z' }),
    );

    const result = await pullAndMerge();

    expect(result).toEqual({ hadServerData: true, ok: true });
    // Local now holds the further-along card plus the one it had never seen.
    const local = loadSRSStore();
    expect(local.מֶלֶךְ.repetition).toBe(5);
    expect(local.אֵשׁ).toBeDefined();
    // And the merged result went back to the server.
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).srsStore.אֵשׁ).toBeDefined();
  });

  it('reports hadServerData false for an account that has never synced', async () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 3 }) });
    mockFetch(okJson({ data: null }), okJson({ syncedAt: '2026-08-08T12:00:00.000Z' }));

    const result = await pullAndMerge();

    expect(result).toEqual({ hadServerData: false, ok: true });
    // Local progress survives untouched.
    expect(loadSRSStore().מֶלֶךְ.repetition).toBe(3);
  });

  it('keeps local progress when the pull fails', async () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 3 }) });
    mockFetch({ ok: false, status: 500 });

    expect(await pullAndMerge()).toEqual({ hadServerData: false, ok: false });
    expect(loadSRSStore().מֶלֶךְ.repetition).toBe(3);
  });

  it('reports not-ok when the follow-up push fails, but keeps the merge locally', async () => {
    seedLocal({ מֶלֶךְ: card({ repetition: 1 }) });
    mockFetch(
      okJson({
        data: {
          srsStore: { מֶלֶךְ: card({ repetition: 9 }) },
          studyStats: emptyStats,
          syncedAt: '2026-08-01T00:00:00.000Z',
        },
      }),
      { ok: false, status: 500 },
    );

    expect(await pullAndMerge()).toEqual({ hadServerData: true, ok: false });
    expect(loadSRSStore().מֶלֶךְ.repetition).toBe(9);
    expect(getLastSyncedAt()).toBeNull();
  });

  it('swallows network errors', async () => {
    mockFetch(new Error('offline'));

    await expect(pullAndMerge()).resolves.toEqual({ hadServerData: false, ok: false });
  });
});

describe('deleteServerProgress', () => {
  it('DELETEs and reports success', async () => {
    const fetchMock = mockFetch({ ok: true });

    expect(await deleteServerProgress()).toBe(true);
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
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
