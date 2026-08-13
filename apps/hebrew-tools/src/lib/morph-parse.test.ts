import { describe, expect, it } from 'vitest';
import {
  analyzeMorph,
  analyzeWord,
  briefMorph,
  briefWord,
  formatMorph,
  type MorphLanguage,
} from './morph-parse';
import ATTESTED_CODES from './morph-codes.json';

describe('analyzeMorph', () => {
  describe('verbs', () => {
    it('reads stem, conjugation and person-gender-number', () => {
      const analysis = analyzeMorph('Vqp3ms');
      expect(analysis).toMatchObject({
        pos: 'Verb',
        stem: 'Qal',
        detail: 'Qal perfect 3rd masculine singular',
        brief: 'Qal qatal 3ms',
      });
    });

    it('names the sequential conjugations, which are the ones a reader meets first', () => {
      expect(formatMorph('Vqw3ms')).toBe('Verb — Qal sequential imperfect 3rd masculine singular');
      expect(briefMorph('Vqw3ms')).toBe('Qal wayyiqtol 3ms');
      expect(formatMorph('Vqq3cp')).toBe('Verb — Qal sequential perfect 3rd common plural');
      expect(briefMorph('Vqq3cp')).toBe('Qal weqatal 3cp');
    });

    it('inflects a participle for state, not person', () => {
      expect(formatMorph('Vqrmsa')).toBe('Verb — Qal active participle masculine singular absolute');
      expect(briefMorph('Vqrmsa')).toBe('Qal ptc ms');
      expect(briefMorph('Vqrmpc')).toBe('Qal ptc mp constr');
      expect(formatMorph('Vqsmsa')).toBe(
        'Verb — Qal passive participle masculine singular absolute',
      );
    });

    it('gives an infinitive no person, gender or number at all', () => {
      expect(formatMorph('Vqc')).toBe('Verb — Qal infinitive construct');
      expect(formatMorph('Vha')).toBe('Verb — Hiphil infinitive absolute');
      expect(briefMorph('Vqc')).toBe('Qal inf constr');
    });

    it('reads the coarse two-letter part of speech HebrewWord.pos carries', () => {
      expect(analyzeMorph('Vq')).toMatchObject({ pos: 'Verb', stem: 'Qal', brief: 'Qal' });
      expect(analyzeMorph('Nc')).toMatchObject({ pos: 'Noun', detail: '' });
      expect(analyzeMorph('Np')).toMatchObject({ pos: 'Proper noun' });
    });

    it('covers the derived stems beyond the seven a first-year course teaches', () => {
      expect(briefMorph('VNp3ms')).toBe('Niphal qatal 3ms');
      expect(briefMorph('VHp3ms')).toBe('Hophal qatal 3ms');
      expect(briefMorph('Vormsa')).toBe('Polel ptc ms');
      expect(briefMorph('Vtp3ms')).toBe('Hithpael qatal 3ms');
    });

    // Reads like a stutter and is not one: the Qal passive is a stem, and this
    // is its passive participle. Collapsing the two words would claim the
    // ordinary Qal passive participle, which is a different form.
    it('says "passive" twice where the form really is passive twice', () => {
      expect(briefMorph('VQsmsa')).toBe('Qal passive pass ptc ms');
      expect(formatMorph('VQsmsa')).toBe(
        'Verb — Qal passive passive participle masculine singular absolute',
      );
      expect(formatMorph('Vqsmsa')).toBe(
        'Verb — Qal passive participle masculine singular absolute',
      );
    });
  });

  describe('Aramaic', () => {
    // The reason every entry point takes a language: the same letter is a
    // different binyan in each, and Daniel and Ezra are read in the same reader.
    it('reads the stem letters against the Aramaic table', () => {
      expect(analyzeMorph('Vqp3mp', 'A')).toMatchObject({
        stem: 'Peal',
        detail: 'Peal perfect 3rd masculine plural',
      });
      expect(analyzeMorph('Vqp3mp', 'H')).toMatchObject({ stem: 'Qal' });
    });

    it('disagrees with the Hebrew table on the same code, which is the point', () => {
      expect(analyzeMorph('Vpi3ms', 'A')?.stem).toBe('Pael');
      expect(analyzeMorph('Vpi3ms', 'H')?.stem).toBe('Piel');
      expect(analyzeMorph('Vhp3ms', 'A')?.stem).toBe('Haphel');
      expect(analyzeMorph('Vhp3ms', 'H')?.stem).toBe('Hiphil');
    });

    it('reads stems that exist only in Aramaic', () => {
      expect(analyzeMorph('Vui3fs', 'A')?.stem).toBe('Hithpeel');
      expect(analyzeMorph('Vec', 'A')?.detail).toBe('Shaphel infinitive construct');
      expect(analyzeMorph('Vti3mp', 'A')?.stem).toBe('Hishtaphel');
    });

    it('reads the determined state, which Hebrew nouns do not have', () => {
      expect(formatMorph('Ncmsd', 'A')).toBe('Noun — masculine singular determined');
      expect(briefMorph('Ncmsd', 'A')).toBe('Noun ms det');
    });
  });

  describe('nominals', () => {
    it('reads gender, number and state', () => {
      expect(formatMorph('Ncfsa')).toBe('Noun — feminine singular absolute');
      expect(formatMorph('Ncmsc')).toBe('Noun — masculine singular construct');
      expect(formatMorph('Ncbda')).toBe('Noun — common dual absolute');
      expect(briefMorph('Ncmsc')).toBe('Noun ms constr');
    });

    it('names a proper noun and a gentilic rather than calling both nouns', () => {
      expect(formatMorph('Np')).toBe('Proper noun');
      expect(formatMorph('Ngmpa')).toBe('Gentilic noun — masculine plural absolute');
    });

    it('names the adjective sub-types as the things they are', () => {
      expect(formatMorph('Aamsa')).toBe('Adjective — masculine singular absolute');
      expect(formatMorph('Acbpa')).toBe('Cardinal number — common plural absolute');
      expect(formatMorph('Aomsa')).toBe('Ordinal number — masculine singular absolute');
      expect(formatMorph('Agmsa')).toBe('Gentilic adjective — masculine singular absolute');
    });

    // OSHB writes `c` on verbs and `b` on nouns for what a grammar calls common
    // gender either way. The long form spells both out; the brief keeps the letter.
    it('spells both common-gender letters out the same way and abbreviates them apart', () => {
      expect(analyzeMorph('Ncbsa')?.detail).toBe('common singular absolute');
      expect(analyzeMorph('Vqp3cp')?.detail).toBe('Qal perfect 3rd common plural');
      expect(briefMorph('Ncbsa')).toBe('Noun bs');
      expect(briefMorph('Vqp3cp')).toBe('Qal qatal 3cp');
    });
  });

  describe('the small words', () => {
    it('names particles as themselves', () => {
      expect(formatMorph('Td')).toBe('Definite article');
      expect(formatMorph('To')).toBe('Direct object marker');
      expect(formatMorph('Tn')).toBe('Negative particle');
      expect(formatMorph('Tj')).toBe('Interjection');
      expect(formatMorph('T')).toBe('Particle');
    });

    it('reads a preposition that has swallowed the article', () => {
      expect(formatMorph('R')).toBe('Preposition');
      expect(formatMorph('Rd')).toBe('Preposition with the definite article');
    });

    it('reads pronouns and suffixes for person, gender and number', () => {
      expect(formatMorph('Pp3ms')).toBe('Personal pronoun — 3rd masculine singular');
      expect(formatMorph('Sp1cs')).toBe('Pronominal suffix — 1st common singular');
      expect(briefMorph('Sp3mp')).toBe('Pronominal suffix 3mp');
    });

    it('names the suffixes that are not pronouns', () => {
      expect(formatMorph('Sd')).toBe('Directional he');
      expect(formatMorph('Sh')).toBe('Paragogic he');
      expect(formatMorph('Sn')).toBe('Paragogic nun');
    });

    it('reads a bare conjunction and adverb', () => {
      expect(formatMorph('C')).toBe('Conjunction');
      expect(formatMorph('D')).toBe('Adverb');
    });
  });

  describe('x, which is a value and not a gap', () => {
    it('leaves out a person a demonstrative does not have', () => {
      expect(formatMorph('Pdxms')).toBe('Demonstrative pronoun — masculine singular');
      expect(briefMorph('Pdxms')).toBe('Demonstrative pronoun ms');
    });

    it('accepts it in the sub-type slot too', () => {
      expect(formatMorph('Nxxxa')).toBe('Noun — absolute');
      expect(briefMorph('Nxxxa')).toBe('Noun');
    });

    it('still reads the slots it does fill', () => {
      expect(formatMorph('Pfxbs')).toBe('Indefinite pronoun — common singular');
    });
  });

  describe('codes it will not guess at', () => {
    // A caller can render a raw code and be visibly incomplete. It cannot detect
    // "masculine singular" that should have read "masculine dual", so a single
    // unreadable letter fails the whole code rather than leaving a hole in it.
    it.each([
      ['', 'empty'],
      ['Z', 'unknown part of speech'],
      ['Zqp3ms', 'unknown part of speech with features'],
      ['VXp3ms', 'unknown stem'],
      ['VqX3ms', 'unknown conjugation'],
      ['Vqp3mZ', 'unknown number'],
      ['VqpZms', 'unknown person'],
      ['Vqrmsz', 'unknown state'],
      ['Vqp3m', 'truncated person-gender-number'],
      ['Vqp3msa', 'over-long person-gender-number'],
      ['Vqc3ms', 'an infinitive given a person'],
      ['Ncms', 'truncated nominal'],
      ['NZmsa', 'unknown noun sub-type'],
      ['NcZsa', 'unknown gender'],
      ['NcmZa', 'unknown number on a noun'],
      ['NcmsZ', 'unknown state'],
      ['Pp3mZ', 'unknown number on a pronoun'],
      ['SpZms', 'unknown person on a suffix'],
      ['C3ms', 'features on a part of speech that has none'],
      ['Rdmsa', 'features on a preposition'],
      ['Tdmsa', 'features on the article'],
    ])('rejects %s (%s)', (code) => {
      expect(analyzeMorph(code)).toBeNull();
    });

    it('rejects an Aramaic-only stem read as Hebrew, and the reverse', () => {
      expect(analyzeMorph('Vbp3ms', 'A')?.stem).toBe('Hephal');
      expect(analyzeMorph('Vbp3ms', 'H')).toBeNull();
      expect(analyzeMorph('Vyp3ms', 'H')?.stem).toBe('Nithpoel');
      expect(analyzeMorph('Vyp3ms', 'A')).toBeNull();
    });

    it('hands the raw code back rather than inventing a parse', () => {
      expect(formatMorph('Zqp3ms')).toBe('Zqp3ms');
      expect(briefMorph('Zqp3ms')).toBe('Zqp3ms');
    });
  });
});

describe('analyzeWord', () => {
  it('takes a prefixed word apart into its morphemes', () => {
    // Genesis 1:1 — the ב is not part of the noun, which is the first thing a
    // student has to be shown.
    const parts = analyzeWord({ text: 'בְּ/רֵאשִׁ֖ית', parsing: 'HR/Ncfsa' });
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ text: 'בְּ', code: 'R' });
    expect(parts[0].analysis?.pos).toBe('Preposition');
    expect(parts[1]).toMatchObject({ text: 'רֵאשִׁ֖ית', code: 'Ncfsa' });
    expect(parts[1].analysis?.detail).toBe('feminine singular absolute');
  });

  it('reads a word carrying both a prefix and a suffix', () => {
    expect(briefWord({ text: 'לְ/מִינ֔/וֹ', parsing: 'HR/Ncmsc/Sp3ms' })).toBe(
      'Preposition + Noun ms constr + Pronominal suffix 3ms',
    );
  });

  it('reads the wayyiqtol a narrative is made of', () => {
    expect(briefWord({ text: 'וַ/יֹּ֥אמֶר', parsing: 'HC/Vqw3ms' })).toBe(
      'Conjunction + Qal wayyiqtol 3ms',
    );
  });

  // Daniel 2:4. The Aramaic article is postpositive, so the article follows its
  // noun instead of leading it, and the stem table has to be the Aramaic one.
  it('reads an Aramaic word, article last', () => {
    expect(briefWord({ text: 'מַלְכָּ/א֙', parsing: 'ANcmsd/Td' })).toBe(
      'Noun ms det + Definite article',
    );
    expect(briefWord({ text: 'חֱיִ֔י', parsing: 'AVqv2ms' })).toBe('Peal impv 2ms');
  });

  it('falls back to the raw code for a morpheme it cannot read', () => {
    const parts = analyzeWord({ text: 'וַ/יֹּ֥אמֶר', parsing: 'HC/VZw3ms' });
    expect(parts[1].analysis).toBeNull();
    expect(briefWord({ text: 'וַ/יֹּ֥אמֶר', parsing: 'HC/VZw3ms' })).toBe('Conjunction + VZw3ms');
  });
});

// The tables come from the OSHB morphology spec, which is a list of letters and
// says nothing about which combinations occur. `scripts/extract-morph-codes.mjs`
// inventories what the Westminster Leningrad Codex actually uses; this is the
// corpus standing as the second witness.
describe('every morph code the WLC uses', () => {
  const codes = ATTESTED_CODES as string[];

  it('is a non-trivial inventory of both languages', () => {
    expect(codes.length).toBeGreaterThan(800);
    expect(codes.some((c) => c.startsWith('H'))).toBe(true);
    expect(codes.some((c) => c.startsWith('A'))).toBe(true);
  });

  it('parses, every one of them', () => {
    const unreadable = codes.filter((code) => {
      const analysis = analyzeMorph(code.slice(1), code[0] as MorphLanguage);
      return analysis === null || !analysis.pos || !analysis.brief;
    });
    expect(unreadable).toEqual([]);
  });

  it('keeps its own code and language on the analysis', () => {
    for (const code of codes) {
      const analysis = analyzeMorph(code.slice(1), code[0] as MorphLanguage);
      expect(analysis?.code).toBe(code.slice(1));
      expect(analysis?.language).toBe(code[0]);
    }
  });

  it('gives every verb a binyan and nothing else one', () => {
    for (const code of codes) {
      const analysis = analyzeMorph(code.slice(1), code[0] as MorphLanguage);
      expect(Boolean(analysis?.stem)).toBe(code[1] === 'V');
    }
  });
});
