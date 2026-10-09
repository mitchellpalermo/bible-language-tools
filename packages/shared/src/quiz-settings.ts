// Quiz settings persistence — saves difficulty preferences to localStorage.
// Use createQuizSettings(storageKey) to get load/save functions bound to a
// specific storage key so greek-tools and hebrew-tools don't share state.

export type Density = 'easy' | 'medium' | 'hard';

export interface QuizSettings {
  accentStrict: boolean;
  density: Density;
}

const DEFAULTS: QuizSettings = {
  accentStrict: false,
  density: 'medium',
};

function isValidDensity(d: unknown): d is Density {
  return d === 'easy' || d === 'medium' || d === 'hard';
}

/**
 * `overrides` replaces the defaults for one app. hebrew-tools starts on `hard`:
 * its paradigm quiz exists to rehearse writing out a whole table, and a default
 * that hands back half the answers is a different exercise.
 */
export function createQuizSettings(storageKey: string, overrides: Partial<QuizSettings> = {}) {
  const defaults: QuizSettings = { ...DEFAULTS, ...overrides };

  function loadQuizSettings(): QuizSettings {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw) as Partial<QuizSettings>;
      return {
        accentStrict:
          typeof parsed.accentStrict === 'boolean' ? parsed.accentStrict : defaults.accentStrict,
        density: isValidDensity(parsed.density) ? parsed.density : defaults.density,
      };
    } catch {
      return { ...defaults };
    }
  }

  function saveQuizSettings(settings: QuizSettings): void {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }

  return { loadQuizSettings, saveQuizSettings };
}
