// Merge rules for cross-device sync. Pure functions — no side effects.
//
// The merge is symmetric: merge(a, b) and merge(b, a) pick the same winners.
// "More progress wins" is the guiding rule throughout.

import type { CustomDeck } from '../data/customDecks';
import type { FocusPassage, ParseHistory } from '../data/focusPassages';
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
 * Lifetime counters take the max of both stores.
 *
 * The date-anchored fields are chosen by RECENCY, not by magnitude. Picking the
 * larger number looks like "more progress wins" but is wrong for anything a
 * date has to agree with:
 *
 *   - Taking the higher `streak` carried its stale `lastStreakDate` along. A
 *     device holding streak 12 anchored a month ago beat a live streak of 3,
 *     and loadStats() then zeroed the result outright, because the anchor was
 *     neither today nor yesterday. A stale device destroyed a live streak.
 *   - Taking the higher `totalReviewed` as a proxy for "most recently active"
 *     fails the same way: the device with the most lifetime reviews is not
 *     necessarily the one that studied today, and it overwrote a current
 *     `lastStudyDate` with an old one.
 *
 * Both pairs now move together with the later date. Ties break on the larger
 * counter, which keeps the function symmetric — mergeStudyStats(a, b) and
 * mergeStudyStats(b, a) still pick the same winner, and both sides of a sync
 * run this same merge.
 *
 * An empty-string date sorts below every real one, so a device that has never
 * hit the threshold cannot win the streak.
 */
export function mergeStudyStats(a: StudyStats, b: StudyStats): StudyStats {
  const recent = pickLater(a, b, 'lastStudyDate', 'totalReviewed');
  const streakier = pickLater(a, b, 'lastStreakDate', 'streak');
  return {
    streak: streakier.streak,
    lastStreakDate: streakier.lastStreakDate,
    cardsStudiedToday: recent.cardsStudiedToday,
    lastStudyDate: recent.lastStudyDate,
    totalReviewed: Math.max(a.totalReviewed, b.totalReviewed),
    totalCorrect: Math.max(a.totalCorrect, b.totalCorrect),
  };
}

/**
 * Whichever store has the later `dateField`; ties break on the larger
 * `tieField`. Dates are YYYY-MM-DD, so string comparison is date comparison.
 */
function pickLater(
  a: StudyStats,
  b: StudyStats,
  dateField: 'lastStudyDate' | 'lastStreakDate',
  tieField: 'totalReviewed' | 'streak',
): StudyStats {
  if (a[dateField] !== b[dateField]) return b[dateField] > a[dateField] ? b : a;
  return b[tieField] > a[tieField] ? b : a;
}

/** Union by deck id; duplicate ids resolved by the later createdAt. */
export function mergeCustomDecks(a: CustomDeck[], b: CustomDeck[]): CustomDeck[] {
  const byId = new Map<string, CustomDeck>();
  for (const deck of a) byId.set(deck.id, deck);
  for (const deck of b) {
    const existing = byId.get(deck.id);
    if (!existing || deck.createdAt > existing.createdAt) {
      byId.set(deck.id, deck);
    }
  }
  return [...byId.values()];
}

/** Union by passage id; duplicate ids resolved by the later createdAt. */
export function mergeFocusPassages(a: FocusPassage[], b: FocusPassage[]): FocusPassage[] {
  const byId = new Map<string, FocusPassage>();
  for (const passage of a) byId.set(passage.id, passage);
  for (const passage of b) {
    const existing = byId.get(passage.id);
    if (!existing || passage.createdAt > existing.createdAt) {
      byId.set(passage.id, passage);
    }
  }
  return [...byId.values()];
}

/**
 * Per passage id: take the entry with the higher total attempts (more sessions
 * = more complete cumulative record). Ties broken by higher correct count.
 */
export function mergeParseHistory(
  a: Record<string, ParseHistory>,
  b: Record<string, ParseHistory>,
): Record<string, ParseHistory> {
  const merged: Record<string, ParseHistory> = { ...a };
  for (const [id, entry] of Object.entries(b)) {
    const existing = merged[id];
    if (!existing) {
      merged[id] = entry;
      continue;
    }
    if (
      entry.total > existing.total ||
      (entry.total === existing.total && entry.correct > existing.correct)
    ) {
      merged[id] = entry;
    }
  }
  return merged;
}

export interface ProgressSnapshot {
  srsStore: Record<string, SRSCard>;
  studyStats: StudyStats;
  customDecks: CustomDeck[];
  focusPassages: FocusPassage[];
  parseHistory: Record<string, ParseHistory>;
}

export function mergeProgress(a: ProgressSnapshot, b: ProgressSnapshot): ProgressSnapshot {
  return {
    srsStore: mergeSRSStores(a.srsStore, b.srsStore),
    studyStats: mergeStudyStats(a.studyStats, b.studyStats),
    customDecks: mergeCustomDecks(a.customDecks, b.customDecks),
    focusPassages: mergeFocusPassages(a.focusPassages, b.focusPassages),
    parseHistory: mergeParseHistory(a.parseHistory, b.parseHistory),
  };
}
