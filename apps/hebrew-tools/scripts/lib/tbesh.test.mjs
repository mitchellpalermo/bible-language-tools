import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { checkPins, parseTbesh, tbeshGloss, tbeshId } from './tbesh.mjs';

// Real TBESH lines, cut to the eight columns: eStrong, dStrong, uStrong,
// Hebrew, transliteration, morph, gloss, meaning. The header is the file's own
// shape — a licence block and field notes before the data.
const TBESH = [
  'TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY',
  '\tData created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0)',
  'eStrong#\tThese Extended Strong Numbers are mapped to BDB by OpenScriptures.org.',
  'H0430\tH0430G = a Name of\tH3068G\tאֱלֹהִים\te.lo.him\tH:N-M\tGod\tThis name means "gods"',
  'H0430\tH0430H = a Part of\tH3068G\tאֱלֹהִים\te.lo.him\tH:N-M\t(LORD)-Elohe\tCombined with',
  'H0571\tH0571G =\tH0571G\tאֱמֶת\te.met\tH:N-F\ttruth: faithful\tfirmness, faithfulness',
  'H0571\tH0571H = a Meaning of\tH0571G\tאֱמֶת\te.met\tH:N-F\ttruth: true\t',
  'H0571\tH0571I = a Meaning of\tH0571G\tאֱמֶת\te.met\tH:N-F\ttruth: faithful\t',
  'H0413\tH0413 =\tH0413\tאֵל\tel\tH:Prep\tto(wards)\tdenotes motion to',
  'H1961\tH1961 =\tH1961\tהָיָה\tha.yah\tH:V\tto be\tto be, become',
  'H2896a\tH2896A =\tH2896A\tטוֹב\ttov\tH:A\tpleasant\tgood, pleasant',
  'H2896b\tH2896B =\tH2896B\tטוֹב\ttov\tH:N-M\tgood\ta good thing',
  'H5769\tH5769G =\tH5769G\tעוֹלָם\to.lam\tH:N-M\tforever: enduring\tlong duration',
  'H9999\tH9999 =\tH9999\tx\tx\tH:N\t\tno gloss on this line',
].join('\n');

describe('tbeshId', () => {
  it('pads the number and keeps the suffix lowercase, as TBESH writes it', () => {
    expect(tbeshId('430')).toBe('H0430');
    expect(tbeshId('5921a')).toBe('H5921a');
    expect(tbeshId('3820a')).toBe('H3820a');
  });

  it('has no id for an inseparable prefix', () => {
    expect(tbeshId('l')).toBeUndefined();
  });
});

describe('parseTbesh', () => {
  const index = parseTbesh(TBESH);

  it('reads the gloss column, main sense first, past the licence and field notes', () => {
    expect(index.get('H0430')).toEqual(['God', '(LORD)-Elohe']);
    expect(index.get('H0571')).toEqual(['truth: faithful', 'truth: true']);
    expect(index.has('eStrong#')).toBe(false);
  });

  it('skips a line with no gloss', () => {
    expect(index.has('H9999')).toBe(false);
  });
});

describe('tbeshGloss', () => {
  const index = parseTbesh(TBESH);

  it('gives the main gloss', () => {
    expect(tbeshGloss(index, '571')).toBe('truth: faithful');
  });

  // Under bare H2896 sit three different words; matching anything but the
  // exact id mixes them, the same trap as joining BDB by bare Strong's number.
  it('matches the exact id and never falls back to the bare number', () => {
    expect(tbeshGloss(index, '2896a')).toBe('pleasant');
    expect(tbeshGloss(index, '2896b')).toBe('good');
    expect(tbeshGloss(index, '2896')).toBeNull();
    expect(tbeshGloss(index, '2896c')).toBeNull();
  });

  it('has nothing for a prefix', () => {
    expect(tbeshGloss(index, 'b')).toBeNull();
  });
});

describe('checkPins', () => {
  const index = parseTbesh(TBESH);

  it('passes a pin that records what TBESH says and shares its word', () => {
    const result = checkPins({ 430: { gloss: ['God', 'gods'], tbesh: 'God' } }, index);
    expect(result).toEqual({ missing: [], stale: [], differs: [] });
  });

  it('fails a pin that never consulted TBESH', () => {
    const { missing } = checkPins({ 430: { gloss: ['God'] } }, index);
    expect(missing).toEqual([{ key: '430', current: 'God' }]);
  });

  it('fails a pin checked against something TBESH no longer says', () => {
    const { stale } = checkPins({ 430: { gloss: ['God'], tbesh: 'gods' } }, index);
    expect(stale).toEqual([{ key: '430', recorded: 'gods', current: 'God' }]);
  });

  it('accepts a recorded null for a word TBESH has no entry for', () => {
    const { stale, differs } = checkPins({ 7777: { gloss: ['x'], tbesh: null } }, index);
    expect(stale).toEqual([]);
    expect(differs).toEqual([]);
  });

  it('lists a pin that shares no word with TBESH, without failing it', () => {
    const pins = { 5769: { gloss: ['long duration', 'futurity'], tbesh: 'forever: enduring' } };
    const { missing, stale, differs } = checkPins(pins, index);
    expect([missing, stale]).toEqual([[], []]);
    expect(differs).toEqual([
      { key: '5769', chosen: ['long duration', 'futurity'], current: 'forever: enduring' },
    ]);
  });

  it('reads TBESH’s parentheses both ways and keeps a gloss that is all small words', () => {
    // "to(wards)" is "towards"; "to be" is "be", not nothing.
    const pins = {
      413: { gloss: ['to', 'towards', 'into'], tbesh: 'to(wards)' },
      1961: { stems: { Qal: ['be', 'become'] }, tbesh: 'to be' },
    };
    expect(checkPins(pins, index).differs).toEqual([]);
  });
});

describe('scripts/data/bdb-pins.json', () => {
  const { pins } = JSON.parse(
    readFileSync(join(__dirname, '..', 'data', 'bdb-pins.json'), 'utf-8'),
  );

  // The step before any pin is a TBESH lookup, and `tbesh` is its record.
  // Whether the recorded value is still current needs the network and is
  // `pnpm check:pins`'s job; that it was recorded at all is checked here.
  it.each(Object.entries(pins))('pin %s records TBESH and a reason', (_key, pin) => {
    expect(pin).toHaveProperty('tbesh');
    expect(pin.tbesh === null || typeof pin.tbesh === 'string').toBe(true);
    expect(pin.why?.length).toBeGreaterThan(0);
    expect(pin.gloss ?? pin.stems).toBeDefined();
  });
});
