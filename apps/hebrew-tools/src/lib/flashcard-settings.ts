/**
 * hebrew.tools' binding of the shared flashcard display settings.
 *
 * The key is app-specific on purpose: hiding the part of speech on Hebrew cards
 * says nothing about how someone wants to study Greek.
 */

export type { FlashcardSettings } from '@tools/shared/flashcard-settings';

import { createFlashcardSettings } from '@tools/shared/flashcard-settings';

export const FLASHCARD_SETTINGS_KEY = 'hebrew-tools-flashcard-display-v1';

export const { loadFlashcardSettings, saveFlashcardSettings } =
  createFlashcardSettings(FLASHCARD_SETTINGS_KEY);
