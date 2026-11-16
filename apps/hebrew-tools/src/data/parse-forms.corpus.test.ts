// Every form /parse can ask, checked against the built pool (#82).
//
// The pool is built from the corpus, so it is gitignored and this suite skips
// without it, like the other corpus checks; CI builds it before the tests (see
// "The corpus gate"). What it guards: a reading the drill cannot read would be
// dropped silently by `decodeParseForms`, and a form with a field missing would
// be ungradable. Either would look like a working page.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PARSE_STEM_LETTERS } from '../../scripts/lib/parse-forms.mjs';
import { analyzeMorph } from '../lib/morph-parse';
import {
  CONJUGATION_NAMES,
  DEFAULT_PARSE_SETTINGS,
  eligibleItems,
  fieldsFor,
  GENDER_LABELS,
  NUMBER_LABELS,
  PERSON_LABELS,
  readVerbMorph,
  rootKeys,
  STATE_LABELS,
  STEM_LABELS,
  STEM_LETTERS,
} from '../lib/verb-parse';
import { hasCorpus } from '../test/corpus';
import { decodeParseForms, type ParseFormsFile } from './parse-forms';

const FILE = join(__dirname, '../../public/data/morphhb/parse-forms.json');

const CHOICES: Record<string, Record<string, string>> = {
  stem: STEM_LABELS,
  conjugation: CONJUGATION_NAMES,
  person: PERSON_LABELS,
  gender: GENDER_LABELS,
  number: NUMBER_LABELS,
  state: STATE_LABELS,
};

describe('the stem letters', () => {
  it('are the same in the build script and the app', () => {
    expect(STEM_LETTERS).toEqual(PARSE_STEM_LETTERS);
  });
});

// Not skipped when only this file is missing: `build:data` always writes it, so
// a corpus without it is a broken build.
describe.skipIf(!hasCorpus)('every form /parse can ask', () => {
  const file = (
    hasCorpus ? JSON.parse(readFileSync(FILE, 'utf8')) : { lemmas: {}, forms: [] }
  ) as ParseFormsFile;
  const pool = decodeParseForms(file);

  it('reads every reading, so none is dropped', () => {
    const unreadable = file.forms.flatMap(([form, readings]) =>
      readings
        .filter(([lemma, morph]) => !readVerbMorph(lemma, morph))
        .map((r) => `${form} ${r[1]}`),
    );
    expect(unreadable).toEqual([]);
    expect(pool.items).toHaveLength(file.forms.length);
  });

  it('has an answer among the choices for every field each reading asks', () => {
    const gaps: string[] = [];
    for (const item of pool.items) {
      for (const r of item.readings) {
        for (const key of fieldsFor(r.conjugation)) {
          const value = r[key];
          if (!value || !(value in CHOICES[key])) gaps.push(`${item.form} ${r.morph} ${key}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it('names each stem as the reader does', () => {
    const disagree = pool.items
      .flatMap((i) => i.readings)
      .filter(
        (r) => analyzeMorph(r.morph.split('/').at(-1) as string)?.stem !== STEM_LABELS[r.stem],
      );
    expect(disagree).toEqual([]);
  });

  it('can grade the root of every reading', () => {
    const rootless = pool.items
      .flatMap((i) => i.readings)
      .filter((r) => rootKeys(pool.lemmas[r.lemma]).length === 0);
    expect(rootless).toEqual([]);
  });

  it('has forms for the default settings, and for every stem', () => {
    expect(eligibleItems(pool.items, DEFAULT_PARSE_SETTINGS).length).toBeGreaterThan(1000);
    for (const stem of Object.keys(STEM_LABELS)) {
      expect(pool.items.some((i) => i.readings[0].stem === stem)).toBe(true);
    }
  });

  it('holds no jussive or cohortative reading, so neither is asked or logged', () => {
    const volitive = file.forms.flatMap(([form, readings]) =>
      readings
        .filter(([, morph]) => 'hj'.includes(morph.split('/').at(-1)?.[2] ?? ''))
        .map((r) => `${form} ${r[1]}`),
    );
    expect(volitive).toEqual([]);
  });

  it('keeps forms unaccented and NFC', () => {
    const odd = pool.items.filter((i) => i.form !== i.form.normalize('NFC') || /[֑-ֽ֯]/.test(i.form));
    expect(odd).toEqual([]);
  });
});
