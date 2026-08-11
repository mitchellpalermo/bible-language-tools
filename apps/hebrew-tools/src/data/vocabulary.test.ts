import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, TEXTBOOK_IDS } from './textbooks';
import { cardKey, type HebrewVocabWord, mergeVocabulary, vocabulary } from './vocabulary';
import { CORRECTIONS, EDITORIAL_NOTES, GARRETT_VOCABULARY } from './vocabulary-garrett';

// Hebrew consonants (U+05D0-05EA) + nikud (U+05B0-05C7) + shin/sin dots
// (U+05C1-U+05C2). Cantillation is intentionally excluded — vocabulary entries
// should never contain te'amim.
const VALID_HEBREW_CHARS = /^[א-תְ-ׂ]+$/;
const VALID_ROOT_CHARS = /^[א-ת]{3}$/;

const VALID_GENDERS = new Set(['m', 'f', 'fm']);

const VALID_POS = new Set([
  'noun',
  'proper noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'particle',
]);

describe('vocabulary data', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(vocabulary)).toBe(true);
    expect(vocabulary.length).toBeGreaterThan(0);
  });

  it('every entry has a non-empty hebrew field', () => {
    vocabulary.forEach((word) => {
      expect(word.hebrew.trim().length).toBeGreaterThan(0);
    });
  });

  it('every hebrew field contains only valid Hebrew consonants and points', () => {
    vocabulary.forEach((word) => {
      expect(VALID_HEBREW_CHARS.test(word.hebrew), `Invalid characters in: ${word.hebrew}`).toBe(
        true,
      );
    });
  });

  it('every root, when present, is exactly three Hebrew consonants', () => {
    vocabulary.forEach((word) => {
      if (word.root !== undefined) {
        expect(VALID_ROOT_CHARS.test(word.root), `Invalid root: ${word.root}`).toBe(true);
      }
    });
  });

  it('every transliteration, when present, is non-empty', () => {
    vocabulary.forEach((word) => {
      if (word.transliteration !== undefined) {
        expect(word.transliteration.trim().length).toBeGreaterThan(0);
      }
    });
  });

  it('every entry has a non-empty gloss field', () => {
    vocabulary.forEach((word) => {
      expect(word.gloss.trim().length).toBeGreaterThan(0);
    });
  });

  it('every frequency, when present, is positive', () => {
    vocabulary.forEach((word) => {
      if (word.frequency !== undefined) {
        expect(word.frequency).toBeGreaterThan(0);
      }
    });
  });

  it('contains only known parts of speech', () => {
    vocabulary.forEach((word) => {
      expect(VALID_POS.has(word.partOfSpeech), `Unknown POS: ${word.partOfSpeech}`).toBe(true);
    });
  });

  it('every verb has a binyan set', () => {
    vocabulary
      .filter((word) => word.partOfSpeech === 'verb')
      .forEach((word) => {
        expect(word.binyan, `Verb missing binyan: ${word.hebrew}`).toBeDefined();
      });
  });

  it('has no duplicate card keys', () => {
    const keys = vocabulary.map(cardKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only repeats a hebrew spelling when the entries carry distinct senses', () => {
    const byHebrew = new Map<string, HebrewVocabWord[]>();
    for (const word of vocabulary) {
      byHebrew.set(word.hebrew, [...(byHebrew.get(word.hebrew) ?? []), word]);
    }
    for (const [hebrew, words] of byHebrew) {
      if (words.length === 1) continue;
      const senses = words.map((w) => w.sense);
      expect(senses.every((s) => s !== undefined), `${hebrew} repeats without a sense`).toBe(true);
      expect(new Set(senses).size, `${hebrew} repeats a sense`).toBe(words.length);
    }
  });

  it('includes the definite article and waw conjunction', () => {
    const hebrewTerms = vocabulary.map((w) => w.hebrew);
    expect(hebrewTerms).toContain('הַ');
    expect(hebrewTerms).toContain('וְ');
  });

  it('includes core theological vocabulary', () => {
    const hebrewTerms = vocabulary.map((w) => w.hebrew);
    expect(hebrewTerms).toContain('אֱלֹהִים');
    expect(hebrewTerms).toContain('יְהוָה');
  });

  it('every gender, when present, is one of m / f / fm', () => {
    vocabulary.forEach((word) => {
      if (word.gender !== undefined) {
        expect(VALID_GENDERS.has(word.gender), `Unknown gender: ${word.gender}`).toBe(true);
      }
    });
  });

  it('never sets a gender on a verb', () => {
    vocabulary
      .filter((word) => word.partOfSpeech === 'verb')
      .forEach((word) => {
        expect(word.gender, `Verb has a gender: ${word.hebrew}`).toBeUndefined();
      });
  });

  it('every chapter tag names a known textbook, chapter and category', () => {
    vocabulary.forEach((word) => {
      (word.chapters ?? []).forEach((ref) => {
        expect(TEXTBOOK_IDS, `Unknown textbook on ${word.hebrew}`).toContain(ref.textbook);
        expect(ref.chapter, `Bad chapter on ${word.hebrew}`).toBeGreaterThan(0);
        expect(Number.isInteger(ref.chapter)).toBe(true);
        expect(CATEGORY_IDS, `Unknown category on ${word.hebrew}`).toContain(ref.category);
      });
    });
  });

  it('never tags the same word with the same chapter and category twice', () => {
    vocabulary.forEach((word) => {
      const keys = (word.chapters ?? []).map((c) => `${c.textbook}:${c.chapter}:${c.category}`);
      expect(new Set(keys).size, `Duplicate chapter tag on ${word.hebrew}`).toBe(keys.length);
    });
  });

  it('HebrewVocabWord shape has all required fields', () => {
    const word: HebrewVocabWord = vocabulary[0];
    expect(Object.keys(word)).toEqual(
      expect.arrayContaining(['hebrew', 'gloss', 'partOfSpeech']),
    );
  });

  it('every construct and plural form is valid pointed Hebrew', () => {
    vocabulary.forEach((word) => {
      for (const form of [word.construct, word.plural, ...(word.alternates ?? [])]) {
        if (form === undefined) continue;
        expect(VALID_HEBREW_CHARS.test(form), `Invalid form on ${word.hebrew}: ${form}`).toBe(true);
      }
    });
  });

  it('every verb stem entry names a stem and a gloss', () => {
    vocabulary.forEach((word) => {
      (word.stems ?? []).forEach((stem) => {
        expect(stem.stem.trim().length, `Empty stem on ${word.hebrew}`).toBeGreaterThan(0);
        expect(stem.gloss.trim().length, `Empty stem gloss on ${word.hebrew}`).toBeGreaterThan(0);
        if (stem.form !== undefined) {
          expect(VALID_HEBREW_CHARS.test(stem.form), `Bad stem form on ${word.hebrew}`).toBe(true);
        }
      });
    });
  });
});

// ─── The textbook import ──────────────────────────────────────────────────────

describe('Garrett & DeRouchie import', () => {
  it('brings in the whole handout, chapters 2 through 31', () => {
    const chapters = new Set(GARRETT_VOCABULARY.flatMap((w) => (w.chapters ?? []).map((c) => c.chapter)));
    expect(Math.min(...chapters)).toBe(2);
    expect(Math.max(...chapters)).toBe(31);
    expect(chapters.size).toBe(30);
    expect(GARRETT_VOCABULARY.length).toBeGreaterThan(500);
  });

  it('tags every imported entry with at least one chapter', () => {
    GARRETT_VOCABULARY.forEach((word) => {
      expect((word.chapters ?? []).length, `Untagged import: ${word.hebrew}`).toBeGreaterThan(0);
    });
  });

  it('carries no transliteration or frequency, rather than inventing them', () => {
    GARRETT_VOCABULARY.forEach((word) => {
      expect(word.transliteration).toBeUndefined();
      expect(word.frequency).toBeUndefined();
    });
  });

  it('documents every editorial change that is not a respelling', () => {
    expect(EDITORIAL_NOTES.length).toBeGreaterThan(0);
    for (const note of EDITORIAL_NOTES) {
      expect(note.entry.trim().length).toBeGreaterThan(0);
      expect(note.change.trim().length).toBeGreaterThan(0);
      expect(note.reason.trim().length).toBeGreaterThan(0);
      // Each names a root the data actually carries, so a note cannot outlive
      // the entry it describes.
      expect(
        GARRETT_VOCABULARY.some((w) => w.root === note.entry),
        `Editorial note names an absent root: ${note.entry}`,
      ).toBe(true);
    }
  });

  it('documents every divergence from the printed handout', () => {
    expect(CORRECTIONS.length).toBeGreaterThan(0);
    for (const correction of CORRECTIONS) {
      expect(correction.printed).not.toBe(correction.corrected);
      expect(correction.reason.trim().length).toBeGreaterThan(0);
      // The corrected spelling is what the data must actually carry. The printed
      // one is not asserted absent: מְאֹד was duplicated onto the עָנִי entry by
      // mistake, and מְאֹד is still a real word two rows above it.
      expect(
        GARRETT_VOCABULARY.some(
          (w) =>
            w.hebrew === correction.corrected ||
            w.root === correction.corrected ||
            w.construct === correction.corrected ||
            w.plural === correction.corrected,
        ),
        `Correction not applied: ${correction.printed} -> ${correction.corrected}`,
      ).toBe(true);
    }
  });

  it('writes holam male as vav-then-holam, not the handout\'s reverse order', () => {
    // The handout mixes the WLC order (holam before the vav) into an otherwise
    // standard text; rendered as-is the vowel lands on the wrong consonant.
    const wlcOrder = /\u05B9\u05BC?\u05D5/;
    GARRETT_VOCABULARY.forEach((word) => {
      expect(wlcOrder.test(word.hebrew), `WLC-order holam in ${word.hebrew}`).toBe(false);
    });
  });
});

// ─── mergeVocabulary ──────────────────────────────────────────────────────────

describe('mergeVocabulary', () => {
  const curated: HebrewVocabWord[] = [
    { hebrew: 'דָּבָר', transliteration: 'dābār', gloss: 'word', frequency: 1400, partOfSpeech: 'noun' },
  ];

  it('folds a matching import into the curated entry rather than duplicating it', () => {
    const merged = mergeVocabulary(curated, [
      { hebrew: 'דָּבָר', gloss: 'word, thing', partOfSpeech: 'noun', gender: 'm', chapters: [
        { textbook: 'garrett-derouchie', chapter: 5, category: 'core' },
      ] },
    ]);
    expect(merged).toHaveLength(1);
    // Curated wins where it speaks...
    expect(merged[0].gloss).toBe('word');
    expect(merged[0].transliteration).toBe('dābār');
    expect(merged[0].frequency).toBe(1400);
    // ...and the import fills what it left undefined.
    expect(merged[0].gender).toBe('m');
    expect(merged[0].chapters).toHaveLength(1);
  });

  it('appends an import with no curated counterpart', () => {
    const merged = mergeVocabulary(curated, [
      { hebrew: 'סוּס', gloss: 'horse', partOfSpeech: 'noun' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[1].hebrew).toBe('סוּס');
  });

  it('keeps homographs apart, because their card keys differ', () => {
    const merged = mergeVocabulary(
      [{ hebrew: 'אַף', sense: 'adverb', gloss: 'also', partOfSpeech: 'adverb' }],
      [{ hebrew: 'אַף', sense: 'noun', gloss: 'nose', partOfSpeech: 'noun' }],
    );
    expect(merged).toHaveLength(2);
  });

  it('unions chapter tags without repeating one', () => {
    const ref = { textbook: 'garrett-derouchie', chapter: 1, category: 'core' } as const;
    const merged = mergeVocabulary(
      [{ hebrew: 'דָּבָר', gloss: 'word', partOfSpeech: 'noun', chapters: [ref] }],
      [{ hebrew: 'דָּבָר', gloss: 'word', partOfSpeech: 'noun', chapters: [ref, { ...ref, chapter: 5 }] }],
    );
    expect(merged[0].chapters).toEqual([ref, { ...ref, chapter: 5 }]);
  });

  it('does not mutate its inputs', () => {
    const input: HebrewVocabWord[] = [{ hebrew: 'דָּבָר', gloss: 'word', partOfSpeech: 'noun' }];
    mergeVocabulary(input, [
      { hebrew: 'דָּבָר', gloss: 'word', partOfSpeech: 'noun', gender: 'm' },
    ]);
    expect(input[0].gender).toBeUndefined();
  });

  it('merges the curated set into the real import without losing a word', () => {
    // Every import must be reachable in the merged result under its card key.
    const keys = new Set(vocabulary.map(cardKey));
    for (const word of GARRETT_VOCABULARY) {
      expect(keys.has(cardKey(word)), `Lost in merge: ${word.hebrew}`).toBe(true);
    }
  });
});

// ─── cardKey ──────────────────────────────────────────────────────────────────

describe('cardKey', () => {
  it('is the bare hebrew string when there is no sense', () => {
    expect(cardKey({ hebrew: 'מֶלֶךְ', gloss: 'king', partOfSpeech: 'noun' })).toBe('מֶלֶךְ');
  });

  it('appends the sense when there is one', () => {
    expect(cardKey({ hebrew: 'אַף', sense: 'noun', gloss: 'nose', partOfSpeech: 'noun' })).toBe(
      'אַף#noun',
    );
  });
});
