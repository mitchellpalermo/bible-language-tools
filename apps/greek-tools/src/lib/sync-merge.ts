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
