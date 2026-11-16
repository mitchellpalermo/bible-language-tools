import { describe, expect, it } from 'vitest';
import { buildParseForms, poolVerbCode, rootOf, witnessed } from './parse-forms.mjs';

const w = (text, lemma, parsing, extra = {}) => ({ text, lemma, pos: 'V', parsing, ...extra });

describe('poolVerbCode', () => {
  it('takes a Hebrew verb in one of the seven stems, prefixes allowed', () => {
    expect(poolVerbCode(w('וַ/יֹּ֥אמֶר', '559', 'HC/Vqw3ms'))).toBe('Vqw3ms');
    expect(poolVerbCode(w('לִ/שְׁמֹר', '8104', 'HR/Vqc'))).toBe('Vqc');
  });

  it('leaves out what the drill does not ask', () => {
    // Aramaic, a suffix after the verb, a minor stem, a ketiv, a non-verb, a bare stem letter.
    expect(poolVerbCode(w('אֲמַר', '560', 'AVqp3ms'))).toBeNull();
    expect(poolVerbCode(w('שְׁמָר/ֵנִי', '8104', 'HVqv2ms/Sp1cs'))).toBeNull();
    expect(poolVerbCode(w('קוֹמֵם', '6965b', 'HVoc'))).toBeNull();
    expect(poolVerbCode(w('ויאמר', '559', 'HC/Vqw3ms', { ketiv: true }))).toBeNull();
    expect(poolVerbCode(w('דָּבָר', '1697', 'HNcmsa'))).toBeNull();
    expect(poolVerbCode(w('x', '1', 'HVq'))).toBeNull();
  });
});

describe('rootOf', () => {
  it("is the lexicon's root, else the headword's consonants", () => {
    expect(rootOf({ hebrew: 'יָשַׁב', root: 'ישׁב' })).toBe('ישׁב');
    expect(rootOf({ hebrew: 'הָיָה' })).toBe('היה');
    expect(rootOf({})).toBe('');
  });
});

describe('witnessed', () => {
  it('borrows readings of the same letters, but never a weqatal or wayyiqtol', () => {
    const elsewhere = new Map([
      ['8104|Vqv2ms', 3],
      ['8104|Vqc', 5],
      ['8104|Vqq3ms', 1],
    ]);
    expect(witnessed([['8104', 'Vqv2ms', 3]], elsewhere)).toEqual([['8104', 'Vqc', 0]]);
    expect(witnessed([], undefined)).toEqual([]);
  });
});

describe('buildParseForms', () => {
  const lemmas = {
    559: { count: 5000, hebrew: 'אָמַר', root: 'אמר' },
    8104: { count: 400, hebrew: 'שָׁמַר', root: 'שׁמר' },
    9999: { count: 3, hebrew: 'נָדִיר' },
  };
  const book = {
    1: {
      1: [
        w('וַ/יֹּ֥אמֶר', '559', 'HC/Vqw3ms'),
        w('וַ/יֹּאמֶר', '559', 'HC/Vqw3ms'),
        w('שְׁמֹר', '8104', 'HVqv2ms'),
        w('לִ/שְׁמֹר', '8104', 'HR/Vqc'),
        w('נָדַר', '9999', 'HVqp3ms'),
      ],
    },
  };

  it('groups by unaccented spelling, counts readings, and keeps prefixes in the code', () => {
    const { forms } = buildParseForms([book], lemmas);
    const byForm = new Map(forms);
    expect(byForm.get('וַיֹּאמֶר'.normalize('NFC'))).toEqual([['559', 'C/Vqw3ms', 2]]);
    expect(byForm.get('לִשְׁמֹר'.normalize('NFC'))).toEqual([['8104', 'R/Vqc', 1]]);
  });

  it('lets a bare form borrow what its letters are behind a prefix, and not the reverse', () => {
    const byForm = new Map(buildParseForms([book], lemmas).forms);
    expect(byForm.get('שְׁמֹר'.normalize('NFC'))).toEqual([
      ['8104', 'Vqv2ms', 1],
      ['8104', 'Vqc', 0],
    ]);
  });

  it('leaves out rare verbs and lists the lemmas it used', () => {
    const { forms, lemmas: table } = buildParseForms([book], lemmas);
    expect(forms.some(([f]) => f.startsWith('נ'))).toBe(false);
    expect(table).toEqual({ 559: ['אָמַר', 'אמר'], 8104: ['שָׁמַר', 'שׁמר'] });
  });
});
