// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bareLetters, corpusWords, hasCorpus, plainForm } from './corpus';

// Every corpus check is wrapped in `skipIf(!hasCorpus)`, which is right on a
// laptop and dangerous in CI: drop the build step from the workflow and the
// checks do not fail, they vanish. This is the one test that notices.
describe.runIf(process.env.CI)('in CI', () => {
  it('has the corpus, so the checks against it are running', () => {
    expect(hasCorpus).toBe(true);
  });
});

describe('plainForm and bareLetters', () => {
  it('drops the punctuation MorphGNT keeps on a word', () => {
    expect(plainForm('λόγος,')).toBe('λόγος');
    expect(plainForm('θεός.')).toBe('θεός');
  });

  it('reads a grave accent as the acute the paradigm gives', () => {
    expect(plainForm('τὸν')).toBe('τόν');
    expect(plainForm('ἀγαθοὶ')).toBe('ἀγαθοί');
    expect(plainForm('αὐτὴ')).toBe('αὐτή');
  });

  it('leaves breathings and iota subscripts alone', () => {
    expect(plainForm('ἡμέρᾳ')).toBe('ἡμέρᾳ');
  });

  it('bareLetters drops every mark and the capital', () => {
    expect(bareLetters('Ἐλύσαμεν')).toBe('ελυσαμεν');
  });
});

describe.skipIf(!hasCorpus)('corpusWords', () => {
  it('reads the whole New Testament, with its parse', () => {
    const words = corpusWords();
    expect(words.length).toBeGreaterThan(130_000);
    const logos = words.find((w) => w.form === 'λόγος' && w.lemma === 'λόγος');
    expect(logos?.parsing).toBe('----NSM-');
  });

  it('is read once', () => {
    expect(corpusWords()).toBe(corpusWords());
  });
});
