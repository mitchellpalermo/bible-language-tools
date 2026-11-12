import type { StudyStreakData } from '@tools/shared/study-streak';
import type { CustomDeck } from '../data/customDecks';
import type { FocusPassage, ParseHistory } from '../data/focusPassages';
import type { SRSCard, StudyStats } from '../data/srs';

// The full study-progress snapshot exchanged with /api/progress.
// Maps 1:1 to the existing localStorage shapes — no client-side conversion.
export interface ProgressPayload {
  srsStore: Record<string, SRSCard>;
  studyStats: StudyStats;
  /**
   * The Today session streak (#197). Optional on the way in, so a page loaded
   * before it shipped can still push; the server always sends it back.
   */
  studyStreak?: StudyStreakData;
  customDecks: CustomDeck[];
  focusPassages: FocusPassage[];
  parseHistory: Record<string, ParseHistory>;
  /** ISO timestamp, server-assigned on write. Client-provided values are ignored. */
  syncedAt: string;
}
