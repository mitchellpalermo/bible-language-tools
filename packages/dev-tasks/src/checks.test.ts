import { describe, expect, it } from 'vitest';
import { fileName, parseUnicodeRange, titleMatchesApp, uncoveredChars } from './checks.ts';

const face = (family: string, unicodeRange: string, status = 'loaded') => ({
  family,
  status,
  unicodeRange,
});
// The ranges Google Fonts serves Noto Sans in, as greek.tools loads it.
const LATIN = 'U+0-FF, U+131, U+152-153';
const GREEK = 'U+370-377, U+37A-37F, U+384-38A, U+38C, U+38E-3A1, U+3A3-3FF';
const GREEK_EXT = 'U+1F00-1FFF';

describe('parseUnicodeRange', () => {
  it('reads single points, spans and wildcards', () => {
    expect(parseUnicodeRange('U+38C, U+1F00-1FFF, u+4??')).toEqual([
      [0x38c, 0x38c],
      [0x1f00, 0x1fff],
      [0x400, 0x4ff],
    ]);
  });

  it('reads an empty range as every code point', () => {
    expect(parseUnicodeRange('')).toEqual([[0, 0x10ffff]]);
  });
});

describe('uncoveredChars', () => {
  it('passes when every script character has a loaded face', () => {
    const faces = [
      face('"Noto Sans"', LATIN),
      face('"Noto Sans"', GREEK),
      face('"Noto Sans"', GREEK_EXT),
    ];
    expect(uncoveredChars('greek', 'Parse ἐν ἀρχῇ ὁ λόγος', faces)).toEqual([]);
  });

  it('catches polytonic Greek when only the basic Greek file loaded', () => {
    const faces = [
      face('Noto Sans', LATIN),
      face('Noto Sans', GREEK),
      face('Noto Sans', GREEK_EXT, 'error'),
    ];
    expect(uncoveredChars('greek', 'λόγος ἀρχῇ', faces)).toEqual(['ἀ', 'ῇ']);
  });

  it('is not fooled by the Latin file alone', () => {
    expect(uncoveredChars('greek', 'λ', [face('Noto Sans', LATIN)])).toEqual(['λ']);
  });

  it('ignores pages with no script text', () => {
    expect(uncoveredChars('hebrew', 'Flashcards', [])).toEqual([]);
  });

  it('covers pointed Hebrew with a face that has no range', () => {
    expect(uncoveredChars('hebrew', 'בְּרֵאשִׁית', [face("'Noto Sans Hebrew'", '')])).toEqual([]);
    expect(uncoveredChars('hebrew', 'שׁ', [face('Plus Jakarta Sans', '')])).toEqual(['ש', 'ׁ']);
  });

  it('does not take Noto Sans Hebrew for greek.tools’ Noto Sans', () => {
    expect(uncoveredChars('greek', 'λ', [face('Noto Sans Hebrew', '')])).toEqual(['λ']);
  });
});

describe('titleMatchesApp', () => {
  it('tells the two apps apart, which is how a stale server is caught', () => {
    expect(titleMatchesApp('hebrew', 'Flashcards | hebrew.tools')).toBe(true);
    expect(titleMatchesApp('hebrew', 'Flashcards | greek.tools')).toBe(false);
    expect(titleMatchesApp('greek', '404: Not found')).toBe(false);
  });
});

describe('fileName', () => {
  it('encodes shot, viewport and label', () => {
    expect(fileName('nav-open', 'mobile', 'before')).toBe('nav-open-mobile-before.png');
  });
});
