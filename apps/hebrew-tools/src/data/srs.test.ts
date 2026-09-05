// Tests for the hebrew-tools localStorage persistence layer only.
// The SM-2 algorithm itself (newCard, isDue, nextSRS, recordReview, ...) is
// tested at its source in packages/shared/src/srs.test.ts — no need to
// duplicate that coverage here.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadSRSStore,
  loadStats,
  newCard,
  type SRSCard,
  type StudyStats,
  saveSRSStore,
  saveStats,
} from './srs';

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Local, not UTC — must match the module's own date rule, or these helpers
  // reproduce the very bug they are meant to catch.
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TODAY = dateStr(0);
const YESTERDAY = dateStr(-1);

function emptyStats(): StudyStats {
  return {
    streak: 0,
    lastStreakDate: '',
    cardsStudiedToday: 0,
    lastStudyDate: '',
    totalReviewed: 0,
    totalCorrect: 0,
  };
}

beforeEach(() => localStorage.clear());

describe('loadSRSStore / saveSRSStore', () => {
  it('returns empty object when localStorage is empty', () => {
    expect(loadSRSStore()).toEqual({});
  });

  it('returns stored cards after saving', () => {
    const store: Record<string, SRSCard> = { אָמַר: newCard('אָמַר') };
    saveSRSStore(store);
    expect(loadSRSStore()).toEqual(store);
  });

  it('returns empty object when localStorage contains invalid JSON', () => {
    localStorage.setItem('hebrew-tools-srs-v1', 'not-json');
    expect(loadSRSStore()).toEqual({});
  });

  it('is namespaced separately from hebrew-tools-stats-v1', () => {
    saveSRSStore({ test: newCard('test') });
    expect(localStorage.getItem('hebrew-tools-stats-v1')).toBeNull();
  });
});

describe('loadStats / saveStats', () => {
  it('returns default empty stats when localStorage is empty', () => {
    const stats = loadStats();
    expect(stats.streak).toBe(0);
    expect(stats.totalReviewed).toBe(0);
    expect(stats.totalCorrect).toBe(0);
    expect(stats.cardsStudiedToday).toBe(0);
  });

  it('returns stored stats after saving', () => {
    const stats: StudyStats = {
      streak: 5,
      lastStreakDate: TODAY,
      cardsStudiedToday: 3,
      lastStudyDate: TODAY,
      totalReviewed: 50,
      totalCorrect: 45,
    };
    saveStats(stats);
    const loaded = loadStats();
    expect(loaded.streak).toBe(5);
    expect(loaded.totalReviewed).toBe(50);
  });

  it('resets cardsStudiedToday when it is a new day', () => {
    const yesterdayStats: StudyStats = {
      streak: 3,
      lastStreakDate: YESTERDAY,
      cardsStudiedToday: 15,
      lastStudyDate: YESTERDAY,
      totalReviewed: 30,
      totalCorrect: 28,
    };
    saveStats(yesterdayStats);
    expect(loadStats().cardsStudiedToday).toBe(0);
  });

  it('breaks streak when the user missed a day', () => {
    const twoDaysAgo = dateStr(-2);
    const oldStats: StudyStats = {
      streak: 5,
      lastStreakDate: twoDaysAgo,
      cardsStudiedToday: 15,
      lastStudyDate: twoDaysAgo,
      totalReviewed: 50,
      totalCorrect: 45,
    };
    saveStats(oldStats);
    expect(loadStats().streak).toBe(0);
  });

  it('preserves streak when lastStreakDate is yesterday', () => {
    const stats: StudyStats = {
      streak: 5,
      lastStreakDate: YESTERDAY,
      cardsStudiedToday: 0,
      lastStudyDate: YESTERDAY,
      totalReviewed: 50,
      totalCorrect: 45,
    };
    saveStats(stats);
    expect(loadStats().streak).toBe(5);
  });

  it('returns default stats when localStorage has invalid JSON', () => {
    localStorage.setItem('hebrew-tools-stats-v1', 'bad');
    expect(loadStats().streak).toBe(0);
  });

  it('is namespaced separately from hebrew-tools-srs-v1', () => {
    saveStats(emptyStats());
    expect(localStorage.getItem('hebrew-tools-srs-v1')).toBeNull();
  });
});
