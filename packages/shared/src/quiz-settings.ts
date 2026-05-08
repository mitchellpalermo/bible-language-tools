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

export function createQuizSettings(storageKey: string) {
  function loadQuizSettings(): QuizSettings {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw) as Partial<QuizSettings>;
      return {
        accentStrict:
          typeof parsed.accentStrict === 'boolean'
            ? parsed.accentStrict
            : DEFAULTS.accentStrict,
        density: isValidDensity(parsed.density) ? parsed.density : DEFAULTS.density,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveQuizSettings(settings: QuizSettings): void {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }

  return { loadQuizSettings, saveQuizSettings };
}
