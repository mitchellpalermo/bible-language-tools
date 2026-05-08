/**
 * Tests for src/lib/quiz-settings.ts
 *
 * Covers: loadQuizSettings, saveQuizSettings — localStorage persistence
 * with validation and fallback to defaults.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { loadQuizSettings, saveQuizSettings } from './quiz-settings';

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// loadQuizSettings
// ---------------------------------------------------------------------------

describe('loadQuizSettings', () => {
  it('returns defaults when localStorage is empty', () => {
    const settings = loadQuizSettings();
    expect(settings).toEqual({ accentStrict: false, density: 'medium' });
  });

  it('returns saved settings', () => {
    localStorage.setItem(
      'greek-tools-quiz-settings-v1',
      JSON.stringify({ accentStrict: true, density: 'hard' }),
    );
    const settings = loadQuizSettings();
    expect(settings).toEqual({ accentStrict: true, density: 'hard' });
  });

  it('returns defaults for invalid JSON', () => {
    localStorage.setItem('greek-tools-quiz-settings-v1', 'not json');
    const settings = loadQuizSettings();
    expect(settings).toEqual({ accentStrict: false, density: 'medium' });
  });

  it('validates density value — falls back to default for invalid', () => {
    localStorage.setItem(
      'greek-tools-quiz-settings-v1',
      JSON.stringify({ accentStrict: true, density: 'extreme' }),
    );
    const settings = loadQuizSettings();
    expect(settings.density).toBe('medium');
    expect(settings.accentStrict).toBe(true);
  });

  it('validates accentStrict type — falls back to default for non-boolean', () => {
    localStorage.setItem(
      'greek-tools-quiz-settings-v1',
      JSON.stringify({ accentStrict: 'yes', density: 'easy' }),
    );
    const settings = loadQuizSettings();
    expect(settings.accentStrict).toBe(false);
    expect(settings.density).toBe('easy');
  });

  it('handles partial saved data — fills missing fields with defaults', () => {
    localStorage.setItem('greek-tools-quiz-settings-v1', JSON.stringify({ density: 'hard' }));
    const settings = loadQuizSettings();
    expect(settings).toEqual({ accentStrict: false, density: 'hard' });
  });
});

// ---------------------------------------------------------------------------
// saveQuizSettings
// ---------------------------------------------------------------------------

describe('saveQuizSettings', () => {
  it('persists settings to localStorage', () => {
    saveQuizSettings({ accentStrict: true, density: 'easy' });
    const raw = localStorage.getItem('greek-tools-quiz-settings-v1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ accentStrict: true, density: 'easy' });
  });

  it('overwrites previous settings', () => {
    saveQuizSettings({ accentStrict: true, density: 'easy' });
    saveQuizSettings({ accentStrict: false, density: 'hard' });
    const raw = localStorage.getItem('greek-tools-quiz-settings-v1');
    expect(JSON.parse(raw!)).toEqual({ accentStrict: false, density: 'hard' });
  });
});
