import { beforeEach, describe, expect, it } from 'vitest';
import { createQuizSettings } from './quiz-settings';

const KEY = 'test-quiz-settings';

describe('createQuizSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the defaults when nothing is stored', () => {
    const { loadQuizSettings } = createQuizSettings(KEY);

    expect(loadQuizSettings()).toEqual({ accentStrict: false, density: 'medium' });
  });

  it('lets an app override a default without touching the others', () => {
    const { loadQuizSettings } = createQuizSettings(KEY, { density: 'hard' });

    expect(loadQuizSettings()).toEqual({ accentStrict: false, density: 'hard' });
  });

  it('round-trips what was saved', () => {
    const { loadQuizSettings, saveQuizSettings } = createQuizSettings(KEY);

    saveQuizSettings({ accentStrict: true, density: 'easy' });

    expect(loadQuizSettings()).toEqual({ accentStrict: true, density: 'easy' });
  });

  it('keeps two apps apart by storage key', () => {
    const greek = createQuizSettings('greek');
    const hebrew = createQuizSettings('hebrew');

    greek.saveQuizSettings({ accentStrict: true, density: 'easy' });

    expect(hebrew.loadQuizSettings().accentStrict).toBe(false);
  });

  it('falls back field by field on a stored value it does not recognise', () => {
    localStorage.setItem(KEY, JSON.stringify({ accentStrict: 'yes', density: 'brutal' }));
    const { loadQuizSettings } = createQuizSettings(KEY, { density: 'hard' });

    expect(loadQuizSettings()).toEqual({ accentStrict: false, density: 'hard' });
  });

  it('falls back to the defaults on unparseable storage', () => {
    localStorage.setItem(KEY, '{not json');
    const { loadQuizSettings } = createQuizSettings(KEY);

    expect(loadQuizSettings()).toEqual({ accentStrict: false, density: 'medium' });
  });
});
