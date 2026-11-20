import { describe, expect, it } from 'vitest';
import { CONJUGATION_LABELS, type Conjugation } from '../data/verb-paradigms';
import {
  attestation,
  corpusForms,
  hasCorpus,
  isAttested,
  OSHB_CONJUGATION,
  plainForm,
  spirantized,
} from './corpus';

// Every corpus check is wrapped in `skipIf(!hasCorpus)`, which is right on a
// laptop and dangerous in CI: drop the build step from the workflow and the
// checks do not fail, they vanish. This is the one test that notices.
describe.runIf(process.env.CI)('in CI', () => {
  it('has the corpus, so the checks against it are running', () => {
    expect(hasCorpus).toBe(true);
  });
});

describe('plainForm and spirantized', () => {
  it('drops the stress mark', () => {
    expect(plainForm('מֶ֫לֶךְ')).toBe('מֶלֶךְ');
  });

  it('drops only a leading dagesh lene', () => {
    expect(spirantized('בָּנִ֫יתָ')).toBe('בָנִיתָ');
    expect(spirantized('דִּבְּרוּ')).toBe('דִבְּרוּ');
    expect(spirantized('הַמֶּלֶךְ')).toBe('הַמֶּלֶךְ');
  });
});

describe.skipIf(!hasCorpus)('isAttested', () => {
  it('finds a word, with or without its stress mark', () => {
    expect(corpusForms().has('מֶלֶךְ')).toBe(true);
    expect(isAttested('מֶ֫לֶךְ')).toBe(true);
  });

  it('finds a word whose dagesh lene the text happens to drop', () => {
    expect(isAttested('בָּנִ֫יתָ')).toBe(true);
  });

  it('treats a maqqef phrase as attested when each word is', () => {
    expect(isAttested('מִן־הָאָרֶץ')).toBe(true);
    expect(isAttested('מִן־הָאָרֶטט')).toBe(false);
  });

  it('rejects a form that is off by one vowel', () => {
    expect(isAttested('מֶלֶךְ')).toBe(true);
    expect(isAttested('מֶלַךְ')).toBe(false);
  });
});

describe('the OSHB mapping', () => {
  it('gives every conjugation the app has at least one OSHB letter', () => {
    for (const conjugation of Object.keys(CONJUGATION_LABELS) as Conjugation[]) {
      expect(OSHB_CONJUGATION[conjugation].length, conjugation).toBeGreaterThan(0);
    }
  });
});

describe.skipIf(!hasCorpus)('attestation, parse and all', () => {
  const qal = (conjugation: Conjugation, key: Parameters<typeof attestation>[1]['key']) => ({
    stem: 'qal' as const,
    conjugation,
    key,
  });

  it('attests a form in its own cell', () => {
    expect(attestation('תִּכְתֹּב', qal('yiqtol', '2ms'))).toBe('as-this-form');
    expect(attestation('כֹּתֵב', qal('participle-active', 'ms'))).toBe('as-this-form');
    expect(attestation('כָּתוֹב', qal('infinitive-absolute', 'inf'))).toBe('as-this-form');
  });

  it('catches a form typed into the wrong cell, which a spelling check passes', () => {
    // The 3mp in the 3ms cell: the spelling occurs, as something else.
    expect(isAttested('יִכְתְּבוּ')).toBe(true);
    expect(attestation('יִכְתְּבוּ', qal('yiqtol', '3ms'))).toBe('as-another-form');
    // A qatal spelling in the weqatal: right person, wrong conjugation.
    expect(attestation('כָּתַבְתָּ', qal('weqatal', '2ms'))).toBe('as-another-form');
  });

  it('keeps the leniency isAttested has: no stress mark, an optional dagesh lene', () => {
    expect(attestation('כָּתַ֫בְתָּ', qal('qatal', '2ms'))).toBe('as-this-form');
    expect(attestation('בָּנִ֫יתָ', qal('qatal', '2ms'))).toBe('as-this-form');
  });

  it('reads a wayyiqtol whole, never its verb without the waw', () => {
    expect(attestation('וַיִּכְתֹּב', qal('wayyiqtol', '3ms'))).toBe('as-this-form');
    // תִּבְנִי occurs only inside a wayyiqtol, so it attests no yiqtol.
    expect(attestation('תִּבְנִי', qal('yiqtol', '2fs'))).toBe('unattested');
  });

  it('says so when the text never has the spelling', () => {
    expect(attestation('כְּתַבְתֶּן', qal('qatal', '2fp'))).toBe('unattested');
  });
});
