import { beforeEach, describe, expect, it } from 'vitest';
import { loadParseSettings, PARSE_SETTINGS_KEY, saveParseSettings } from './parse-settings';
import { DEFAULT_PARSE_SETTINGS } from './verb-parse';

beforeEach(() => localStorage.clear());

describe('parse settings', () => {
  it('starts on Qal qatal, yiqtol and wayyiqtol, with the root, 20 forms', () => {
    expect(loadParseSettings()).toEqual({
      stems: ['qal'],
      conjugations: ['qatal', 'yiqtol', 'wayyiqtol'],
      askRoot: true,
      sessionLength: 20,
    });
  });

  it('round-trips what was saved', () => {
    const s = {
      stems: ['piel' as const],
      conjugations: ['participle' as const],
      askRoot: false,
      sessionLength: 30 as const,
    };
    saveParseSettings(s);
    expect(loadParseSettings()).toEqual(s);
  });

  it('keeps only values the drill offers, in its own order', () => {
    localStorage.setItem(
      PARSE_SETTINGS_KEY,
      JSON.stringify({ stems: ['hiphil', 'qal', 'polel'], conjugations: 'x', sessionLength: 15 }),
    );
    expect(loadParseSettings()).toEqual({
      ...DEFAULT_PARSE_SETTINGS,
      stems: ['qal', 'hiphil'],
    });
  });

  it('falls back to the defaults on unreadable storage', () => {
    localStorage.setItem(PARSE_SETTINGS_KEY, '{');
    expect(loadParseSettings()).toEqual(DEFAULT_PARSE_SETTINGS);
  });
});
