import type { StudyStreakData } from '@tools/shared/study-streak';
import type { SRSCard, StudyStats } from '../data/srs';

// The full study-progress snapshot exchanged with /api/progress.
// Maps 1:1 to the existing localStorage shapes — no client-side conversion.
//
// Narrower than greek-tools' payload, which also carries custom decks, focus
// passages, and parse history. hebrew.tools has none of those features, so they
// are absent rather than sent empty; the server rejects unknown shapes.
export interface ProgressPayload {
  srsStore: Record<string, SRSCard>;
  studyStats: StudyStats;
  /**
   * The Today session streak (#184). Optional on the way in, so a page loaded
   * before it shipped can still push; the server always sends it back.
   */
  studyStreak?: StudyStreakData;
  /** ISO timestamp, server-assigned on write. Client-provided values are ignored. */
  syncedAt: string;
}
