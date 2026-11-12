import type { Attempt } from '@tools/shared/attempt-log';
import type { CustomDeck } from '@tools/shared/custom-decks';
import type { FocusPassage } from '@tools/shared/focus-passages';
import type { LadderProgress } from '@tools/shared/ladder';
import type { StudyStreakData } from '@tools/shared/study-streak';
import type { SRSCard, StudyStats } from '../data/srs';

// The full study-progress snapshot exchanged with /api/progress.
// Maps 1:1 to the existing localStorage shapes — no client-side conversion.
//
// Narrower than greek-tools' payload, which also carries parse history.
// hebrew.tools has no parsing practice yet (#82), so it is absent rather than
// sent empty; the server rejects unknown shapes.
export interface ProgressPayload {
  srsStore: Record<string, SRSCard>;
  studyStats: StudyStats;
  /**
   * The Today session streak (#184). Optional on the way in, so a page loaded
   * before it shipped can still push; the server always sends it back.
   */
  studyStreak?: StudyStreakData;
  /**
   * Clean writes per suffix-ladder rung (#186). Optional on the way in, like
   * the streak; the server always sends it back.
   */
  ladderProgress?: LadderProgress;
  /**
   * The student's custom decks (#225), tombstones included: a deleted deck
   * travels as a deck with `deletedAt` set, which is how a deletion survives a
   * union merge. Optional on the way in, like the streak; the server always
   * sends it back.
   */
  customDecks?: CustomDeck[];
  /**
   * The student's focus passages (#226), tombstones included, by the same
   * rules as `customDecks`. Optional on the way in; the server always sends it
   * back.
   */
  focusPassages?: FocusPassage[];
  /** ISO timestamp, server-assigned on write. Client-provided values are ignored. */
  syncedAt: string;
}

/**
 * `/api/attempts`: the attempt log travels on its own, append-only, because a
 * full log is too large for the progress payload (see progress-store.ts).
 * GET returns the newest `MAX_ATTEMPTS`; POST adds up to
 * `MAX_ATTEMPTS_PER_REQUEST` and ignores ids the account already has.
 */
export interface AttemptsPayload {
  attempts: Attempt[];
}
