// What the flashcard face shows before the student answers.
//
// This is a *study posture*, not a momentary filter: someone who hides the part
// of speech because it gives the answer away means it for the term, not for one
// card. So it persists — bound to a per-app storage key by
// `createFlashcardSettings`, because greek.tools and hebrew.tools are separate
// study habits and must not share this state.
//
// It is deliberately not part of the SRS store and is never synced. Nothing here
// changes what is due or how a card is scheduled; it only decides how much of
// the card is visible while you are trying to recall it.

export interface FlashcardSettings {
  /**
   * Show the part of speech on the *front* of the card.
   *
   * Off by default, and the default is the point of the setting. "noun" narrows
   * a Hebrew word to a fraction of the lexicon before you have recalled
   * anything, and "verb" on a form you were meant to parse hands over the one
   * fact the card was asking for. The part of speech is still shown with the
   * answer either way — hiding it from the front withholds a hint, it does not
   * withhold the information.
   */
  showPartOfSpeech: boolean;
}

export const DEFAULT_FLASHCARD_SETTINGS: FlashcardSettings = {
  showPartOfSpeech: false,
};

/**
 * Coerce anything read back from storage into usable settings.
 *
 * Storage is shared with older builds of the app and with the user's own
 * devtools, so every field is treated as untrusted and a bad value falls back to
 * the default rather than propagating as `undefined` into a JSX condition.
 */
export function normalizeFlashcardSettings(raw: unknown): FlashcardSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_FLASHCARD_SETTINGS };
  const input = raw as Partial<Record<keyof FlashcardSettings, unknown>>;
  return {
    showPartOfSpeech:
      typeof input.showPartOfSpeech === 'boolean'
        ? input.showPartOfSpeech
        : DEFAULT_FLASHCARD_SETTINGS.showPartOfSpeech,
  };
}

/**
 * Bind load/save to one app's storage key.
 *
 * Both sides swallow their errors: a full, disabled or unavailable
 * localStorage must never interrupt a study session over a display preference.
 */
export function createFlashcardSettings(storageKey: string) {
  function loadFlashcardSettings(): FlashcardSettings {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { ...DEFAULT_FLASHCARD_SETTINGS };
      return normalizeFlashcardSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_FLASHCARD_SETTINGS };
    }
  }

  function saveFlashcardSettings(settings: FlashcardSettings): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      // See above.
    }
  }

  return { loadFlashcardSettings, saveFlashcardSettings };
}
