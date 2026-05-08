/**
 * Quiz settings persistence — saves accent strictness and difficulty
 * preferences to localStorage so they survive page reloads.
 */

import type { Density } from './paradigm-quiz';

const QUIZ_SETTINGS_KEY = 'greek-tools-quiz-settings-v1';

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

export function loadQuizSettings(): QuizSettings {
  try {
    const raw = localStorage.getItem(QUIZ_SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<QuizSettings>;
    return {
      accentStrict:
        typeof parsed.accentStrict === 'boolean' ? parsed.accentStrict : DEFAULTS.accentStrict,
      density: isValidDensity(parsed.density) ? parsed.density : DEFAULTS.density,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveQuizSettings(settings: QuizSettings): void {
  localStorage.setItem(QUIZ_SETTINGS_KEY, JSON.stringify(settings));
}
