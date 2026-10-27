import { describe, expect, it } from 'vitest';
import { stripCantillation } from '../lib/hebrew-input';
import { hasCorpus, isAttested } from '../test/corpus';
import {
  allNouns,
  articleIrregulars,
  articleNotes,
  articleRules,
  type Example,
  type FormRule,
  independentPrepositions,
  inseparablePrepositions,
  inseparableRules,
  minRules,
  NOUN_ENDINGS,
  NOUN_FORM_LABELS,
  NOUN_NUMBERS,
  NOUN_STATES,
  nounGroups,
  nounNotes,
  prepositionNotes,
} from './grammar-nominal';

/** The stress mark, which is the only accent a form here may carry. */
const STRESS = '֫';
const DAGESH = 'ּ';
const HEBREW_WORDS = /[֐-׿]+(?:־[֐-׿]+)*/g;

const RULE_SETS: Record<string, FormRule[]> = {
  article: articleRules,
  inseparable: inseparableRules,
  min: minRules,
};

const EXAMPLES: Example[] = [
  ...Object.values(RULE_SETS).flatMap((rules) => rules.flatMap((r) => r.examples)),
  ...articleIrregulars,
  ...independentPrepositions,
];

const NOTES = [...nounNotes, ...articleNotes, ...prepositionNotes];

/** Every Hebrew word this file prints, whether in a table or inside a sentence. */
const ALL_HEBREW = [
  ...allNouns.flatMap((n) => [n.lemma, ...Object.values(n.forms)]),
  ...EXAMPLES.flatMap((e) => [e.hebrew, ...(e.from ? [e.from] : [])]),
  ...inseparablePrepositions.map((p) => p.hebrew),
  ...NOTES.flatMap((note) => note.match(HEBREW_WORDS) ?? []),
];

describe('noun endings', () => {
  it('gives an ending for every gender, number and state', () => {
    for (const gender of ['m', 'f'] as const) {
      for (const number of NOUN_NUMBERS) {
        for (const state of NOUN_STATES) {
          expect(NOUN_ENDINGS[gender][number][state], `${gender} ${number} ${state}`).toBeTypeOf(
            'string',
          );
        }
      }
    }
  });

  it('leaves the masculine singular bare in both states', () => {
    expect(NOUN_ENDINGS.m.singular).toEqual({ absolute: '', construct: '' });
  });

  it('agrees with the model nouns', () => {
    const noun = (id: string) => allNouns.find((n) => n.id === id)?.forms ?? {};
    const plain = (s: string) => stripCantillation(s);
    expect(noun('sus').plAbs).toBe(`סוּס${NOUN_ENDINGS.m.plural.absolute}`);
    expect(noun('sus').plCstr).toBe(`סוּס${NOUN_ENDINGS.m.plural.construct}`);
    expect(noun('susah').sgAbs).toBe(`סוּס${NOUN_ENDINGS.f.singular.absolute}`);
    expect(noun('susah').sgCstr).toBe(`סוּס${NOUN_ENDINGS.f.singular.construct}`);
    expect(noun('susah').plAbs).toBe(`סוּס${NOUN_ENDINGS.f.plural.absolute}`);
    expect(plain(noun('yad').duAbs ?? '')).toBe(`יָד${plain(NOUN_ENDINGS.m.dual.absolute)}`);
  });
});

describe('noun groups', () => {
  it('has unique group and noun ids', () => {
    expect(new Set(nounGroups.map((g) => g.id)).size).toBe(nounGroups.length);
    expect(new Set(allNouns.map((n) => n.id)).size).toBe(allNouns.length);
  });

  it('fills exactly the columns its group shows, for every noun', () => {
    for (const group of nounGroups) {
      expect(group.note, group.id).not.toBe('');
      for (const noun of group.nouns) {
        expect(Object.keys(noun.forms).sort(), noun.id).toEqual([...group.columns].sort());
        for (const key of group.columns) expect(NOUN_FORM_LABELS[key]).toBeDefined();
      }
    }
  });

  it('lists each noun under its unaccented singular absolute', () => {
    for (const noun of allNouns) {
      expect(noun.lemma, noun.id).not.toContain(STRESS);
      expect(stripCantillation(noun.forms.sgAbs ?? ''), noun.id).toBe(noun.lemma);
    }
  });

  it('keeps the singular construct of a segolate identical to its absolute', () => {
    const segolates = nounGroups.find((g) => g.id === 'segolates')?.nouns ?? [];
    expect(segolates.length).toBeGreaterThan(0);
    for (const noun of segolates) {
      expect(noun.forms.sgCstr, noun.id).toBe(noun.forms.sgAbs);
      expect(noun.forms.sgAbs, noun.id).toContain(STRESS);
    }
  });

  it('marks the stress on every dual, which is never on the last syllable', () => {
    const duals = nounGroups.find((g) => g.id === 'duals')?.nouns ?? [];
    for (const noun of duals) {
      expect(noun.forms.duAbs, noun.id).toContain(STRESS);
      expect(stripCantillation(noun.forms.duAbs ?? ''), noun.id).toMatch(/ַיִם$/);
      expect(noun.forms.duCstr, noun.id).toMatch(/ֵי$/);
    }
  });
});

describe('rules', () => {
  it.each(
    Object.entries(RULE_SETS),
  )('%s rules have unique ids and at least one example each', (_, rules) => {
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
    for (const rule of rules) {
      expect(rule.when, rule.id).not.toBe('');
      expect(rule.note, rule.id).not.toBe('');
      expect(rule.examples.length, rule.id).toBeGreaterThan(0);
    }
  });

  it('builds every article example on the word it starts from', () => {
    for (const example of [...articleRules.flatMap((r) => r.examples), ...articleIrregulars]) {
      expect(example.hebrew.startsWith('ה'), example.hebrew).toBe(true);
      const consonants = (s: string) => s.replace(/[^א-ת]/g, '');
      expect(consonants(example.hebrew), example.hebrew).toBe(`ה${consonants(example.from ?? '')}`);
    }
  });

  it('doubles the first letter after the regular article and after prefixed מִן', () => {
    const doubled = [
      ...(articleRules.find((r) => r.id === 'regular')?.examples ?? []),
      ...(minRules.find((r) => r.id === 'prefixed')?.examples ?? []),
    ];
    expect(doubled.length).toBeGreaterThan(0);
    for (const example of doubled) {
      // Prefix consonant, its vowel, then the doubled letter — whose dagesh
      // follows its own vowel in NFC order.
      expect(example.hebrew, example.hebrew).toMatch(
        new RegExp(
          `^[\\u05D0-\\u05EA][\\u05B0-\\u05BB][\\u05D0-\\u05EA][\\u05B0-\\u05BB]*${DAGESH}`,
        ),
      );
    }
  });

  it('never doubles a guttural or resh', () => {
    for (const text of ALL_HEBREW) {
      expect(text, text).not.toMatch(/[אהחער]ּ/);
    }
  });
});

describe('prepositions', () => {
  it('lists the three inseparable prepositions with their sheva', () => {
    expect(inseparablePrepositions.map((p) => p.hebrew)).toEqual(['בְּ', 'לְ', 'כְּ']);
  });

  it('lists each independent preposition once, with a gloss', () => {
    const seen = independentPrepositions.map((p) => `${p.hebrew}|${p.gloss}`);
    expect(new Set(seen).size).toBe(seen.length);
    for (const p of independentPrepositions) expect(p.gloss, p.hebrew).not.toBe('');
  });
});

describe('every Hebrew string', () => {
  it('is NFC', () => {
    for (const text of ALL_HEBREW) expect(text.normalize('NFC'), text).toBe(text);
  });

  it('carries no accent but the stress mark', () => {
    for (const text of ALL_HEBREW) {
      expect(text.replaceAll(STRESS, ''), text).not.toMatch(/[֑-ֽ֯]/);
    }
  });

  it('writes holem male as vav then holem', () => {
    for (const text of ALL_HEBREW) expect(text, text).not.toContain('ֹו');
  });
});

// ─── The corpus as a second witness ──────────────────────────────────────────
//
// See `src/test/corpus.ts`. Nothing in this file is copied from a printed
// table, which makes this check the main guard on its pointing rather than a
// backstop.

/**
 * Forms the Hebrew Bible happens never to use. סוּסָה is the grammarians' model
 * feminine and barely occurs; יְ is a letter named in a note, not a word.
 * A *new* entry here is what a typo looks like — check before adding one.
 */
const UNATTESTED = ['סוּסַת', 'סוּסוֹת', 'יְ'];

describe.skipIf(!hasCorpus)('against the Westminster Leningrad Codex', () => {
  it('attests every form, bar the listed gaps', () => {
    const words = ALL_HEBREW.map((text) => text.replace(/־$/, ''));
    const missing = [...new Set(words)].filter((word) => !isAttested(word));
    expect(missing.sort()).toEqual([...UNATTESTED].sort());
  });
});
