// Merge rules shared by both apps' cross-device sync. Pure functions.
//
// Every rule here must be symmetric: merge(a, b) and merge(b, a) pick the same
// winners. Both sides of a sync run the same merge, so an asymmetric rule would
// let two devices ping-pong different answers. "More progress wins" throughout.

import type { SRSCard, StudyStats } from './srs';

/**
 * Per word key: the card with the higher repetition wins.
 * Ties are broken by the later dueDate.
 */
export function mergeSRSStores(
  a: Record<string, SRSCard>,
  b: Record<string, SRSCard>,
): Record<string, SRSCard> {
  const merged: Record<string, SRSCard> = { ...a };
  for (const [key, card] of Object.entries(b)) {
    const existing = merged[key];
    if (!existing) {
      merged[key] = card;
      continue;
    }
    if (
      card.repetition > existing.repetition ||
      (card.repetition === existing.repetition && card.dueDate > existing.dueDate)
    ) {
      merged[key] = card;
    }
  }
  return merged;
}

/**
 * The streak and the date it was last earned move together, decided by the
 * later anchor date — never by the streak number alone. Two decayed streaks
 * both read 0, and the old `b.streak > a.streak ? b : a` fell through to `a`
 * (always the local device) on that tie, so signing in on a fresh browser
 * merged the server's real anchor away and restarted the streak from scratch.
 * Empty string sorts before any real date, so a known anchor always wins.
 */
function pickStreak(a: StudyStats, b: StudyStats): StudyStats {
  if (a.lastStreakDate !== b.lastStreakDate) {
    return b.lastStreakDate > a.lastStreakDate ? b : a;
  }
  return b.streak > a.streak ? b : a;
}

/**
 * Today's card counter travels with the day it belongs to, decided by the later
 * lastStudyDate. Choosing by totalReviewed instead let a stale count from an
 * older session ride in as if it were today's.
 */
function pickDaily(a: StudyStats, b: StudyStats): StudyStats {
  if (a.lastStudyDate !== b.lastStudyDate) {
    return b.lastStudyDate > a.lastStudyDate ? b : a;
  }
  return b.cardsStudiedToday > a.cardsStudiedToday ? b : a;
}

/** Lifetime counters take the max of both stores; paired fields stay paired. */
export function mergeStudyStats(a: StudyStats, b: StudyStats): StudyStats {
  const streakier = pickStreak(a, b);
  const daily = pickDaily(a, b);
  return {
    streak: streakier.streak,
    lastStreakDate: streakier.lastStreakDate,
    cardsStudiedToday: daily.cardsStudiedToday,
    lastStudyDate: daily.lastStudyDate,
    totalReviewed: Math.max(a.totalReviewed, b.totalReviewed),
    totalCorrect: Math.max(a.totalCorrect, b.totalCorrect),
  };
}
