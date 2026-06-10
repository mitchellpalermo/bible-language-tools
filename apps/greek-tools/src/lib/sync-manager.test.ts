import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_DECKS_KEY } from '../data/customDecks';
import type { SRSCard, StudyStats } from '../data/srs';
import {
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
} from './sync-manager';

const SRS_KEY = 'greek-tools-srs-v2';
const STATS_KEY = 'greek-tools-stats-v1';

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
  lastStreakDate: '2026-06-10',
  cardsStudiedToday: 12,
  lastStudyDate: '2026-06-10',
  totalReviewed: 250,
  totalCorrect: 210,
};

function seedLocal(srsStore: Record<string, SRSCard>, localStats = stats) {
  localStorage.setItem(SRS_KEY, JSON.stringify(srsStore));
  localStorage.setItem(STATS_KEY, JSON.stringify(localStats));
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('sync-manager', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'gt-auth=1';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = 'gt-auth=; Max-Age=0';
  });

  describe('lastSyncedAt', () => {
    it('round-trips through localStorage', () => {
      expect(getLastSyncedAt()).toBeNull();
      setLastSyncedAt('2026-06-10T12:00:00.000Z');
      expect(getLastSyncedAt()).toBe('2026-06-10T12:00:00.000Z');
      expect(localStorage.getItem(LAST_SYNCED_KEY)).toBe('2026-06-10T12:00:00.000Z');
    });
  });

  describe('import offered flag', () => {
    it('is tracked per account, not per browser', () => {
      expect(hasImportBeenOffered('user-a')).toBe(false);

      markImportOffered('user-a');

      expect(hasImportBeenOffered('user-a')).toBe(true);
      // A different account in the same browser still gets the offer
      expect(hasImportBeenOffered('user-b')).toBe(false);
    });
  });

  describe('hasLocalProgress', () => {
    it('is false with no stored progress', () => {
      expect(hasLocalProgress()).toBe(false);
    });

    it('is false when all cards have repetition 0', () => {
      seedLocal({ a: makeCard('a', { repetition: 0 }) });
      expect(hasLocalProgress()).toBe(false);
    });

    it('is true when a card has been reviewed', () => {
      seedLocal({ a: makeCard('a', { repetition: 1 }) });
      expect(hasLocalProgress()).toBe(true);
    });

    it('is true when a custom deck exists', () => {
      localStorage.setItem(
        CUSTOM_DECKS_KEY,
        JSON.stringify([{ id: '1', name: 'x', wordKeys: [], createdAt: '2026-06-01' }]),
      );
      expect(hasLocalProgress()).toBe(true);
    });
  });

  describe('push', () => {
    it('PUTs local state and records the server syncedAt', async () => {
      seedLocal({ a: makeCard('a') });
      fetchMock.mockResolvedValue(okJson({ syncedAt: '2026-06-10T12:00:00.000Z' }));

      expect(await push()).toBe(true);

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/progress',
        expect.objectContaining({ method: 'PUT' }),
      );
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.srsStore.a).toEqual(makeCard('a'));
      expect(getLastSyncedAt()).toBe('2026-06-10T12:00:00.000Z');
    });

    it('returns false on a non-OK response without throwing', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
      expect(await push()).toBe(false);
      expect(getLastSyncedAt()).toBeNull();
    });

    it('returns false on a network error without throwing', async () => {
      fetchMock.mockRejectedValue(new TypeError('network down'));
      expect(await push()).toBe(false);
    });
  });

  describe('pullAndMerge', () => {
    it('keeps local state when the server has no progress', async () => {
      seedLocal({ a: makeCard('a') });
      fetchMock
        .mockResolvedValueOnce(okJson({ data: null }))
        .mockResolvedValueOnce(okJson({ syncedAt: '2026-06-10T12:00:00.000Z' }));

      expect(await pullAndMerge()).toBe(true);

      expect(readLocalProgress().srsStore.a).toEqual(makeCard('a'));
      expect(getLastSyncedAt()).toBe('2026-06-10T12:00:00.000Z');
    });

    it('merges server progress into local state and pushes the result', async () => {
      seedLocal({ a: makeCard('a', { repetition: 1 }) });
      const serverPayload = {
        srsStore: { a: makeCard('a', { repetition: 5 }), b: makeCard('b') },
        studyStats: { ...stats, totalReviewed: 999 },
        customDecks: [],
        syncedAt: '2026-06-09T00:00:00.000Z',
      };
      fetchMock
        .mockResolvedValueOnce(okJson({ data: serverPayload }))
        .mockResolvedValueOnce(okJson({ syncedAt: '2026-06-10T12:00:00.000Z' }));

      expect(await pullAndMerge()).toBe(true);

      const local = readLocalProgress();
      expect(local.srsStore.a.repetition).toBe(5);
      expect(local.srsStore.b).toEqual(makeCard('b'));
      expect(local.studyStats.totalReviewed).toBe(999);

      const pushed = JSON.parse(fetchMock.mock.calls[1][1].body as string);
      expect(pushed.srsStore.a.repetition).toBe(5);
    });

    it('returns false and leaves local state untouched on network error', async () => {
      seedLocal({ a: makeCard('a') });
      fetchMock.mockRejectedValue(new TypeError('network down'));

      expect(await pullAndMerge()).toBe(false);

      expect(readLocalProgress().srsStore.a).toEqual(makeCard('a'));
      expect(getLastSyncedAt()).toBeNull();
    });

    it('returns false when the pull response is not OK', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
      expect(await pullAndMerge()).toBe(false);
    });
  });

  describe('registerSessionEndPush', () => {
    function fireVisibility(state: 'hidden' | 'visible') {
      Object.defineProperty(document, 'visibilityState', {
        value: state,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }

    it('pushes with keepalive when the tab hides and the user is signed in', () => {
      fetchMock.mockResolvedValue(okJson({ syncedAt: '2026-06-10T12:00:00.000Z' }));
      registerSessionEndPush();

      fireVisibility('hidden');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/progress',
        expect.objectContaining({ method: 'PUT', keepalive: true }),
      );
    });

    it('does not push when signed out', () => {
      document.cookie = 'gt-auth=; Max-Age=0';
      registerSessionEndPush();

      fireVisibility('hidden');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not push when the tab becomes visible', () => {
      registerSessionEndPush();

      fireVisibility('visible');

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('formatRelativeTime', () => {
    const now = new Date('2026-06-10T12:00:00.000Z');

    it.each([
      ['2026-06-10T11:59:30.000Z', 'just now'],
      ['2026-06-10T11:59:00.000Z', '1 minute ago'],
      ['2026-06-10T11:57:00.000Z', '3 minutes ago'],
      ['2026-06-10T11:00:00.000Z', '1 hour ago'],
      ['2026-06-10T07:00:00.000Z', '5 hours ago'],
      ['2026-06-09T11:00:00.000Z', '1 day ago'],
      ['2026-06-01T12:00:00.000Z', '9 days ago'],
    ])('formats %s as "%s"', (iso, expected) => {
      expect(formatRelativeTime(iso, now)).toBe(expected);
    });
  });
});
