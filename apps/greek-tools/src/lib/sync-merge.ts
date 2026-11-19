// Merge rules for cross-device sync. Pure functions — no side effects.
//
// The merge is symmetric: merge(a, b) and merge(b, a) pick the same winners.
// "More progress wins" is the guiding rule throughout.
//
// SRS cards and study stats merge identically in both apps, so those two rules
// live in @tools/shared/sync-merge and are re-exported here. Everything below
// is greek-tools-specific: focus passages and parse history.

import { type CustomDeck, mergeCustomDecks } from '@tools/shared/custom-decks';
import type { LadderProgress } from '@tools/shared/ladder';
import type { SRSCard, StudyStats } from '@tools/shared/srs';
import {
  emptyStudyStreak,
  mergeStudyStreak,
  type StudyStreakData,
} from '@tools/shared/study-streak';
import { mergeLadderProgress, mergeSRSStores, mergeStudyStats } from '@tools/shared/sync-merge';
import type { FocusPassage, ParseHistory } from '../data/focusPassages';

// Decks use the shared rules since #242: tombstoned deletes, the later edit
// wins, and a deck's source survives a client that predates it.
export { mergeCustomDecks, mergeLadderProgress, mergeSRSStores, mergeStudyStats };

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
  /** Absent from a snapshot taken before the Today session shipped. */
  studyStreak?: StudyStreakData;
  customDecks: CustomDeck[];
  focusPassages: FocusPassage[];
  parseHistory: Record<string, ParseHistory>;
  /** Absent from a snapshot taken before the ladder synced. */
  ladderProgress?: LadderProgress;
}

export function mergeProgress(a: ProgressSnapshot, b: ProgressSnapshot): ProgressSnapshot {
  return {
    srsStore: mergeSRSStores(a.srsStore, b.srsStore),
    studyStats: mergeStudyStats(a.studyStats, b.studyStats),
    // An absent streak is "never studied", which loses to any real one.
    studyStreak: mergeStudyStreak(
      a.studyStreak ?? emptyStudyStreak(),
      b.studyStreak ?? emptyStudyStreak(),
    ),
    customDecks: mergeCustomDecks(a.customDecks, b.customDecks),
    focusPassages: mergeFocusPassages(a.focusPassages, b.focusPassages),
    parseHistory: mergeParseHistory(a.parseHistory, b.parseHistory),
    // An absent ladder is a fresh one, which every real count beats.
    ladderProgress: mergeLadderProgress(a.ladderProgress ?? {}, b.ladderProgress ?? {}),
  };
}
