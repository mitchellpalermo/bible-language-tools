// Merge rules for cross-device sync. Pure functions — no side effects.
//
// The merge is symmetric: mergeProgress(a, b) and mergeProgress(b, a) pick the
// same winners. That matters because both sides of a sync run the same merge —
// the client merges local with server, and the result is what gets written
// back. An asymmetric rule would let two devices ping-pong different answers.
//
// "More progress wins" is the guiding rule throughout. Never lose a review.

import type { SRSCard, StudyStats } from '../data/srs';

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
 * Counters take the max of both stores. Daily fields (cardsStudiedToday,
 * lastStudyDate) come from the store with the higher totalReviewed — a proxy
 * for the most recently active device. lastStreakDate follows the higher
 * streak so the streak and its anchor date stay consistent.
 */
export function mergeStudyStats(a: StudyStats, b: StudyStats): StudyStats {
  const recent = b.totalReviewed > a.totalReviewed ? b : a;
  const streakier = b.streak > a.streak ? b : a;
  return {
    streak: streakier.streak,
    lastStreakDate: streakier.lastStreakDate,
    cardsStudiedToday: recent.cardsStudiedToday,
    lastStudyDate: recent.lastStudyDate,
    totalReviewed: Math.max(a.totalReviewed, b.totalReviewed),
    totalCorrect: Math.max(a.totalCorrect, b.totalCorrect),
  };
}

export interface ProgressSnapshot {
  srsStore: Record<string, SRSCard>;
  studyStats: StudyStats;
}

export function mergeProgress(a: ProgressSnapshot, b: ProgressSnapshot): ProgressSnapshot {
  return {
    srsStore: mergeSRSStores(a.srsStore, b.srsStore),
    studyStats: mergeStudyStats(a.studyStats, b.studyStats),
  };
}
