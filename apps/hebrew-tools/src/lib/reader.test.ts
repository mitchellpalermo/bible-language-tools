import { describe, expect, it } from 'vitest';
import type { HebrewWord } from '../data/morphhb';
import { accentUnits, DEFAULT_REF, formatRef, hebrewNumeral, MAQQEF, parseRef } from './reader';

const word = (text: string, after?: string): HebrewWord => ({
  text,
  lemma: '1',
  pos: 'Nc',
  parsing: 'HNcmsa',
  ...(after ? { after } : {}),
});

describe('parseRef', () => {
  it('reads a book and chapter', () => {
    expect(parseRef('GEN.1')).toEqual({ book: 'GEN', chapter: 1 });
    expect(parseRef('PSA.119')).toEqual({ book: 'PSA', chapter: 119 });
  });

  it('reads a book code that starts with a digit', () => {
    expect(parseRef('1SA.2')).toEqual({ book: '1SA', chapter: 2 });
    expect(parseRef('2CH.36')).toEqual({ book: '2CH', chapter: 36 });
  });

  it('reads a verse when the reference names one', () => {
    expect(parseRef('GEN.1.1')).toEqual({ book: 'GEN', chapter: 1, verse: 1 });
    expect(parseRef('PSA.119.176')).toEqual({ book: 'PSA', chapter: 119, verse: 176 });
  });

  it('opens at Genesis 1 when there is no reference', () => {
    expect(parseRef(null)).toEqual(DEFAULT_REF);
    expect(parseRef(undefined)).toEqual(DEFAULT_REF);
    expect(parseRef('')).toEqual(DEFAULT_REF);
  });

  // A hand-edited URL is a typo, not an error state. A reader that opens at
  // Genesis is a better answer than one that opens at a stack trace.
  it.each([
    ['GENESIS.1', 'a book name rather than a code'],
    ['gen.1', 'a lowercase code'],
    ['GE.1', 'a short code'],
    ['.1', 'no book at all'],
    ['🙂.1', 'nonsense'],
  ])('falls back on %s (%s)', (ref) => {
    expect(parseRef(ref)).toEqual(DEFAULT_REF);
  });

  it('keeps a recognizable book when only the chapter is bad', () => {
    expect(parseRef('EXO.0')).toEqual({ book: 'EXO', chapter: 1 });
    expect(parseRef('EXO.-3')).toEqual({ book: 'EXO', chapter: 1 });
    expect(parseRef('EXO.two')).toEqual({ book: 'EXO', chapter: 1 });
    expect(parseRef('EXO')).toEqual({ book: 'EXO', chapter: 1 });
  });

  it('drops a bad verse rather than the whole reference', () => {
    expect(parseRef('GEN.1.0')).toEqual({ book: 'GEN', chapter: 1 });
    expect(parseRef('GEN.1.x')).toEqual({ book: 'GEN', chapter: 1 });
  });
});

describe('formatRef', () => {
  it('round-trips a passage', () => {
    for (const ref of ['GEN.1', '1SA.2', 'PSA.119.176']) {
      expect(formatRef(parseRef(ref))).toBe(ref);
    }
  });

  it('leaves the verse off when there is none', () => {
    expect(formatRef({ book: 'GEN', chapter: 1 })).toBe('GEN.1');
  });
});

describe('hebrewNumeral', () => {
  it('counts through the units and the tens', () => {
    expect(hebrewNumeral(1)).toBe('א');
    expect(hebrewNumeral(9)).toBe('ט');
    expect(hebrewNumeral(10)).toBe('י');
    expect(hebrewNumeral(11)).toBe('יא');
    expect(hebrewNumeral(20)).toBe('כ');
    expect(hebrewNumeral(21)).toBe('כא');
    expect(hebrewNumeral(99)).toBe('צט');
  });

  // Written the regular way these would spell the first two letters of the
  // divine name. A printed Tanakh writes Psalm 15 as תהלים טו.
  it('writes 15 and 16 as טו and טז', () => {
    expect(hebrewNumeral(15)).toBe('טו');
    expect(hebrewNumeral(16)).toBe('טז');
    expect(hebrewNumeral(115)).toBe('קטו');
    expect(hebrewNumeral(116)).toBe('קטז');
  });

  it('counts into the hundreds', () => {
    expect(hebrewNumeral(100)).toBe('ק');
    expect(hebrewNumeral(119)).toBe('קיט');
    expect(hebrewNumeral(150)).toBe('קנ');
    expect(hebrewNumeral(176)).toBe('קעו');
    expect(hebrewNumeral(400)).toBe('ת');
  });

  it('writes 500 and up as repeated tavs, there being no letter for them', () => {
    expect(hebrewNumeral(500)).toBe('תק');
    expect(hebrewNumeral(800)).toBe('תת');
    expect(hebrewNumeral(999)).toBe('תתקצט');
  });

  it('gives digits back for anything outside the range the text reaches', () => {
    expect(hebrewNumeral(0)).toBe('0');
    expect(hebrewNumeral(-1)).toBe('-1');
    expect(hebrewNumeral(1000)).toBe('1000');
    expect(hebrewNumeral(1.5)).toBe('1.5');
  });
});

describe('accentUnits', () => {
  it('leaves ordinary words as units of one', () => {
    const words = [word('בְּרֵאשִׁית'), word('בָּרָא'), word('אֱלֹהִים')];
    expect(accentUnits(words).map((u) => u.length)).toEqual([1, 1, 1]);
  });

  // A maqqef binds the words it joins into one accentual unit, pronounced under
  // one stress. Letting a line break inside עַל־כֵּן would be a typographic
  // error the printed text never makes.
  it('binds words joined by a maqqef into one unit', () => {
    const words = [word('עַל', MAQQEF), word('כֵּן'), word('וַיְהִי')];
    const units = accentUnits(words);
    expect(units).toHaveLength(2);
    expect(units[0].map((w) => w.text)).toEqual(['עַל', 'כֵּן']);
    expect(units[1].map((w) => w.text)).toEqual(['וַיְהִי']);
  });

  it('binds a chain of three', () => {
    const words = [word('כָּל', MAQQEF), word('אֲשֶׁר', MAQQEF), word('לוֹ')];
    expect(accentUnits(words)).toHaveLength(1);
  });

  // Genesis 1:5 ends `וַיְהִי־עֶרֶב וַיְהִי־בֹקֶר`, two bound pairs in a row.
  it('starts a new unit after each bound pair', () => {
    const words = [
      word('וַיְהִי', MAQQEF),
      word('עֶרֶב'),
      word('וַיְהִי', MAQQEF),
      word('בֹקֶר'),
    ];
    expect(accentUnits(words).map((u) => u.length)).toEqual([2, 2]);
  });

  it('does not bind across a paseq or a sof pasuq, which are not joiners', () => {
    const words = [word('אֱלֹהִים', '׀'), word('לָאוֹר'), word('יוֹם', '׃')];
    expect(accentUnits(words).map((u) => u.length)).toEqual([1, 1, 1]);
  });

  it('keeps the last words of a verse that ends on a maqqef', () => {
    const units = accentUnits([word('אֶת', MAQQEF), word('כָּל', MAQQEF)]);
    expect(units).toHaveLength(1);
    expect(units[0]).toHaveLength(2);
  });

  it('has nothing to group in an empty verse', () => {
    expect(accentUnits([])).toEqual([]);
  });
});
