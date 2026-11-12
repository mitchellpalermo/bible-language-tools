// This app's binding of `@tools/shared/study-streak`: the Today session streak
// (#197). Separate from the Daily verse streak (`greek-tools-daily-v1`) and the
// flashcard streak in the stats, and kept apart from hebrew.tools' by its key.
// Synced when signed in, through `sync-manager.ts`.

import { createStudyStreak } from '@tools/shared/study-streak';

export const STUDY_STREAK_KEY = 'greek-tools-study-streak-v1';

export const { loadStudyStreak, saveStudyStreak, markSessionComplete } =
  createStudyStreak(STUDY_STREAK_KEY);
