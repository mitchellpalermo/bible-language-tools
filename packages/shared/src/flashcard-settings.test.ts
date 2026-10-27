import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFlashcardSettings,
  DEFAULT_FLASHCARD_SETTINGS,
  normalizeFlashcardSettings,
} from './flashcard-settings';

const KEY = 'test-tools-flashcard-display-v1';
const { loadFlashcardSettings, saveFlashcardSettings } = createFlashcardSettings(KEY);

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('normalizeFlashcardSettings', () => {
  it('defaults the part of speech to hidden', () => {
    expect(DEFAULT_FLASHCARD_SETTINGS.showPartOfSpeech).toBe(false);
    expect(normalizeFlashcardSettings({})).toEqual({ showPartOfSpeech: false });
  });

  it('keeps a stored boolean of either value', () => {
    expect(normalizeFlashcardSettings({ showPartOfSpeech: true })).toEqual({
      showPartOfSpeech: true,
    });
    expect(normalizeFlashcardSettings({ showPartOfSpeech: false })).toEqual({
      showPartOfSpeech: false,
    });
  });

  it('falls back to the default for a non-boolean, rather than passing it through', () => {
    // 'yes' is truthy and would switch the hint back on if it reached JSX.
    expect(normalizeFlashcardSettings({ showPartOfSpeech: 'yes' })).toEqual({
      showPartOfSpeech: false,
    });
    expect(normalizeFlashcardSettings({ showPartOfSpeech: null })).toEqual({
      showPartOfSpeech: false,
    });
  });

  it('falls back for values that are not objects at all', () => {
    expect(normalizeFlashcardSettings(null)).toEqual(DEFAULT_FLASHCARD_SETTINGS);
    expect(normalizeFlashcardSettings('true')).toEqual(DEFAULT_FLASHCARD_SETTINGS);
    expect(normalizeFlashcardSettings(undefined)).toEqual(DEFAULT_FLASHCARD_SETTINGS);
  });
});

describe('createFlashcardSettings', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(loadFlashcardSettings()).toEqual(DEFAULT_FLASHCARD_SETTINGS);
  });

  it('round-trips a saved setting', () => {
    saveFlashcardSettings({ showPartOfSpeech: true });
    expect(loadFlashcardSettings()).toEqual({ showPartOfSpeech: true });
  });

  it('writes to the key it was bound to', () => {
    saveFlashcardSettings({ showPartOfSpeech: true });
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ showPartOfSpeech: true });
  });

  it('keeps each app’s settings separate', () => {
    const other = createFlashcardSettings('other-tools-flashcard-display-v1');
    saveFlashcardSettings({ showPartOfSpeech: true });
    expect(other.loadFlashcardSettings()).toEqual(DEFAULT_FLASHCARD_SETTINGS);
  });

  it('returns the defaults for unparseable storage', () => {
    localStorage.setItem(KEY, 'not json');
    expect(loadFlashcardSettings()).toEqual(DEFAULT_FLASHCARD_SETTINGS);
  });

  it('returns the defaults when localStorage throws on read', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadFlashcardSettings()).toEqual(DEFAULT_FLASHCARD_SETTINGS);
  });

  it('swallows a write failure so a study session is not interrupted', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveFlashcardSettings({ showPartOfSpeech: true })).not.toThrow();
  });
});
