// Merge rules for cross-device sync. Pure functions — no side effects.
//
// The merge is symmetric: mergeProgress(a, b) and mergeProgress(b, a) pick the
// same winners. That matters because both sides of a sync run the same merge —
// the client merges local with server, and the result is what gets written
// back. An asymmetric rule would let two devices ping-pong different answers.
//
// "More progress wins" is the guiding rule throughout. Never lose a review.
//
// The card and stats rules are identical in greek-tools, so they live in
// @tools/shared/sync-merge and are re-exported here.

import type { LadderProgress } from '@tools/shared/ladder';
import type { SRSCard, StudyStats } from '@tools/shared/srs';
import {
  emptyStudyStreak,
  mergeStudyStreak,
  type StudyStreakData,
} from '@tools/shared/study-streak';
import {
  mergeAttempts,
  mergeLadderProgress,
  mergeSRSStores,
  mergeStudyStats,
} from '@tools/shared/sync-merge';

export { mergeAttempts, mergeLadderProgress, mergeSRSStores, mergeStudyStats };

export interface ProgressSnapshot {
  srsStore: Record<string, SRSCard>;
  studyStats: StudyStats;
  /** Absent from a snapshot taken before the Today session shipped. */
  studyStreak?: StudyStreakData;
  /** Absent from a snapshot taken before the ladder synced. */
  ladderProgress?: LadderProgress;
}

// The attempt log is not part of the snapshot: it syncs on its own endpoint,
// merged with `mergeAttempts` (see sync-manager.ts).

export function mergeProgress(a: ProgressSnapshot, b: ProgressSnapshot): ProgressSnapshot {
  return {
    srsStore: mergeSRSStores(a.srsStore, b.srsStore),
    studyStats: mergeStudyStats(a.studyStats, b.studyStats),
    // An absent streak is "never studied", which loses to any real one.
    studyStreak: mergeStudyStreak(
      a.studyStreak ?? emptyStudyStreak(),
      b.studyStreak ?? emptyStudyStreak(),
    ),
    // An absent ladder is a fresh one, which every real count beats.
    ladderProgress: mergeLadderProgress(a.ladderProgress ?? {}, b.ladderProgress ?? {}),
  };
}
