import { describe, expect, it } from 'vitest';
import { corpusForms, hasCorpus, isAttested, plainForm, spirantized } from './corpus';

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
