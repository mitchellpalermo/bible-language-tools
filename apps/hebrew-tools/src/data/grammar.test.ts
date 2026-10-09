import { allGlyphs } from '@tools/shared/ink';
import { describe, expect, it } from 'vitest';
import { DAGESH, FINAL_FORM_MAP } from '../lib/hebrew-input';
import {
  ALPHABET_LETTER_COUNT,
  dageshKinds,
  getVowel,
  letterGroups,
  letters,
  shevaRules,
  VOWEL_CLASSES,
  VOWEL_LENGTHS,
  vowels,
  vowelsAt,
} from './grammar';
import { hebrewScriptPack } from './script-pack';

/** Every Hebrew string the reference prints, for the checks that apply to all of them. */
const ALL_HEBREW = [
  ...letters.flatMap((l) => [l.char, l.final ?? '', l.begadkephat?.hard ?? '']),
  ...letterGroups.flatMap((g) => g.letters),
  ...dageshKinds.map((k) => k.example),
  ...vowels.map((v) => v.display),
  ...shevaRules.map((r) => r.example),
].filter(Boolean);

describe('letters', () => {
  it('has a row for every consonant in the script pack, in the same order', () => {
    const pack = allGlyphs(hebrewScriptPack).filter((g) => g.group === 'consonant');
    expect(letters.map((l) => l.char)).toEqual(pack.map((g) => g.char));
    expect(letters.map((l) => l.name)).toEqual(pack.map((g) => g.name));
  });

  it('counts shin and sin as one letter of a 22-letter alphabet', () => {
    expect(letters).toHaveLength(ALPHABET_LETTER_COUNT + 1);
    expect(letters.filter((l) => l.char.startsWith('ש'))).toHaveLength(2);
    expect(letters[0].name).toBe('alef');
    expect(letters.at(-1)?.name).toBe('tav');
  });

  it('gives every letter a sound and a transliteration', () => {
    for (const letter of letters) {
      expect(letter.sound, letter.name).not.toBe('');
      expect(letter.translit, letter.name).not.toBe('');
    }
  });

  it('carries the five final forms the input layer knows', () => {
    const withFinal = letters.filter((l) => l.final);
    expect(Object.fromEntries(withFinal.map((l) => [l.char, l.final]))).toEqual(FINAL_FORM_MAP);
  });

  it('marks exactly the six begadkephat letters, each hard form being the letter plus a dagesh', () => {
    const begadkephat = letters.filter((l) => l.begadkephat);
    expect(begadkephat.map((l) => l.char).join('')).toBe('בגדכפת');
    for (const letter of begadkephat) {
      expect(letter.begadkephat?.hard).toBe(letter.char + DAGESH);
      expect(letter.begadkephat?.softTranslit).not.toBe(letter.translit);
    }
  });

  it('names a soft sound only where the pronunciation still differs', () => {
    const differs = letters.filter((l) => l.begadkephat?.softSound).map((l) => l.char);
    expect(differs.join('')).toBe('בכפ');
  });

  it('marks the four gutturals', () => {
    expect(
      letters
        .filter((l) => l.guttural)
        .map((l) => l.char)
        .join(''),
    ).toBe('אהחע');
  });
});

describe('letterGroups', () => {
  const group = (id: string) => letterGroups.find((g) => g.id === id);

  it('derives begadkephat, gutturals and finals from the letters', () => {
    expect(group('begadkephat')?.letters).toEqual(['בּ', 'גּ', 'דּ', 'כּ', 'פּ', 'תּ']);
    expect(group('gutturals')?.letters).toEqual(['א', 'ה', 'ח', 'ע']);
    expect(group('finals')?.letters).toEqual(['ך', 'ם', 'ן', 'ף', 'ץ']);
  });

  it('lists only letters of the alphabet', () => {
    const known = new Set([...letters.flatMap((l) => [l.char, l.final, l.begadkephat?.hard])]);
    for (const g of letterGroups) {
      expect(g.note, g.id).not.toBe('');
      for (const char of g.letters) expect(known.has(char), `${g.id}: ${char}`).toBe(true);
    }
  });

  it('has unique ids', () => {
    expect(new Set(letterGroups.map((g) => g.id)).size).toBe(letterGroups.length);
  });
});

describe('dageshKinds', () => {
  it('covers lene and forte, each with an example that carries a dagesh', () => {
    expect(dageshKinds.map((k) => k.id)).toEqual(['lene', 'forte']);
    for (const kind of dageshKinds) expect(kind.example).toContain(DAGESH);
  });
});

describe('vowels', () => {
  it('places every vowel point in the script pack', () => {
    const pack = allGlyphs(hebrewScriptPack).filter((g) => g.group === 'vowel');
    for (const glyph of pack) {
      const vowel = getVowel(glyph.name);
      expect(vowel, glyph.name).toBeDefined();
      expect(vowel?.display, glyph.name).toContain(glyph.char);
      expect(vowel?.translit).toBe(glyph.phonetic);
    }
  });

  it('adds the vowels a chart needs and a handwriting deck does not', () => {
    expect(getVowel('qamets hatuf')).toMatchObject({ vowelClass: 'u', length: 'short' });
    expect(getVowel('hireq yod')).toMatchObject({ vowelClass: 'i', length: 'vowel-letter' });
    expect(getVowel('tsere yod')).toMatchObject({ vowelClass: 'i', length: 'vowel-letter' });
    expect(getVowel('no such vowel')).toBeUndefined();
  });

  it('has unique names', () => {
    expect(new Set(vowels.map((v) => v.name)).size).toBe(vowels.length);
  });

  it('shows every vowel on a host consonant, never as a bare point', () => {
    for (const vowel of vowels) {
      expect(vowel.display, vowel.name).toMatch(/^[א-ת]/);
      expect(vowel.display.length, vowel.name).toBeGreaterThan(1);
    }
  });

  it('shows the hatephs under a guttural', () => {
    for (const name of ['hateph patah', 'hateph segol', 'hateph qamets']) {
      expect(getVowel(name)?.display.startsWith('א'), name).toBe(true);
      expect(getVowel(name)?.length).toBe('reduced');
    }
  });

  it('writes holem male as vav then holem, so the point lands on the vav', () => {
    expect(getVowel('holem male')?.display.endsWith('וֹ')).toBe(true);
  });

  it('leaves only the sheva outside the classes', () => {
    expect(vowels.filter((v) => v.vowelClass === null).map((v) => v.name)).toEqual(['sheva']);
  });

  it('lays the chart out so that every classed vowel sits in exactly one cell', () => {
    const cells = VOWEL_LENGTHS.flatMap((length) =>
      VOWEL_CLASSES.flatMap((vowelClass) => vowelsAt(vowelClass, length)),
    );
    expect(cells).toHaveLength(vowels.length - 1);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('fills the cells the way the chart is taught', () => {
    const names = (c: 'a' | 'i' | 'u', l: (typeof VOWEL_LENGTHS)[number]) =>
      vowelsAt(c, l).map((v) => v.name);
    expect(names('a', 'short')).toEqual(['patah']);
    expect(names('a', 'long')).toEqual(['qamets']);
    expect(names('i', 'short')).toEqual(['segol', 'hireq']);
    expect(names('i', 'long')).toEqual(['tsere']);
    expect(names('u', 'short')).toEqual(['qibbuts', 'qamets hatuf']);
    expect(names('u', 'long')).toEqual(['holem']);
    expect(names('a', 'vowel-letter')).toEqual([]);
    expect(names('i', 'vowel-letter')).toEqual(['tsere yod', 'hireq yod']);
    expect(names('u', 'vowel-letter')).toEqual(['shureq', 'holem male']);
    expect(names('u', 'reduced')).toEqual(['hateph qamets']);
  });
});

describe('shevaRules', () => {
  it('gives rules for both kinds, each with a sheva in its example', () => {
    expect(shevaRules.some((r) => r.kind === 'vocal')).toBe(true);
    expect(shevaRules.some((r) => r.kind === 'silent')).toBe(true);
    for (const rule of shevaRules) expect(rule.example, rule.rule).toContain('ְ');
  });

  it('does not state the same rule twice', () => {
    expect(new Set(shevaRules.map((r) => r.rule)).size).toBe(shevaRules.length);
  });
});

describe('every Hebrew string', () => {
  // A dagesh typed before its vowel and one typed after are the same letter
  // and render the same; only NFC makes them compare equal too.
  it('is NFC', () => {
    for (const text of ALL_HEBREW) expect(text.normalize('NFC'), text).toBe(text);
  });

  it('carries no cantillation beyond the stress mark', () => {
    for (const text of ALL_HEBREW) {
      expect(text.replace(/֫/g, ''), text).not.toMatch(/[֑-֯]/);
    }
  });
});
