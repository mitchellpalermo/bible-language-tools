import { describe, expect, it } from 'vitest';
import { hasCorpus, isAttested } from '../test/corpus';
import type { Example, FormRule } from './grammar-nominal';
import {
  demonstratives,
  feminineTavRule,
  interrogativeRules,
  POSSESSIVE_EN,
  personalPronouns,
  prepositionSuffixRules,
  pronounNotes,
  pronounPgnLabel,
  relativePronouns,
  SUFFIX_PGNS,
  type SuffixPgn,
  suffixNotes,
  suffixParadigms,
} from './grammar-pronominal';

/** The stress mark, which is the only accent a form here may carry. */
const STRESS = '֫';
const HEBREW_WORDS = /[֐-׿]+(?:־[֐-׿]+)*/g;

const RULE_SETS: Record<string, FormRule[]> = {
  interrogative: interrogativeRules,
  prepositionSuffix: prepositionSuffixRules,
};

const EXAMPLES: Example[] = [
  ...Object.values(RULE_SETS).flatMap((rules) => rules.flatMap((r) => r.examples)),
  ...relativePronouns,
  ...feminineTavRule.examples,
];

const NOTES = [
  ...pronounNotes,
  ...suffixNotes,
  ...suffixParadigms.map((p) => p.note),
  feminineTavRule.note,
];

/** Every Hebrew word this file prints, whether in a table or inside a sentence. */
const ALL_HEBREW = [
  ...personalPronouns.map((p) => p.hebrew),
  ...demonstratives.map((d) => d.hebrew),
  ...EXAMPLES.flatMap((e) => [e.hebrew, ...(e.from ? [e.from] : [])]),
  ...suffixParadigms.flatMap((p) => Object.values(p.forms)),
  ...NOTES.flatMap((note) => note.match(HEBREW_WORDS) ?? []),
];

describe('personal pronouns', () => {
  it('covers every person, gender and number', () => {
    const pgns = personalPronouns.map((p) => p.pgn);
    for (const pgn of ['1cs', '2ms', '2fs', '3ms', '3fs', '1cp', '2mp', '2fp', '3mp', '3fp']) {
      expect(pgns, pgn).toContain(pgn);
    }
  });

  it('labels every row, alternates included', () => {
    for (const p of personalPronouns) {
      expect(pronounPgnLabel(p.pgn), p.hebrew).not.toBe('');
    }
    expect(pronounPgnLabel('1cs-alt')).toContain('alternate');
  });

  it('keeps the longer alternates beside their plain forms', () => {
    const hebrew = personalPronouns.map((p) => p.hebrew);
    expect(hebrew).toContain('אֲנִי');
    expect(hebrew).toContain('אָנֹכִי');
    expect(hebrew).toContain('הֵנָּה');
    expect(hebrew).toContain('הֵמָּה');
  });
});

describe('demonstratives', () => {
  it('gives near and far, singular and plural', () => {
    const near = demonstratives.filter((d) => d.distance === 'near');
    const far = demonstratives.filter((d) => d.distance === 'far');
    expect(near.map((d) => d.hebrew)).toEqual(['זֶה', 'זֹאת', 'אֵלֶּה']);
    expect(far.length).toBeGreaterThan(0);
    for (const d of far) {
      expect(
        personalPronouns.some((p) => p.hebrew === d.hebrew),
        d.hebrew,
      ).toBe(true);
    }
  });
});

describe('suffix paradigms', () => {
  it('fills every person, gender and number for each set', () => {
    expect(suffixParadigms.map((p) => p.suffixType).sort()).toEqual(['type1', 'type2']);
    for (const paradigm of suffixParadigms) {
      expect(Object.keys(paradigm.forms).sort(), paradigm.id).toEqual([...SUFFIX_PGNS].sort());
      for (const pgn of SUFFIX_PGNS) {
        expect(paradigm.forms[pgn], `${paradigm.id} ${pgn}`).not.toBe('');
        expect(POSSESSIVE_EN[pgn as SuffixPgn], pgn).not.toBe('');
      }
    }
  });

  it('has unique paradigm ids', () => {
    expect(new Set(suffixParadigms.map((p) => p.id)).size).toBe(suffixParadigms.length);
  });

  it('tells the two sets apart at the 1cs', () => {
    const [type1, type2] = suffixParadigms;
    expect(type1.forms['1cs']).not.toBe(type2.forms['1cs']);
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
 * Forms the Hebrew Bible happens never to use. The feminine plural
 * addressees — “your (fp) name”, “their (fp) name”, “your (fp) sons” — are
 * regular formations all but absent from the text. A *new* entry here is what
 * a typo looks like — check before adding one.
 */
const UNATTESTED = ['שִׁמְכֶן', 'שְׁמָן', 'בְּנֵיכֶן'];

describe.skipIf(!hasCorpus)('against the Westminster Leningrad Codex', () => {
  it('attests every form, bar the listed gaps', () => {
    const words = ALL_HEBREW.map((text) => text.replace(/־$/, ''));
    const missing = [...new Set(words)].filter((word) => !isAttested(word));
    expect(missing.sort()).toEqual([...UNATTESTED].sort());
  });
});
