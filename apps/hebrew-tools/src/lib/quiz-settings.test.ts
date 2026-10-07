import { beforeEach, describe, expect, it } from 'vitest';
import { loadQuizSettings, QUIZ_SETTINGS_KEY, saveQuizSettings } from './quiz-settings';

describe('quiz settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on a fully blank table, lenient about pointing', () => {
    expect(loadQuizSettings()).toEqual({ accentStrict: false, density: 'hard' });
  });

  it('persists under the hebrew-tools key', () => {
    saveQuizSettings({ accentStrict: true, density: 'easy' });

    expect(JSON.parse(localStorage.getItem(QUIZ_SETTINGS_KEY) ?? '{}')).toEqual({
      accentStrict: true,
      density: 'easy',
    });
    expect(loadQuizSettings()).toEqual({ accentStrict: true, density: 'easy' });
  });
});
