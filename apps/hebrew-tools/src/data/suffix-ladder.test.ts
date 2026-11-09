import { describe, expect, it } from 'vitest';
import { hasCorpus, isAttested } from '../test/corpus';
import { personalPronouns } from './grammar-pronominal';
import { allSuffixParadigms, BARE_SUFFIXES, SUFFIX_PGNS } from './pronominal-suffixes';
import {
  BARE_COLUMNS,
  LADDER_RUNG_IDS,
  ladderRungs,
  PREPOSITION_COLUMNS,
  PRONOUN_COLUMN,
} from './suffix-ladder';

const FORM_CHARS = /^[א-תְ-ּׁׂ]+$/;

/** Regular forms the text does not use. A new entry is what a typo looks like. */
const UNATTESTED = new Set(['suffix-prep-le:2fp', 'suffix-prep-el:2fp']);

describe('ladderRungs', () => {
  it('follows the issue’s eight rungs, in order, with stable ids', () => {
    expect(LADDER_RUNG_IDS).toEqual([
      'suffixes',
      'sus',
      'dabar',
      'feminine',
      'segholate',
      'geminate',
      'prepositions',
      'pronouns',
    ]);
  });

  it('gives every rung a column, every column all ten persons, and a note', () => {
    for (const rung of ladderRungs) {
      expect(rung.columns.length, rung.id).toBeGreaterThan(0);
      expect(rung.notes.length, rung.id).toBeGreaterThan(0);
      for (const note of rung.notes) expect(note, rung.id).not.toBe('');
      for (const column of rung.columns) {
        expect(Object.keys(column.forms).sort(), column.id).toEqual([...SUFFIX_PGNS].sort());
        for (const form of Object.values(column.forms)) expect(form, column.id).not.toBe('');
      }
    }
  });

  it('builds noun rungs from the suffix paradigms, never a copy of them', () => {
    const nouns = new Map(allSuffixParadigms.map((p) => [p.id, p]));
    const nounColumns = ladderRungs.flatMap((r) => r.columns).filter((c) => nouns.has(c.id));
    expect(nounColumns.length).toBe(allSuffixParadigms.length);
    for (const column of nounColumns) expect(column.forms).toBe(nouns.get(column.id)?.forms);
  });

  it('puts the bare suffixes on the first rung and beside the pronouns on the last', () => {
    expect(ladderRungs[0].columns).toEqual([BARE_COLUMNS.type1, BARE_COLUMNS.type2]);
    expect(ladderRungs.at(-1)?.columns).toEqual([
      PRONOUN_COLUMN,
      BARE_COLUMNS.type1,
      BARE_COLUMNS.type2,
    ]);
    expect(BARE_COLUMNS.type2.forms).toBe(BARE_SUFFIXES.type2);
  });

  it('asks for each pronoun’s everyday form, from the grammar page’s list', () => {
    expect(PRONOUN_COLUMN.forms['1cs']).toBe('אֲנִי');
    expect(PRONOUN_COLUMN.forms['3mp']).toBe('הֵם');
    for (const pgn of SUFFIX_PGNS) {
      expect(
        personalPronouns.some((p) => p.pgn === pgn && p.hebrew === PRONOUN_COLUMN.forms[pgn]),
      ).toBe(true);
    }
  });

  it('stores the prepositions and pronouns in NFC, letters and points only', () => {
    for (const column of [...PREPOSITION_COLUMNS, PRONOUN_COLUMN]) {
      for (const [pgn, form] of Object.entries(column.forms)) {
        expect(form, `${column.id} ${pgn}`).toBe(form.normalize('NFC'));
        expect(form, `${column.id} ${pgn}`).toMatch(FORM_CHARS);
      }
    }
  });

  it('gives אֶל the Type 2 yod in every person and לְ none past the 1cs', () => {
    const [le, el] = PREPOSITION_COLUMNS;
    for (const pgn of SUFFIX_PGNS) {
      expect(el.forms[pgn], pgn).toContain('י');
      if (pgn !== '1cs') expect(le.forms[pgn], pgn).not.toContain('י');
    }
  });

  it.skipIf(!hasCorpus)('attests every preposition and pronoun the Bible uses', () => {
    for (const column of [...PREPOSITION_COLUMNS, PRONOUN_COLUMN]) {
      for (const [pgn, form] of Object.entries(column.forms)) {
        if (UNATTESTED.has(`${column.id}:${pgn}`)) continue;
        expect(isAttested(form), `${column.id} ${pgn} ${form}`).toBe(true);
      }
    }
  });
});
