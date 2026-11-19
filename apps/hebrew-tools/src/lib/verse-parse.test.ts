import { describe, expect, it } from 'vitest';
import { poolVerbCode, rootOf } from '../../scripts/lib/parse-forms.mjs';
import type { HebrewWord, LemmaEntry } from '../data/morphhb';
import { isAskableVerb, parseFormOf, parseLemmaOf, verseLemmas, verseVerbs } from './verse-parse';

const word = (text: string, lemma: string, parsing: string, extra: Partial<HebrewWord> = {}) =>
  ({ text, lemma, pos: parsing.slice(1, 3), parsing, ...extra }) as HebrewWord;

// One of each kind of word the rule has to decide.
const WORDS: Record<string, HebrewWord> = {
  noun: word('אֱלֹהִ֑ים', '430', 'HNcmpa'),
  qatal: word('בָּרָ֣א', '1254a', 'HVqp3ms'),
  wayyiqtol: word('וַ/יֹּ֣אמֶר', '559', 'HC/Vqw3ms'),
  suffixed: word('יִשְׁמְרֶ֑/ךָ', '8104', 'HVqi3ms/Sp2ms'),
  paragogic: word('נֵלְכָ/ה', '1980', 'HVqh1cp/Sh'),
  jussive: word('יְהִ֣י', '1961', 'HVqj3ms'),
  ketiv: word('ישבו', '3427', 'HVqp3cp', { ketiv: true, qere: 'יָשְׁב֣וּ' }),
  qereOnly: word('יָבֹ֔א', '935', 'HVqi3ms', { qereOnly: true }),
  aramaic: word('אֲמַ֣ר', '560', 'AVqp3ms'),
  polel: word('קוֹמֵ֣ם', '6965', 'HVoi3ms'),
  bare: word('V', '1', 'HV'),
};

describe('isAskableVerb', () => {
  it('agrees with the build’s pool rule on every kind of word', () => {
    for (const [name, w] of Object.entries(WORDS)) {
      expect([name, isAskableVerb(w)]).toEqual([name, poolVerbCode(w) !== null]);
    }
  });

  it('takes a verb with prefixes and nothing after it, in the seven stems', () => {
    const askable = Object.entries(WORDS)
      .filter(([, w]) => isAskableVerb(w))
      .map(([name]) => name);
    expect(askable).toEqual(['qatal', 'wayyiqtol', 'jussive']);
  });
});

describe('verseVerbs', () => {
  it('asks the verse’s verbs in text order, each where it sits, with the verse’s reading', () => {
    const verse = [WORDS.wayyiqtol, WORDS.noun, WORDS.qatal, WORDS.suffixed];
    const items = verseVerbs(verse);
    expect(items.map((i) => [i.form, i.wordIndex])).toEqual([
      ['וַיֹּאמֶר', 0],
      ['בָּרָא', 2],
    ]);
    expect(items[0].readings).toEqual([expect.objectContaining({ conjugation: 'wayyiqtol' })]);
  });

  it('leaves out a jussive, which the drill does not ask', () => {
    expect(verseVerbs([WORDS.jussive])).toEqual([]);
  });

  it('shows the form as the pool does: unaccented, NFC, no morpheme marks', () => {
    expect(parseFormOf(WORDS.wayyiqtol)).toBe('וַיֹּאמֶר'.normalize('NFC'));
    expect(parseFormOf(WORDS.wayyiqtol)).not.toMatch(/[\\u0591-\\u05AF/]/);
  });
});

describe('the lemma table', () => {
  const entries: Record<string, LemmaEntry> = {
    rooted: { count: 1, hebrew: 'אָמַר', root: 'אמר' },
    rootless: { count: 1, hebrew: 'הָיָה' },
    shin: { count: 1, hebrew: 'שָׁמַר' },
    nothing: { count: 1 },
  };

  it('takes the root as the build does, the headword’s consonants when the lexicon has none', () => {
    for (const entry of Object.values(entries)) {
      expect(parseLemmaOf(entry)?.root).toBe(rootOf(entry));
    }
    expect(parseLemmaOf(entries.shin)?.root).toBe('שׁמר');
    expect(parseLemmaOf(undefined)).toBeUndefined();
  });

  it('holds only the lemmas the verse’s verbs need, and skips one the index lacks', () => {
    const items = verseVerbs([WORDS.wayyiqtol, WORDS.qatal]);
    expect(verseLemmas(items, { 559: entries.rooted })).toEqual({
      559: { headword: 'אָמַר', root: 'אמר' },
    });
  });
});
