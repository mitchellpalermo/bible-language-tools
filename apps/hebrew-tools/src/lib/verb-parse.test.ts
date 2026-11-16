import { describe, expect, it } from 'vitest';
import { STEM_NAMES } from '../data/stem-patterns';
import { analyzeMorph } from './morph-parse';
import {
  buildSession,
  CONJUGATION_LETTERS,
  CONJUGATION_NAMES,
  DEFAULT_PARSE_SETTINGS,
  describeReading,
  eligibleItems,
  emptyAnswer,
  fieldsFor,
  gradeParse,
  isComplete,
  type ParseAnswer,
  type ParseItem,
  parseVerbConcept,
  readingsOf,
  readVerbMorph,
  rootKeys,
  STEM_LABELS,
  STEM_LETTERS,
  withConjugation,
} from './verb-parse';

const item = (form: string, ...codes: [string, string][]): ParseItem => ({
  form,
  readings: codes.map(([lemma, morph]) => readVerbMorph(lemma, morph) as NonNullable<never>),
});

const LEMMAS = {
  559: { headword: 'אָמַר', root: 'אמר' },
  1961: { headword: 'הָיָה', root: '' },
  3427: { headword: 'יָשַׁב', root: 'ישׁב' },
  398: { headword: 'אָכַל', root: 'אכל' },
};

const answer = (a: Partial<ParseAnswer>): ParseAnswer => ({ ...emptyAnswer(), ...a });

describe('readVerbMorph', () => {
  it('reads a finite form, with its prefixes', () => {
    expect(readVerbMorph('559', 'C/Vqw3ms')).toEqual({
      lemma: '559',
      morph: 'C/Vqw3ms',
      stem: 'qal',
      conjugation: 'wayyiqtol',
      person: '3',
      gender: 'm',
      number: 's',
      conjunction: true,
    });
  });

  it('reads a participle as gender, number and state, and an infinitive as nothing more', () => {
    expect(readVerbMorph('3427', 'Vqrmpc')).toMatchObject({
      conjugation: 'participle',
      gender: 'm',
      number: 'p',
      state: 'c',
    });
    const inf = readVerbMorph('8104', 'R/Vqc');
    expect(inf).toMatchObject({ conjugation: 'infinitive construct', conjunction: false });
    expect(inf?.person).toBeUndefined();
  });

  it('fails the whole code on any letter it does not offer', () => {
    for (const bad of ['Ncmsa', 'Voc', 'Vqx3ms', 'Vqp3ms1', 'Vqp9ms', 'Vqrmsd', 'Vqcx', 'Vqr']) {
      expect(readVerbMorph('1', bad)).toBeNull();
    }
  });

  it('does not read a jussive or cohortative at all (not asked for now)', () => {
    for (const bad of ['Vqj3ms', 'Vqh1cs', 'C/Vhj3ms']) {
      expect(readVerbMorph('1', bad)).toBeNull();
    }
  });

  it('names stems as morph-parse.ts does, for every stem and conjugation letter', () => {
    for (const [letter, stem] of Object.entries(STEM_LETTERS)) {
      for (const conj of Object.keys(CONJUGATION_LETTERS)) {
        const code = `V${letter}${conj}${'rs'.includes(conj) ? 'msa' : 'ac'.includes(conj) ? '' : '3ms'}`;
        expect(analyzeMorph(code)?.stem).toBe(STEM_LABELS[stem]);
      }
    }
    expect(Object.values(STEM_LETTERS).sort()).toEqual([...STEM_NAMES].sort());
  });
});

describe('fields', () => {
  it('asks what the chosen conjugation inflects for', () => {
    expect(fieldsFor('')).toEqual(['stem', 'conjugation']);
    expect(fieldsFor('yiqtol')).toEqual(['stem', 'conjugation', 'person', 'gender', 'number']);
    expect(fieldsFor('participle')).toEqual(['stem', 'conjugation', 'gender', 'number', 'state']);
    expect(fieldsFor('infinitive absolute')).toEqual(['stem', 'conjugation']);
  });

  it('keeps shared fields when the conjugation changes and clears the rest', () => {
    const a = answer({ person: '3', gender: 'f', number: 's', conjugation: 'yiqtol' });
    expect(withConjugation(a, 'participle')).toMatchObject({
      conjugation: 'participle',
      person: '',
      gender: 'f',
      number: 's',
    });
    expect(withConjugation(answer({ state: 'c' }), 'qatal').state).toBe('');
  });

  it('is complete once every asked field, and the root if asked, has an answer', () => {
    const a = answer({ stem: 'qal', conjugation: 'infinitive construct' });
    expect(isComplete(a, false)).toBe(true);
    expect(isComplete(a, true)).toBe(false);
    expect(isComplete({ ...a, root: 'שמר' }, true)).toBe(true);
    expect(isComplete(answer({ stem: 'qal', conjugation: 'qatal', person: '3' }), false)).toBe(
      false,
    );
    expect(isComplete(answer({ stem: 'qal' }), false)).toBe(false);
  });
});

describe('readingsOf', () => {
  const keys = (i: ParseItem) =>
    readingsOf(i).map((r) => `${r.conjugation} ${r.person}${r.gender}${r.number}`);

  it('treats a prefixed 2ms as a 3fs, and never a yiqtol as a jussive or cohortative', () => {
    expect(keys(item('תִּשְׁמֹר', ['8104', 'Vqi2ms']))).toEqual(['yiqtol 2ms', 'yiqtol 3fs']);
    expect(keys(item('אֶשְׁמֹר', ['8104', 'Vqi1cs']))).toEqual(['yiqtol 1cs']);
  });

  it('pairs a 2fp with a 3fp', () => {
    expect(keys(item('וַתִּשְׁמֹרְנָה', ['8104', 'C/Vqw3fp']))).toEqual(['wayyiqtol 3fp', 'wayyiqtol 2fp']);
  });

  it('lets a qatal behind a ו be a weqatal, and a weqatal a qatal', () => {
    expect(keys(item('וְשָׁמַר', ['8104', 'C/Vqp3ms']))).toEqual(['qatal 3ms', 'weqatal 3ms']);
    expect(keys(item('שָׁמַר', ['8104', 'Vqp3ms']))).toEqual(['qatal 3ms']);
    expect(keys(item('וְשָׁמַר', ['8104', 'C/Vqq3ms']))).toEqual(['weqatal 3ms', 'qatal 3ms']);
  });

  it('adds nothing for a participle or infinitive', () => {
    expect(keys(item('שֹׁמֵר', ['8104', 'Vqrmsa']))).toHaveLength(1);
  });
});

describe('gradeParse', () => {
  const wayyomer = item('וַיֹּאמֶר', ['559', 'C/Vqw3ms']);
  const right = answer({
    stem: 'qal',
    conjugation: 'wayyiqtol',
    person: '3',
    gender: 'm',
    number: 's',
    root: 'אמר',
  });

  it('passes a right parse, root included', () => {
    const g = gradeParse(wayyomer, right, LEMMAS, true);
    expect(g).toMatchObject({ allCorrect: true, alsoAccepted: false, root: true, person: true });
  });

  it('marks each wrong field and names the reading it was graded against', () => {
    const g = gradeParse(wayyomer, { ...right, stem: 'hiphil', number: 'p' }, LEMMAS, true);
    expect(g).toMatchObject({ allCorrect: false, stem: false, number: false, conjugation: true });
    expect(describeReading(g.reading)).toBe('Qal Wayyiqtol 3rd Masculine Singular');
  });

  it('leaves the root out when it is not asked', () => {
    const g = gradeParse(wayyomer, { ...right, root: '' }, LEMMAS, false);
    expect(g.allCorrect).toBe(true);
    expect(g.root).toBeUndefined();
  });

  it('accepts a root typed without its dot or as the headword, with or without finals', () => {
    const yashav = item('יָשַׁב', ['3427', 'Vqp3ms']);
    const base = answer({
      stem: 'qal',
      conjugation: 'qatal',
      person: '3',
      gender: 'm',
      number: 's',
    });
    expect(gradeParse(yashav, { ...base, root: 'ישב' }, LEMMAS, true).root).toBe(true);
    expect(rootKeys(LEMMAS[1961])).toEqual(['היה']);
    expect(rootKeys(undefined)).toEqual([]);
  });

  it('accepts what the shape allows, and says so', () => {
    const tokhal = item('תֹּאכַל', ['398', 'Vqi2ms']);
    const g = gradeParse(
      tokhal,
      answer({ stem: 'qal', conjugation: 'yiqtol', person: '3', gender: 'f', number: 's' }),
      LEMMAS,
      false,
    );
    expect(g).toMatchObject({ allCorrect: true, alsoAccepted: true });
  });

  it('grades a wrong conjugation against the closest reading, field by field', () => {
    const g = gradeParse(
      wayyomer,
      answer({ stem: 'qal', conjugation: 'participle', gender: 'm', number: 's', state: 'a' }),
      LEMMAS,
      false,
    );
    expect(g).toMatchObject({ conjugation: false, person: false, gender: true, number: true });
    expect(g.state).toBeUndefined();
  });
});

describe('the attempt log', () => {
  it('files an answer under its stem and conjugation, hyphenated', () => {
    expect(parseVerbConcept({ stem: 'qal', conjugation: 'wayyiqtol' })).toBe(
      'parse/verb/qal-wayyiqtol',
    );
    expect(parseVerbConcept({ stem: 'niphal', conjugation: 'infinitive construct' })).toBe(
      'parse/verb/niphal-infinitive-construct',
    );
  });
});

describe('sessions', () => {
  const pool = [
    item('אָמַר', ['559', 'Vqp3ms']),
    item('יֹאמַר', ['559', 'Vqi3ms']),
    item('הִשְׁמִיר', ['8104', 'Vhp3ms']),
    item('שֹׁמֵר', ['8104', 'Vqrmsa']),
  ];

  it('asks Qal qatal, yiqtol and wayyiqtol by default', () => {
    expect(eligibleItems(pool, DEFAULT_PARSE_SETTINGS).map((i) => i.form)).toEqual(['אָמַר', 'יֹאמַר']);
  });

  it('draws up to the session length from what the settings allow', () => {
    const settings = {
      ...DEFAULT_PARSE_SETTINGS,
      stems: [...STEM_NAMES],
      conjugations: Object.keys(CONJUGATION_NAMES) as never,
      sessionLength: 10 as const,
    };
    expect(buildSession(pool, settings, () => 0)).toHaveLength(4);
    expect(buildSession(pool, { ...DEFAULT_PARSE_SETTINGS, stems: [] })).toEqual([]);
  });
});
