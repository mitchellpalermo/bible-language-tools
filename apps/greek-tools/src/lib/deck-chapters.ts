// The chapters chosen for each custom deck built from a book or passage
// (#270), so a deck comes back narrowed the way it was left. Local to this
// browser and never synced, like the textbook selection (`deck-selection.ts`).

import { createDeckChapterMemory } from '@tools/shared/deck-source';

export const DECK_CHAPTERS_KEY = 'greek-tools-deck-chapters-v1';

export const deckChapterMemory = createDeckChapterMemory(DECK_CHAPTERS_KEY);
