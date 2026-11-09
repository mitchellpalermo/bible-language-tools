import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type PassageRange, versesInRange } from '@tools/shared/focus-passages';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HebrewBook, HebrewWord, LemmaIndex } from '../data/morphhb';
import { newCard, nextSRS, normalizeKey } from '../data/srs';
import { cardKey, type HebrewVocabWord, vocabulary } from '../data/vocabulary';
import { hasCorpus } from '../test/corpus';
import {
  focusPassageStore,
  passageDeckKeys,
  passageProgress,
  passageVocabulary,
  passageWordKey,
} from './focus-passages';

const word = (lemma: string, text = 'x'): HebrewWord => ({
  text,
  lemma,
  pos: 'Nc',
  parsing: 'HNcmsa',
});

const verses = (...lists: HebrewWord[][]) =>
  lists.map((words, i) => ({ chapter: 1, verse: i + 1, words }));

const entry = (over: Partial<HebrewVocabWord>): HebrewVocabWord => ({
  hebrew: 'אָב',
  gloss: 'father',
  partOfSpeech: 'noun',
  ...over,
});

describe('passageVocabulary', () => {
  const VOCAB = [
    entry({ hebrew: 'אָב', strong: '1', frequency: 1200 }),
    entry({ hebrew: 'אָמַר', strong: '559', gloss: 'he said', frequency: 5300 }),
    // An inflected form of the same lexeme: no frequency, so not the primary entry.
    entry({ hebrew: 'וַיֹּאמֶר', strong: '559', gloss: 'and he said' }),
    entry({ hebrew: 'בַּיִת', strong: '1004a', gloss: 'house', frequency: 2000 }),
  ];

  it('lists the course words the passage uses, commonest first, with their counts', () => {
    const v = passageVocabulary(
      verses([word('559'), word('1'), word('1004a')], [word('1'), word('559'), word('1')]),
      null,
      VOCAB,
    );
    expect(v.words.map((w) => [w.word.hebrew, w.occurrences])).toEqual([
      ['אָב', 3],
      ['אָמַר', 2],
      ['בַּיִת', 1],
    ]);
    expect(v.runningWords).toBe(6);
  });

  it('keeps ties in the order the words first appear', () => {
    const v = passageVocabulary(verses([word('1004a'), word('1'), word('559')]), null, VOCAB);
    expect(v.words.map((w) => w.lemma)).toEqual(['1004', '1', '559']);
  });

  it('counts a BDB sense split as one lexeme, as the reader does', () => {
    const v = passageVocabulary(verses([word('1004a'), word('1004b'), word('1004')]), null, VOCAB);
    expect(v.words).toHaveLength(1);
    expect(v.words[0].occurrences).toBe(3);
  });

  it('stands one entry for a lexeme the vocabulary lists twice, and keeps every card of it', () => {
    const v = passageVocabulary(verses([word('559')]), null, VOCAB);
    expect(v.words[0].word.hebrew).toBe('אָמַר');
    expect(v.words[0].keys).toEqual(['אָמַר', 'וַיֹּאמֶר']);
    expect(passageDeckKeys(v)).toEqual(['אָמַר']);
  });

  it('falls back to the first entry when none of them carries a frequency', () => {
    const v = passageVocabulary(verses([word('559')]), null, [
      VOCAB[2],
      entry({ hebrew: 'יֹאמַר', strong: '559' }),
    ]);
    expect(v.words[0].word.hebrew).toBe('וַיֹּאמֶר');
  });

  it('lists lexemes the vocabulary lacks as outside, commonest first, and skips prefix codes', () => {
    const v = passageVocabulary(
      verses([word('853'), word('776'), word('853'), word('l'), word('c')]),
      null,
      VOCAB,
    );
    expect(v.outside).toEqual([
      { lemma: '853', occurrences: 2 },
      { lemma: '776', occurrences: 1 },
    ]);
    expect(v.words).toEqual([]);
    expect(v.runningWords).toBe(5);
  });

  it('keeps the full lemma key of an outside lexeme, for the lemma index', () => {
    expect(passageVocabulary(verses([word('7363b')]), null, VOCAB).outside[0].lemma).toBe('7363b');
  });

  it('is empty for a passage with no words', () => {
    expect(passageVocabulary([], null, VOCAB)).toEqual({ words: [], outside: [], runningWords: 0 });
  });

  describe('an entry with no strong number', () => {
    const LEMMAS: LemmaIndex = {
      '776': { count: 2500, hebrew: 'אֶרֶץ' },
      '1004a': { count: 1, hebrew: 'בַּיִת' },
      '1004b': { count: 1, hebrew: 'בַּיִת' },
      '1': { count: 1, hebrew: 'אָב' },
      // Two lexemes spelled alike: no safe answer.
      '100': { count: 1, hebrew: 'אַף' },
      '200': { count: 1, hebrew: 'אַף' },
      // A prefix code is not a lexeme to match by form.
      l: { count: 1, hebrew: 'לְ' },
    };
    const NO_STRONG = [
      entry({ hebrew: 'אֶרֶץ', gloss: 'earth', frequency: 2500 }),
      entry({ hebrew: 'אַף', gloss: 'also' }),
      entry({ hebrew: 'לְ', gloss: 'to' }),
      entry({ hebrew: 'בַּ֖יִת', gloss: 'house' }),
    ];

    it('is found by its pointed form when that names one lexeme', () => {
      const v = passageVocabulary(verses([word('776'), word('776')]), LEMMAS, NO_STRONG);
      expect(v.words.map((w) => [w.word.gloss, w.occurrences])).toEqual([['earth', 2]]);
    });

    it('is found through a sense split and despite cantillation on the entry', () => {
      const v = passageVocabulary(verses([word('1004a'), word('1004b')]), LEMMAS, NO_STRONG);
      expect(v.words.map((w) => w.word.gloss)).toEqual(['house']);
    });

    it('is left outside when two lexemes share its form in near equal measure', () => {
      const v = passageVocabulary(verses([word('100'), word('200')]), LEMMAS, NO_STRONG);
      expect(v.words).toEqual([]);
      expect(v.outside).toHaveLength(2);
    });

    it('goes to the lexeme that dominates its form, not to the namesakes', () => {
      const lemmas: LemmaIndex = {
        '4428': { count: 2500, hebrew: 'מֶלֶךְ' },
        '4429': { count: 4, hebrew: 'מֶלֶךְ' },
        '4430': { count: 3, hebrew: 'מֶלֶךְ' },
      };
      const king = [entry({ hebrew: 'מֶלֶךְ', gloss: 'king' })];
      const v = passageVocabulary(verses([word('4428'), word('4429')]), lemmas, king);
      // The namesake stays outside the course vocabulary, where it belongs.
      expect(v.words.map((w) => [w.lemma, w.word.gloss])).toEqual([['4428', 'king']]);
      expect(v.outside).toEqual([{ lemma: '4429', occurrences: 1 }]);
    });

    it('is not matched to a prefix code', () => {
      expect(passageVocabulary(verses([word('l')]), LEMMAS, NO_STRONG).words).toEqual([]);
    });

    it('is not found without the lemma index', () => {
      expect(passageVocabulary(verses([word('776')]), null, NO_STRONG).words).toEqual([]);
      expect(passageVocabulary(verses([word('776')]), undefined, NO_STRONG).words).toEqual([]);
    });

    it('does not override an entry that has a strong number', () => {
      const both = [...VOCAB, ...NO_STRONG];
      const v = passageVocabulary(verses([word('1')]), LEMMAS, both);
      expect(v.words[0].word.hebrew).toBe('אָב');
    });
  });
});

describe('passageProgress', () => {
  const VOCAB = [
    entry({ hebrew: 'אָב', strong: '1', frequency: 1 }),
    entry({ hebrew: 'אָמַר', strong: '559', frequency: 1 }),
    entry({ hebrew: 'וַיֹּאמֶר', strong: '559' }),
    entry({ hebrew: 'בַּיִת', strong: '1004', frequency: 1 }),
  ];
  // father ×4, said ×2, house ×1, one word outside the course.
  const v = passageVocabulary(
    verses(
      [word('1'), word('1'), word('1'), word('1')],
      [word('559'), word('559'), word('1004')],
      [word('853')],
    ),
    null,
    VOCAB,
  );

  const reviewed = (key: string, grade: 'good' | 'again' = 'good') =>
    nextSRS(newCard(key), grade === 'good' ? 4 : 1);

  it('has nothing known before any review', () => {
    expect(passageProgress(v, {})).toEqual({
      words: { mature: 0, familiar: 0, learning: 0, unseen: 3 },
      due: 0,
      known: 0,
    });
  });

  it('weights what is known by how often the passage uses it', () => {
    const progress = passageProgress(v, { [normalizeKey('אָב')]: reviewed('אָב') });
    // Four of the eight running words are אָב.
    expect(progress.known).toBeCloseTo(4 / 8);
    expect(progress.words.learning).toBe(1);
    expect(progress.words.unseen).toBe(2);
  });

  it('counts a lexeme as known when any card of it has been answered, even an inflected one', () => {
    const progress = passageProgress(v, { וַיֹּאמֶר: reviewed('וַיֹּאמֶר') });
    expect(progress.known).toBeCloseTo(2 / 8);
  });

  it('does not count a card that was only ever failed', () => {
    expect(passageProgress(v, { אָב: reviewed('אָב', 'again') }).known).toBe(0);
  });

  it('counts a due card, and not one reviewed today', () => {
    const due = { ...newCard('אָמַר'), dueDate: '2000-01-01' };
    expect(passageProgress(v, { אָמַר: due, אָב: reviewed('אָב') }).due).toBe(1);
  });

  it('is zero for an empty passage', () => {
    expect(passageProgress(passageVocabulary([], null, VOCAB), {}).known).toBe(0);
  });
});

describe('the passage store', () => {
  beforeEach(() => localStorage.clear());

  it('is bound to this app’s own key', () => {
    focusPassageStore.create({
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 5,
    });
    expect(localStorage.getItem('hebrew-tools-focus-passages-v1')).not.toBeNull();
  });

  it('keys a word the way the flashcards do', () => {
    const w = vocabulary[0];
    expect(passageWordKey(w)).toBe(normalizeKey(cardKey(w)));
  });
});

// ─── Against the corpus ──────────────────────────────────────────────────────
//
// What the vocabulary join does with real text. Guarded like every corpus check:
// it skips until `pnpm build:data` has run, and in CI `corpus.test.ts` fails the
// run if the corpus is missing, so this cannot quietly turn into a skip there.

const DATA = join(import.meta.dirname, '..', '..', 'public', 'data', 'morphhb');
const read = <T>(file: string) => JSON.parse(readFileSync(join(DATA, file), 'utf8')) as T;

const PASSAGES: Array<[string, PassageRange]> = [
  ['Genesis 1:1–5', { book: 'GEN', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 5 }],
  ['Genesis 1:1–2:3', { book: 'GEN', startChapter: 1, startVerse: 1, endChapter: 2, endVerse: 3 }],
  ['Psalm 23', { book: 'PSA', startChapter: 23, startVerse: 1, endChapter: 23, endVerse: 6 }],
  ['Ruth 1', { book: 'RUT', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 22 }],
  ['Isaiah 53', { book: 'ISA', startChapter: 52, startVerse: 13, endChapter: 53, endVerse: 12 }],
  [
    'Daniel 2:4–7 (Aramaic)',
    { book: 'DAN', startChapter: 2, startVerse: 4, endChapter: 2, endVerse: 7 },
  ],
];

describe.skipIf(!hasCorpus)('passage vocabulary against the corpus', () => {
  const lemmas = hasCorpus ? read<LemmaIndex>('lemmas.json') : {};
  const passage = (range: PassageRange) =>
    versesInRange(read<HebrewBook>(`${range.book}.json`), range);
  const byKey = new Map(vocabulary.map((w) => [passageWordKey(w), w]));

  it.each(
    PASSAGES,
  )('%s: every lexeme is real, counted once, and no more often than the text has it', (_name, range) => {
    const v = passageVocabulary(passage(range), lemmas);
    expect(v.runningWords).toBeGreaterThan(0);

    for (const { lemma, occurrences, word: w } of v.words) {
      // The join lands on a lexeme the corpus has, with room for every occurrence counted.
      const total = Object.entries(lemmas)
        .filter(
          ([key]) =>
            key === lemma || (key.startsWith(lemma) && /^[a-z]$/.test(key.slice(lemma.length))),
        )
        .reduce((sum, [, entry]) => sum + entry.count, 0);
      expect(total, `${w.hebrew} (${lemma})`).toBeGreaterThanOrEqual(occurrences);
    }
    for (const { lemma, occurrences } of v.outside) {
      expect(lemmas[lemma], `outside lexeme ${lemma}`).toBeDefined();
      expect(occurrences).toBeGreaterThan(0);
    }

    // Every word is in the vocabulary, or outside it, or a prefix code. Nothing twice, nothing lost.
    const lexemes = [
      ...v.words.map((w) => w.lemma),
      ...v.outside.map((o) => o.lemma.replace(/[a-z]$/, '')),
    ];
    expect(new Set(lexemes).size).toBe(lexemes.length);
    const counted =
      v.words.reduce((n, w) => n + w.occurrences, 0) +
      v.outside.reduce((n, o) => n + o.occurrences, 0);
    expect(counted).toBeLessThanOrEqual(v.runningWords);
    expect(counted).toBeGreaterThan(v.runningWords * 0.8);
  });

  it.each(PASSAGES)('%s: every deck key is a card the flashcards deal', (_name, range) => {
    const keys = passageDeckKeys(passageVocabulary(passage(range), lemmas));
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(byKey.has(key), key).toBe(true);
  });

  it('reads Genesis 1:1–5 the way a teacher would', () => {
    const v = passageVocabulary(passage(PASSAGES[0][1]), lemmas);
    const glosses = v.words.map((w) => w.word.hebrew);
    expect(v.runningWords).toBe(52);
    // The commonest word in the passage is God, six times; "light" and "was" follow.
    expect(glosses.slice(0, 3)).toEqual(['אֱלֹהִים', 'הָיָה', 'אוֹר']);
    expect(v.words[0].occurrences).toBe(6);
    // "earth" is a curated entry with no Strong's number: it is found by its form.
    expect(glosses).toContain('אֶרֶץ');
  });

  it('finds the curated entries that carry no Strong number, where the text uses them', () => {
    const range: PassageRange = {
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 15,
      endVerse: 21,
    };
    const found = passageVocabulary(passage(range), lemmas).words.map((w) => w.word.hebrew);
    for (const form of ['אֶרֶץ', 'אָדָם', 'דָּבָר', 'מֶלֶךְ', 'עֶבֶד', 'אֵשׁ'])
      expect(found, form).toContain(form);
  });

  it('never matches an entry without a Strong number to a lexeme with a different headword', () => {
    const range: PassageRange = {
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 11,
      endVerse: 32,
    };
    for (const { word: w, lemma } of passageVocabulary(passage(range), lemmas).words) {
      if (w.strong) continue;
      const lexemeForms = Object.entries(lemmas)
        .filter(([key]) => key.replace(/[a-z]$/, '') === lemma)
        .map(([, entry]) => entry.hebrew);
      expect(
        lexemeForms.map((f) => f?.normalize('NFC')),
        w.hebrew,
      ).toContain(w.hebrew.normalize('NFC'));
    }
  });
});
