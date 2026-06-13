import type { CustomDeck } from '../data/customDecks';
import type { FocusPassage, ParseHistory } from '../data/focusPassages';
import type { SRSCard, StudyStats } from '../data/srs';

// The full study-progress snapshot exchanged with /api/progress.
// Maps 1:1 to the existing localStorage shapes — no client-side conversion.
export interface ProgressPayload {
  srsStore: Record<string, SRSCard>;
  studyStats: StudyStats;
  customDecks: CustomDeck[];
  focusPassages: FocusPassage[];
  parseHistory: Record<string, ParseHistory>;
  /** ISO timestamp, server-assigned on write. Client-provided values are ignored. */
  syncedAt: string;
}
