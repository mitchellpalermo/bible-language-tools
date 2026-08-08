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
  /** ISO timestamp, server-assigned on write. Client-provided values are ignored. */
  syncedAt: string;
}
