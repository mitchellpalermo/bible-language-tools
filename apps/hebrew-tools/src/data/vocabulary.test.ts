import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, TEXTBOOK_IDS } from './textbooks';
import { cardKey, type HebrewVocabWord, mergeVocabulary, vocabulary } from './vocabulary';
import {
  CORRECTIONS,
  EDITORIAL_NOTES,
  GARRETT_VOCABULARY,
  GENDER_DIVERGENCES,
  OSHB_RESPELLINGS,
  OSHB_UNMATCHED,
} from './vocabulary-garrett';

// Hebrew consonants (U+05D0-05EA) + nikud (U+05B0-U+05BD, U+05C7) + shin/sin
// dots (U+05C1-U+05C2) + maqqef (U+05BE). Cantillation is intentionally
// excluded — vocabulary entries should never contain te'amim.
//
// Maqqef is in the set because two proper names are compounds the WLC joins with
// one: בַּת־שֶׁבַע and בֶּן־יְמִינִי. The handout's extraction dropped the mark and the
// OSHB form restores it; see `OSHB_RESPELLINGS`.
const VALID_HEBREW_CHARS = /^[א-תְ-ׇׂ]+$/;

// Three consonants, each optionally carrying its shin or sin dot. OSHB writes
// roots pointed to that extent — שׂמח and שׁמח are different roots and the dot is
// the only thing that says so.
const VALID_ROOT_CHARS = /^(?:[א-ת][ׁׂ]?){3}$/;

// An augmented Strong's number (`1121a`), or the single letter OSHB uses for an
// inseparable prefix (`b`, `l`, `c`).
const VALID_STRONG = /^(?:\d+[a-z]?|[a-z])$/;

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

  it('carries no transliteration, rather than inventing one', () => {
    // OSHB has no romanization to give, and ~500 hand-written SBL forms would be
    // errors the data tests cannot catch.
    GARRETT_VOCABULARY.forEach((word) => {
      expect(word.transliteration).toBeUndefined();
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

  it('gives every resolved entry a well-formed Strong\'s number', () => {
    GARRETT_VOCABULARY.forEach((word) => {
      if (word.strong === undefined) return;
      expect(VALID_STRONG.test(word.strong), `Bad Strong's on ${word.hebrew}: ${word.strong}`).toBe(
        true,
      );
    });
  });

  it('resolves all but the documented handful against OSHB', () => {
    const unresolved = GARRETT_VOCABULARY.filter((w) => w.strong === undefined);
    expect(unresolved.length).toBe(OSHB_UNMATCHED.length);
    for (const word of unresolved) {
      expect(
        OSHB_UNMATCHED.some((u) => u.entry === cardKey(word)),
        `Unresolved entry with no recorded reason: ${cardKey(word)}`,
      ).toBe(true);
    }
  });

  it('gives a reason for every unmatched headword, and keeps the list current', () => {
    for (const entry of OSHB_UNMATCHED) {
      expect(entry.reason.trim().length, `No reason for ${entry.entry}`).toBeGreaterThan(0);
      const word = GARRETT_VOCABULARY.find((w) => cardKey(w) === entry.entry);
      expect(word, `Exception names an absent entry: ${entry.entry}`).toBeDefined();
      expect(word?.strong, `${entry.entry} resolves and no longer needs an exception`).toBeUndefined();
    }
  });

  it('carries a real occurrence count on every entry that is a citation form', () => {
    // The point of the exercise: before this, `matchFreq` returned false for every
    // textbook word on every band but "all", because none of them had a number.
    const withFrequency = GARRETT_VOCABULARY.filter((w) => w.frequency !== undefined);
    expect(withFrequency.length).toBeGreaterThan(350);
    withFrequency.forEach((word) => {
      expect(Number.isInteger(word.frequency), `Non-integer frequency on ${word.hebrew}`).toBe(true);
      expect(word.frequency).toBeGreaterThan(0);
      expect(word.strong, `Frequency without a lemma on ${word.hebrew}`).toBeDefined();
    });
  });

  it('never puts a frequency on a card that shows an inflected or reading form', () => {
    // Those cards test recognition of a form. The count belongs to the lexeme, and
    // printing it against a form would be a number about a different thing.
    GARRETT_VOCABULARY.filter((word) => {
      const categories = (word.chapters ?? []).map((c) => c.category);
      return categories.length > 0 && categories.every((c) => c === 'inflected' || c === 'reading');
    }).forEach((word) => {
      expect(word.frequency, `Frequency on a form card: ${word.hebrew}`).toBeUndefined();
    });
  });

  it('separates every homograph by Strong\'s number, not only by hand-written sense', () => {
    const byHebrew = new Map<string, HebrewVocabWord[]>();
    for (const word of GARRETT_VOCABULARY) {
      byHebrew.set(word.hebrew, [...(byHebrew.get(word.hebrew) ?? []), word]);
    }
    for (const [hebrew, words] of byHebrew) {
      if (words.length === 1) continue;
      const strongs = words.map((w) => w.strong).filter((s) => s !== undefined);
      expect(new Set(strongs).size, `${hebrew} repeats a Strong's number`).toBe(strongs.length);
    }
  });

  it('agrees with OSHB on every correction made by reading the handout alone', () => {
    // This is the test the whole re-sourcing exists to make possible. Each
    // correction was originally inferred from the entry's own construct form or
    // gloss; a corrected spelling that resolves against OSHB is attested, and one
    // that does not would be a correction that was wrong.
    const unresolvable = new Set(OSHB_UNMATCHED.map((u) => u.entry.split('#')[0]));
    const headwordCorrections = CORRECTIONS.filter((c) =>
      GARRETT_VOCABULARY.some((w) => w.hebrew === c.corrected),
    );
    expect(headwordCorrections.length).toBeGreaterThan(20);
    for (const correction of headwordCorrections) {
      if (unresolvable.has(correction.corrected)) continue;
      const word = GARRETT_VOCABULARY.find((w) => w.hebrew === correction.corrected);
      expect(
        word?.strong,
        `Corrected to a form OSHB does not know: ${correction.printed} -> ${correction.corrected}`,
      ).toBeDefined();
    }
  });

  it('records every spelling it takes from OSHB against the printed page', () => {
    for (const respelling of OSHB_RESPELLINGS) {
      expect(respelling.printed).not.toBe(respelling.oshb);
      expect(
        GARRETT_VOCABULARY.some((w) => w.hebrew === respelling.oshb),
        `Respelling not applied: ${respelling.printed} -> ${respelling.oshb}`,
      ).toBe(true);
      expect(
        GARRETT_VOCABULARY.some((w) => w.hebrew === respelling.printed),
        `Printed spelling still present: ${respelling.printed}`,
      ).toBe(false);
    }
  });

  it('keeps the textbook\'s gender where the corpus disagrees, and says where', () => {
    for (const divergence of GENDER_DIVERGENCES) {
      expect(divergence.textbook).not.toBe(divergence.corpus);
      const word = GARRETT_VOCABULARY.find((w) => w.hebrew === divergence.hebrew);
      expect(word, `Divergence names an absent headword: ${divergence.hebrew}`).toBeDefined();
      expect(word?.gender, `${divergence.hebrew} does not carry the textbook's gender`).toBe(
        divergence.textbook,
      );
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

  // Chapter 5, section C of the grammar prints a closed list of irregular
  // plurals and the chapter quiz marks against it. The forms are spread across
  // chapters 2-5, because `plural` belongs to the word rather than to the
  // chapter that happens to tabulate it — so nothing else in the suite would
  // notice a regeneration quietly dropping one.
  it.each([
    ['אָב', 'אָבוֹת', 'm'],
    ['אִישׁ', 'אֲנָשִׁים', 'm'],
    ['אִשָּׁה', 'נָשִׁים', 'f'],
    ['בַּיִת', 'בָּתִּים', 'm'],
    ['בֵּן', 'בָּנִים', 'm'],
    ['יוֹם', 'יָמִים', 'm'],
    ['מִזְבֵּחַ', 'מִזְבְּחוֹת', 'm'],
    ['עִיר', 'עָרִים', 'f'],
  ])('carries the irregular plural of %s', (singular, plural, gender) => {
    const word = GARRETT_VOCABULARY.find((w) => w.hebrew === singular);
    expect(word, `No entry for ${singular}`).toBeDefined();
    expect(word?.plural).toBe(plural);
    // The grammar prints the gender wherever the ending contradicts it —
    // אָבוֹת is masculine, עָרִים feminine — so it is part of the entry.
    expect(word?.gender).toBe(gender);
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
