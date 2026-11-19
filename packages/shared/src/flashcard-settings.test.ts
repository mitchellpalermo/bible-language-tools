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
    expect(DEFAULT_FLASHCARD_SETTINGS.showVerse).toBe(true);
    expect(normalizeFlashcardSettings({})).toMatchObject({ showPartOfSpeech: false });
  });

  it('keeps a stored boolean of either value', () => {
    expect(normalizeFlashcardSettings({ showPartOfSpeech: true })).toMatchObject({
      showPartOfSpeech: true,
    });
    expect(normalizeFlashcardSettings({ showPartOfSpeech: false })).toMatchObject({
      showPartOfSpeech: false,
    });
  });

  it('falls back to the default for a non-boolean, rather than passing it through', () => {
    // 'yes' is truthy and would switch the hint back on if it reached JSX.
    expect(normalizeFlashcardSettings({ showPartOfSpeech: 'yes' })).toMatchObject({
      showPartOfSpeech: false,
    });
    expect(normalizeFlashcardSettings({ showPartOfSpeech: null })).toMatchObject({
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
    saveFlashcardSettings({ showPartOfSpeech: true, showVerse: true });
    expect(loadFlashcardSettings()).toMatchObject({ showPartOfSpeech: true });
  });

  it('writes to the key it was bound to', () => {
    saveFlashcardSettings({ showPartOfSpeech: true, showVerse: true });
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toMatchObject({
      showPartOfSpeech: true,
    });
  });

  it('keeps each app’s settings separate', () => {
    const other = createFlashcardSettings('other-tools-flashcard-display-v1');
    saveFlashcardSettings({ showPartOfSpeech: true, showVerse: true });
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
    expect(() => saveFlashcardSettings({ showPartOfSpeech: true, showVerse: true })).not.toThrow();
  });
});

describe('the verse on reveal (#267)', () => {
  it('is on by default, including for settings saved before it existed', () => {
    expect(normalizeFlashcardSettings({ showPartOfSpeech: true }).showVerse).toBe(true);
  });

  it('keeps a stored choice and ignores a non-boolean', () => {
    expect(normalizeFlashcardSettings({ showVerse: false }).showVerse).toBe(false);
    expect(normalizeFlashcardSettings({ showVerse: 'no' }).showVerse).toBe(true);
  });
});
