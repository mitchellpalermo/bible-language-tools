import { describe, expect, it } from 'vitest';
import {
  applyFinalForms,
  checkHebrewAnswer,
  CONSONANT_MAP,
  DAGESH,
  HATEPH_MAP,
  NIKUD_MAP,
  COMPOUND_NIKUD_MAP,
  processHebrewInput,
  processHebrewKey,
  SHEVA,
  stripAllDiacritics,
  stripNikud,
  translateHebrewInput,
} from './hebrew-input';

// ---------------------------------------------------------------------------
// processHebrewKey
// ---------------------------------------------------------------------------

describe('processHebrewKey', () => {
  describe('ctrl/meta passthrough', () => {
    it('does not intercept ctrl+a', () => {
      expect(processHebrewKey('a', true)).toEqual({ preventDefault: false, append: null });
    });

    it('does not intercept cmd+c', () => {
      expect(processHebrewKey('c', true)).toEqual({ preventDefault: false, append: null });
    });
  });

  describe('consonant mappings', () => {
    it.each([
      ["'", 'א'],
      ['b', 'ב'],
      ['g', 'ג'],
      ['d', 'ד'],
      ['h', 'ה'],
      ['w', 'ו'],
      ['v', 'ו'],
      ['z', 'ז'],
      ['c', 'ח'],
      ['t', 'ט'],
      ['y', 'י'],
      ['k', 'כ'],
      ['l', 'ל'],
      ['m', 'מ'],
      ['n', 'נ'],
      ['s', 'ס'],
      ['`', 'ע'],
      ['p', 'פ'],
      ['x', 'צ'],
      ['q', 'ק'],
      ['r', 'ר'],
      ['$', 'שׂ'],
      ['S', 'שׁ'],
      ['#', 'שׁ'],
      ['T', 'ת'],
    ] as [string, string][])('key %s produces %s', (key, expected) => {
      const result = processHebrewKey(key, false);
      expect(result.preventDefault).toBe(true);
      expect(result.append).toBe(expected);
    });
  });

  describe('nikud (vowel point) mappings', () => {
    it.each([
      ['a', 'ַ'],  // patah
      ['A', 'ָ'],  // qamets
      ['e', 'ֶ'],  // segol
      ['E', 'ֵ'],  // tsere
      ['i', 'ִ'],  // hireq
      ['o', 'ֹ'],  // holem
      ['u', 'ֻ'],  // qibbuts
    ] as [string, string][])('key %s produces %s', (key, expected) => {
      const result = processHebrewKey(key, false);
      expect(result.preventDefault).toBe(true);
      expect(result.append).toBe(expected);
    });
  });

  describe('compound nikud mappings', () => {
    it('key O produces holem waw (וֹ)', () => {
      const result = processHebrewKey('O', false);
      expect(result.preventDefault).toBe(true);
      expect(result.append).toBe('וֹ');
    });

    it('key U produces shureq (וּ)', () => {
      const result = processHebrewKey('U', false);
      expect(result.preventDefault).toBe(true);
      expect(result.append).toBe('וּ');
    });
  });

  describe('dagesh', () => {
    it('key . produces dagesh', () => {
      const result = processHebrewKey('.', false);
      expect(result.preventDefault).toBe(true);
      expect(result.append).toBe(DAGESH);
    });

    it('key * produces dagesh', () => {
      const result = processHebrewKey('*', false);
      expect(result.preventDefault).toBe(true);
      expect(result.append).toBe(DAGESH);
    });
  });

  describe('sheva', () => {
    it('key : produces sheva', () => {
      const result = processHebrewKey(':', false);
      expect(result.preventDefault).toBe(true);
      expect(result.append).toBe(SHEVA);
    });
  });

  describe('unmapped keys', () => {
    it('does not intercept numbers', () => {
      expect(processHebrewKey('1', false)).toEqual({ preventDefault: false, append: null });
    });

    it('does not intercept space', () => {
      expect(processHebrewKey(' ', false)).toEqual({ preventDefault: false, append: null });
    });

    it('does not intercept Enter', () => {
      expect(processHebrewKey('Enter', false)).toEqual({ preventDefault: false, append: null });
    });

    it('does not intercept Backspace', () => {
      expect(processHebrewKey('Backspace', false)).toEqual({ preventDefault: false, append: null });
    });

    it('does not intercept Tab', () => {
      expect(processHebrewKey('Tab', false)).toEqual({ preventDefault: false, append: null });
    });

    it('does not intercept j (unmapped letter)', () => {
      expect(processHebrewKey('j', false)).toEqual({ preventDefault: false, append: null });
    });

    it('does not intercept f (unmapped letter)', () => {
      expect(processHebrewKey('f', false)).toEqual({ preventDefault: false, append: null });
    });
  });
});

// ---------------------------------------------------------------------------
// processHebrewInput (beforeinput path)
// ---------------------------------------------------------------------------

describe('processHebrewInput', () => {
  it('maps a consonant key', () => {
    expect(processHebrewInput('b').append).toBe('ב');
  });

  it('maps a nikud key', () => {
    expect(processHebrewInput('a').append).toBe('ַ');
  });

  it('maps sheva', () => {
    expect(processHebrewInput(':').append).toBe(SHEVA);
  });

  it('passes through unmapped character', () => {
    expect(processHebrewInput('j')).toEqual({ preventDefault: false, append: null });
  });
});

// ---------------------------------------------------------------------------
// applyFinalForms
// ---------------------------------------------------------------------------

describe('applyFinalForms', () => {
  it('converts כ to ך at end of string', () => {
    expect(applyFinalForms('מלכ')).toBe('מלך');
  });

  it('converts מ to ם at end of string', () => {
    expect(applyFinalForms('שׁלום')).toBe('שׁלום');  // mem is already final mem in the source — test plain
    expect(applyFinalForms('עמ')).toBe('עם');
  });

  it('converts נ to ן at end of string', () => {
    expect(applyFinalForms('בנ')).toBe('בן');
  });

  it('converts פ to ף at end of string', () => {
    expect(applyFinalForms('אלפ')).toBe('אלף');
  });

  it('converts צ to ץ at end of string', () => {
    expect(applyFinalForms('ארצ')).toBe('ארץ');
  });

  it('does NOT convert a final-form candidate in the middle of a word', () => {
    expect(applyFinalForms('כתב')).toBe('כתב');  // kaf is mid-word
  });

  it('converts at word boundary before a space', () => {
    expect(applyFinalForms('מלכ שׁלמה')).toBe('מלך שׁלמה');
  });

  it('converts the last word when there are multiple words', () => {
    expect(applyFinalForms('בנ אדמ')).toBe('בן אדם');
  });

  it('keeps combining marks (nikud) on the converted letter', () => {
    // mem with qamets at word end → final mem with qamets
    const input = 'עמָ';  // ayin + mem + qamets
    const result = applyFinalForms(input);
    expect(result).toBe('עםָ');
  });

  it('returns unchanged text when no final-form candidates present', () => {
    expect(applyFinalForms('אברהם')).toBe('אברהם');
  });

  it('handles empty string', () => {
    expect(applyFinalForms('')).toBe('');
  });

  it('handles a lone final-form candidate', () => {
    expect(applyFinalForms('כ')).toBe('ך');
  });
});

// ---------------------------------------------------------------------------
// stripNikud
// ---------------------------------------------------------------------------

describe('stripNikud', () => {
  it('removes patah', () => {
    expect(stripNikud('בַּיִת')).not.toContain('ַ');
  });

  it('removes sheva', () => {
    expect(stripNikud('בְּרֵאשִׁית')).not.toContain(SHEVA);
  });

  it('leaves consonants intact', () => {
    expect(stripNikud('מֶלֶךְ')).toContain('מ');
    expect(stripNikud('מֶלֶךְ')).toContain('ל');
    expect(stripNikud('מֶלֶךְ')).toContain('ך');
  });

  it('handles a string with no nikud', () => {
    expect(stripNikud('מלך')).toBe('מלך');
  });

  it('handles empty string', () => {
    expect(stripNikud('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// stripAllDiacritics
// ---------------------------------------------------------------------------

describe('stripAllDiacritics', () => {
  it('removes nikud and cantillation from a fully pointed word', () => {
    // בְּרֵאשִׁית — with nikud and cantillation
    const result = stripAllDiacritics('בְּרֵאשִׁית');
    // Only consonants should remain
    for (const ch of result) {
      const cp = ch.codePointAt(0)!;
      // All remaining code points should be consonants (U+05D0–U+05EA)
      // or regular ASCII (unlikely but safe to allow)
      expect(cp < 0x0591 || (cp >= 0x05D0 && cp <= 0x05EA)).toBe(true);
    }
  });

  it('handles empty string', () => {
    expect(stripAllDiacritics('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// checkHebrewAnswer
// ---------------------------------------------------------------------------

describe('checkHebrewAnswer', () => {
  it('returns correct for exact match', () => {
    expect(checkHebrewAnswer('מֶלֶךְ', 'מֶלֶךְ')).toBe('correct');
  });

  it('returns correct ignoring surrounding whitespace', () => {
    expect(checkHebrewAnswer('  מֶלֶךְ  ', 'מֶלֶךְ')).toBe('correct');
  });

  it('returns nikud-only when consonants match but vowels differ', () => {
    // User typed מלך (no nikud) vs correct מֶלֶךְ (pointed)
    expect(checkHebrewAnswer('מלך', 'מֶלֶךְ')).toBe('nikud-only');
  });

  it('returns nikud-only when nikud is wrong but consonants are right', () => {
    // patah instead of qamets — consonants same
    expect(checkHebrewAnswer('מַלַךְ', 'מֶלֶךְ')).toBe('nikud-only');
  });

  it('returns wrong when consonants differ', () => {
    expect(checkHebrewAnswer('בית', 'מלך')).toBe('wrong');
  });

  it('handles empty inputs', () => {
    expect(checkHebrewAnswer('', '')).toBe('correct');
    expect(checkHebrewAnswer('', 'מלך')).toBe('wrong');
  });
});

// ---------------------------------------------------------------------------
// translateHebrewInput
// ---------------------------------------------------------------------------

describe('translateHebrewInput', () => {
  it('translates a sequence of consonant keys', () => {
    const result = translateHebrewInput('mlk');
    expect(result).toBe('מלכ');
  });

  it('passes through characters that are already Hebrew', () => {
    expect(translateHebrewInput('מלך')).toBe('מלך');
  });

  it('passes through space', () => {
    expect(translateHebrewInput('b n')).toBe('ב נ');
  });

  it('translates nikud keys mixed with consonants', () => {
    // m + a = mem + patah
    expect(translateHebrewInput('ma')).toContain('מ');
    expect(translateHebrewInput('ma')).toContain('ַ');
  });

  it('handles empty string', () => {
    expect(translateHebrewInput('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Map coverage — every CONSONANT_MAP entry is tested above, but verify counts
// ---------------------------------------------------------------------------

describe('map completeness', () => {
  it('CONSONANT_MAP covers all 22 Hebrew letters (some with alternates)', () => {
    // The Hebrew alphabet has 22 letters. Shin (שׁ) and sin (שׂ) share the same
    // base character (U+05E9) but are distinct Unicode strings due to their dots,
    // so unique string values in the map = 23 (22 letters + 1 extra for shin/sin).
    // w/v map to the same ו (1 dedupe), and S/# map to the same שׁ (1 dedupe).
    const uniqueValues = new Set(Object.values(CONSONANT_MAP));
    expect(uniqueValues.size).toBe(23);
  });

  it('NIKUD_MAP has 7 entries', () => {
    expect(Object.keys(NIKUD_MAP).length).toBe(7);
  });

  it('COMPOUND_NIKUD_MAP has 2 entries', () => {
    expect(Object.keys(COMPOUND_NIKUD_MAP).length).toBe(2);
  });

  it('HATEPH_MAP has 3 entries', () => {
    expect(Object.keys(HATEPH_MAP).length).toBe(3);
  });
});
