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

import type { SRSCard, StudyStats } from '@tools/shared/srs';
import { mergeSRSStores, mergeStudyStats } from '@tools/shared/sync-merge';

export { mergeSRSStores, mergeStudyStats };

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
