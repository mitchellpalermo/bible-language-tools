import { describe, expect, it } from 'vitest';

import {
  baseStrong,
  buildFormIndex,
  buildLexiconIndex,
  cardGloss,
  displayForm,
  emitModule,
  entryKey,
  mergeEntry,
  normalizeHeadword,
  posLabel,
  resolveHeadword,
  witnessVerb,
} from './vocab-oshb.mjs';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * A miniature lemma index. The shapes here are the ones that decide something:
 * a lexeme split across `a`/`b` senses, an unrelated homograph sharing its
 * spelling, a proper name colliding with a verb, and a lemma with no lexical
 * fields at all.
 */
const LEMMAS = {
  168: { count: 345, hebrew: 'אֹהֶל', pos: 'N', gender: 'm', root: 'אהל' },
  169: { count: 1, hebrew: 'אֹהֶל', pos: 'Np' },
  '5892a': { count: 2, hebrew: 'עִיר', pos: 'N', gender: 'f', root: 'עיר' },
  '5892b': { count: 1093, hebrew: 'עִיר', pos: 'N', gender: 'f', root: 'עיר' },
  5894: { count: 3, hebrew: 'עִיר', pos: 'N', gender: 'm' },
  637: { count: 134, hebrew: 'אַף', pos: 'T' },
  639: { count: 276, hebrew: 'אַף', pos: 'N', gender: 'm', root: 'אנף' },
  1985: { count: 5, hebrew: 'הִלֵּל', pos: 'Np' },
  559: { count: 5308, hebrew: 'אָמַר', pos: 'V', root: 'אמר' },
  8449: { count: 14, hebrew: 'תֹּר', pos: 'N', gender: 'fm' },
  1339: { count: 11, hebrew: 'בַּת־שֶׁבַע', pos: 'Np' },
  // A lemma the lexicon could not resolve: a count and nothing else.
  7451: { count: 20 },
};

/** One verse of corpus, in the shape `build-morphhb.mjs` writes. */
const BOOK = {
  1: {
    1: [
      { text: 'וַ/יֹּאמֶר', lemma: '559', pos: 'Vq', parsing: 'HC/Vqw3ms' },
      { text: 'הָ/אֹהֶל', lemma: '168', pos: 'Nc', parsing: 'HTd/Ncmsa' },
      { text: 'בַּת', lemma: '1339+', pos: 'Np', parsing: 'HNp', after: '־' },
      { text: 'שֶׁבַע', lemma: '1339', pos: 'Np', parsing: 'HNp' },
      { text: 'כתיב', lemma: '7451', pos: 'Nc', parsing: 'HNcmsa', ketiv: true, qere: 'קְרֵי' },
      { text: 'שׁחר', lemma: '7451', pos: 'Nc', parsing: 'HNcmsa', ketiv: true },
    ],
  },
};

const handout = (over = {}) => ({
  hebrew: 'אֹהֶל',
  gloss: 'tent',
  posHint: 'noun',
  chapters: ['2:core'],
  ...over,
});

const indexes = () => {
  const { forms, pairs } = buildFormIndex([BOOK]);
  return { lexicon: buildLexiconIndex(LEMMAS), forms, pairs, lemmas: LEMMAS };
};

// ─── Normalisation ───────────────────────────────────────────────────────────

describe('normalizeHeadword', () => {
  it('composes combining marks into canonical order', () => {
    // The handout writes bet + tsere + dagesh; the lexicon writes bet + dagesh +
    // tsere. Same word, and only NFC says so.
    const handoutOrder = 'בֵּן';
    const lexiconOrder = 'בֵּן';
    expect(handoutOrder).not.toBe(lexiconOrder);
    expect(normalizeHeadword(handoutOrder)).toBe(normalizeHeadword(lexiconOrder));
  });

  it('strips cantillation but keeps the vowel points', () => {
    expect(normalizeHeadword('אַבְדָ֑ן')).toBe('אַבְדָן');
  });

  it('ignores maqqef, so a compound name matches whether or not it was extracted', () => {
    expect(normalizeHeadword('בַּת־שֶׁבַע')).toBe(normalizeHeadword('בַּתשֶׁבַע'));
  });
});

describe('displayForm', () => {
  it('keeps a maqqef between two words', () => {
    expect(displayForm('בַּת־שֶׁבַע')).toBe('בַּת־שֶׁבַע');
  });

  it('drops a maqqef at either end, which only marks that the word leans forward', () => {
    expect(displayForm('מִן־')).toBe('מִן');
  });
});

describe('baseStrong', () => {
  it('drops the augmentation letter, so BDB sense splits group together', () => {
    expect(baseStrong('5892a')).toBe('5892');
    expect(baseStrong('5892b')).toBe('5892');
  });

  it('leaves a plain number and a prefix code alone', () => {
    expect(baseStrong('853')).toBe('853');
    expect(baseStrong('b')).toBe('');
  });
});

describe('entryKey', () => {
  it('is the headword alone when there is no homograph to separate', () => {
    expect(entryKey({ hebrew: 'אֹהֶל' })).toBe('אֹהֶל');
  });

  it('appends the sense, matching the app’s cardKey', () => {
    expect(entryKey({ hebrew: 'אַף', sense: 'noun' })).toBe('אַף#noun');
  });
});

describe('posLabel', () => {
  it('maps every pronoun and particle code onto "particle"', () => {
    for (const code of ['P', 'Pd', 'Pi', 'Pp', 'Pr', 'T', 'Td', 'Tj', 'To']) {
      expect(posLabel(code)).toBe('particle');
    }
  });

  it('is undefined for a lemma the lexicon could not resolve', () => {
    expect(posLabel(undefined)).toBeUndefined();
  });
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

describe('buildLexiconIndex', () => {
  it('collects every lemma written the same way under one key', () => {
    const index = buildLexiconIndex(LEMMAS);
    expect(
      index
        .get(normalizeHeadword('עִיר'))
        .map((e) => e.id)
        .sort(),
    ).toEqual(['5892a', '5892b', '5894']);
  });

  it('skips lemmas the lexicon gives no headword for', () => {
    const index = buildLexiconIndex(LEMMAS);
    expect([...index.values()].flat().some((e) => e.id === '7451')).toBe(false);
  });
});

describe('buildFormIndex', () => {
  it('indexes the whole word, so a prefixed form is findable as written', () => {
    const { forms } = buildFormIndex([BOOK]);
    expect(forms.get(normalizeHeadword('וַיֹּאמֶר')).lemmas.get('559')).toBe(1);
  });

  it('indexes the head morpheme, so the article does not hide the noun', () => {
    const { forms } = buildFormIndex([BOOK]);
    expect(forms.get(normalizeHeadword('אֹהֶל')).lemmas.get('168')).toBe(1);
  });

  it('joins a maqqef-linked pair, which the corpus stores as two words', () => {
    const { pairs } = buildFormIndex([BOOK]);
    const entry = pairs.get(normalizeHeadword('בַּת־שֶׁבַע'));
    expect(entry.lemmas.get('1339')).toBe(1);
    expect(entry.form).toBe('בַּת־שֶׁבַע');
  });

  it('reads a ketiv through its qere rather than indexing bare consonants', () => {
    // An unpointed ketiv would let a consonantal string claim to be an attested
    // pointed form, which is exactly the evidence this index exists to give.
    const { forms } = buildFormIndex([BOOK]);
    expect(forms.has('כתיב')).toBe(false);
    expect(forms.has('שׁחר')).toBe(false);
    expect(forms.has('קְרֵי')).toBe(true);
  });
});

// ─── Resolution ──────────────────────────────────────────────────────────────

describe('resolveHeadword', () => {
  it('matches a dictionary headword and takes the lexeme’s frequency', () => {
    const result = resolveHeadword(handout(), indexes());
    expect(result.status).toBe('lexicon');
    expect(result.strong).toBe('168');
    expect(result.frequency).toBe(345);
    expect(result.root).toBe('אהל');
    expect(result.pos).toBe('noun');
  });

  it('adds up the BDB sense splits of one lexeme and ignores the homograph', () => {
    const result = resolveHeadword(handout({ hebrew: 'עִיר', gloss: 'city' }), indexes());
    expect(result.strong).toBe('5892b');
    expect(result.frequency).toBe(1095);
  });

  it('lets the handout’s part of speech break a tie it cannot break itself', () => {
    const context = indexes();
    expect(resolveHeadword(handout({ hebrew: 'אַף', posHint: 'noun' }), context).strong).toBe('639');
    expect(resolveHeadword(handout({ hebrew: 'אַף', posHint: 'conjunction' }), context).strong).toBe(
      '637',
    );
  });

  it('flags two readings that are too close in size to choose between', () => {
    const result = resolveHeadword(handout({ hebrew: 'אַף', posHint: 'particle' }), indexes());
    expect(result.ambiguous).toBe(true);
  });

  it('does not flag a lexeme that dwarfs its homograph', () => {
    expect(resolveHeadword(handout(), indexes()).ambiguous).toBe(false);
  });

  it('falls back to the corpus for a form that is not a citation form', () => {
    const result = resolveHeadword(
      handout({ hebrew: 'וַיֹּאמֶר', posHint: 'verb', chapters: ['6:inflected'] }),
      indexes(),
    );
    expect(result.status).toBe('corpus');
    expect(result.strong).toBe('559');
    expect(result.root).toBe('אמר');
    // The count is a fact about אָמַר, not about this wayyiqtol.
    expect(result.frequency).toBeUndefined();
  });

  it('refuses a verb whose only homograph is a proper name', () => {
    // הִלֵּל the Piel of הלל is not Hillel, and taking his Strong's number would
    // put a man's occurrence count on a verb card.
    const result = resolveHeadword(handout({ hebrew: 'הִלֵּל', posHint: 'verb' }), indexes());
    expect(result.status).toBe('collision');
  });

  it('reports a spelling that occurs nowhere in the corpus', () => {
    const result = resolveHeadword(handout({ hebrew: 'הֹק' }), indexes());
    expect(result.status).toBe('absent');
  });

  it('honours a pin over the counts', () => {
    const result = resolveHeadword(handout({ hebrew: 'אַף', posHint: 'noun' }), {
      ...indexes(),
      pins: { אַף: '637' },
    });
    expect(result.strong).toBe('637');
    expect(result.ambiguous).toBe(false);
  });

  it('keys a pin by sense, so one homograph’s pin cannot claim the other', () => {
    const context = { ...indexes(), pins: { 'אַף#adverb': '637' } };
    expect(
      resolveHeadword(handout({ hebrew: 'אַף', sense: 'adverb', posHint: 'noun' }), context).strong,
    ).toBe('637');
    expect(
      resolveHeadword(handout({ hebrew: 'אַף', sense: 'noun', posHint: 'noun' }), context).strong,
    ).toBe('639');
  });

  it('honours a pin that names a lemma spelled some other way', () => {
    // תּוֹר "turtle-dove" is a plene spelling of תֹּר, and no lexeme the lexicon
    // writes תּוֹר is the bird. A pin has to be able to say so.
    const { forms } = buildFormIndex([
      { 1: { 1: [{ text: 'תּוֹר', lemma: '8449', pos: 'Nc', parsing: 'HNcfsa' }] } },
    ]);
    const result = resolveHeadword(handout({ hebrew: 'תּוֹר' }), {
      lexicon: buildLexiconIndex(LEMMAS),
      forms,
      pairs: new Map(),
      lemmas: LEMMAS,
      pins: { תּוֹר: '8449' },
    });
    expect(result.strong).toBe('8449');
  });

  it('throws on a pin that names no lemma at all', () => {
    expect(() => resolveHeadword(handout(), { ...indexes(), pins: { אֹהֶל: '99999' } })).toThrow(
      /99999/,
    );
  });
});

// ─── Merging ─────────────────────────────────────────────────────────────────

describe('mergeEntry', () => {
  const resolve = (entry, pins) => resolveHeadword(entry, { ...indexes(), pins });

  it('takes the Hebrew from OSHB and the English from the handout', () => {
    const entry = handout({ hebrew: 'בַּתשֶׁבַע', gloss: 'Bathsheba', posHint: 'proper noun' });
    const { word } = mergeEntry(entry, resolve(entry));
    expect(word.hebrew).toBe('בַּת־שֶׁבַע');
    expect(word.gloss).toBe('Bathsheba');
    expect(word.strong).toBe('1339');
  });

  it('keeps the handout’s gender and reports the disagreement', () => {
    const entry = handout({ hebrew: 'עִיר', gloss: 'city', gender: 'm' });
    const { word, divergence } = mergeEntry(entry, resolve(entry));
    expect(word.gender).toBe('m');
    expect(divergence).toEqual({ hebrew: 'עִיר', textbook: 'm', corpus: 'f' });
  });

  it('takes the corpus gender where the handout prints none', () => {
    const entry = handout({ hebrew: 'עִיר', gloss: 'city' });
    const { word, divergence } = mergeEntry(entry, resolve(entry));
    expect(word.gender).toBe('f');
    expect(divergence).toBeUndefined();
  });

  it('never puts a gender on a card that is not a noun', () => {
    // The lexicon carries one for anything ever coded as a common noun, particles
    // included.
    const entry = handout({ hebrew: 'אַף', gloss: 'also, even', posHint: 'conjunction' });
    const { word } = mergeEntry(entry, resolve(entry));
    expect(word.partOfSpeech).toBe('particle');
    expect(word.gender).toBeUndefined();
  });

  it('leaves an inflected card’s spelling, part of speech and frequency alone', () => {
    const entry = handout({
      hebrew: 'וַיֹּאמֶר',
      gloss: 'and (he) said',
      posHint: 'verb',
      binyan: 'Qal',
      chapters: ['6:inflected'],
    });
    const { word } = mergeEntry(entry, resolve(entry));
    expect(word.hebrew).toBe('וַיֹּאמֶר');
    expect(word.partOfSpeech).toBe('verb');
    expect(word.frequency).toBeUndefined();
    expect(word.root).toBe('אמר');
  });

  it('keeps the handout spelling of an entry OSHB cannot place', () => {
    const entry = handout({ hebrew: 'הֹק', gloss: 'rule, statute, law' });
    const { word } = mergeEntry(entry, resolve(entry));
    expect(word.hebrew).toBe('הֹק');
    expect(word.strong).toBeUndefined();
    expect(word.partOfSpeech).toBe('noun');
  });

  it('carries the handout’s editorial fields through untouched', () => {
    const entry = handout({
      sense: 'a',
      construct: 'אֹהֶל',
      plural: 'אֹהָלִים',
      alternates: ['אוֹהֶל'],
      stems: [{ stem: 'Qal', form: 'אָהַל', gloss: 'pitch a tent' }],
      note: 'a note',
    });
    const { word } = mergeEntry(entry, resolve(entry));
    expect(word).toMatchObject({
      sense: 'a',
      construct: 'אֹהֶל',
      plural: 'אֹהָלִים',
      alternates: ['אוֹהֶל'],
      note: 'a note',
      chapters: ['2:core'],
    });
    expect(word.stems).toHaveLength(1);
  });
});

// ─── Emitting ────────────────────────────────────────────────────────────────

describe('mergeEntry — verbs', () => {
  const resolve = (entry) => resolveHeadword(entry, indexes());

  it('carries the handout’s conjugation onto the card beside the binyan', () => {
    const entry = handout({
      hebrew: 'וַיֹּאמֶר',
      gloss: 'and (he) said',
      posHint: 'verb',
      binyan: 'Qal',
      conjugation: 'wayyiqtol',
      chapters: ['6:inflected'],
    });
    const { word } = mergeEntry(entry, resolve(entry));
    expect(word.binyan).toBe('Qal');
    expect(word.conjugation).toBe('wayyiqtol');
  });

  it('leaves it off an entry that has none', () => {
    const entry = handout();
    expect(mergeEntry(entry, resolve(entry)).word).not.toHaveProperty('conjugation');
  });
});

describe('cardGloss', () => {
  it('is the textbook’s wording when the handout carries no literal one', () => {
    expect(cardGloss(handout())).toBe('tent');
  });

  it('prefers the literal translation of the form on the card', () => {
    expect(cardGloss(handout({ gloss: 'write', literal: 'he wrote' }))).toBe('he wrote');
  });

  it('joins the literal stem glosses the way the textbook joins its own', () => {
    const entry = handout({
      gloss: 'Qal: return; Pual: (ms participle) returned',
      stems: [
        { stem: 'Qal', form: 'שָׁב', gloss: 'return', literal: 'he returned' },
        // A stem with nothing to reword keeps the printed gloss.
        { stem: 'Pual', gloss: '(ms participle) returned' },
      ],
    });
    expect(cardGloss(entry)).toBe('Qal: he returned; Pual: (ms participle) returned');
  });

  it('leaves a multi-stem gloss alone when no stem has been reworded', () => {
    const entry = handout({
      gloss: 'Qal: return',
      stems: [{ stem: 'Qal', gloss: 'return' }],
    });
    expect(cardGloss(entry)).toBe('Qal: return');
  });

  it('ships one wording per stem, with the literal folded into the gloss', () => {
    const entry = handout({
      gloss: 'Qal: return',
      stems: [{ stem: 'Qal', form: 'שָׁב', gloss: 'return', literal: 'he returned' }],
    });
    const { word } = mergeEntry(entry, resolveHeadword(entry, indexes()));
    expect(word.gloss).toBe('Qal: he returned');
    expect(word.stems).toEqual([{ stem: 'Qal', form: 'שָׁב', gloss: 'he returned' }]);
  });
});

// ─── The corpus as a witness to a verb's parse ───────────────────────────────

describe('witnessVerb', () => {
  /** A corpus of the given words, and a verb entry resolved against it. */
  const witness = (corpus, over) => {
    const { forms, pairs, verbs } = buildFormIndex([{ 1: { 1: corpus } }]);
    const entry = handout({ posHint: 'verb', chapters: ['6:inflected'], ...over });
    const resolution = resolveHeadword(entry, {
      lexicon: buildLexiconIndex(LEMMAS),
      forms,
      pairs,
      lemmas: LEMMAS,
    });
    return witnessVerb(entry, resolution, verbs);
  };

  const WAYYOMER = { text: 'וַ/יֹּאמֶר', lemma: '559', parsing: 'HC/Vqw3ms' };
  const AMAR = { text: 'אָמַר', lemma: '559', parsing: 'HVqp3ms' };
  const WEAMAR = { text: 'וְ/אָמַר', lemma: '559', parsing: 'HC/Vqq3ms' };

  it('passes a parse the corpus agrees with', () => {
    expect(
      witness([WAYYOMER], { hebrew: 'וַיֹּאמֶר', binyan: 'Qal', conjugation: 'wayyiqtol' }),
    ).toEqual([]);
  });

  it('names the conjugation the corpus has when the handout has another', () => {
    const [problem] = witness([WAYYOMER], {
      hebrew: 'וַיֹּאמֶר',
      binyan: 'Qal',
      conjugation: 'yiqtol',
    });
    expect(problem).toContain('conjugation "yiqtol"');
    expect(problem).toContain('wayyiqtol');
  });

  it('catches a wrong binyan the same way', () => {
    // The shape of the real catch: יַצְלִיחַ was entered as a Qal.
    const [problem] = witness([WAYYOMER], {
      hebrew: 'וַיֹּאמֶר',
      binyan: 'Hiphil',
      conjugation: 'wayyiqtol',
    });
    expect(problem).toContain('binyan "Hiphil"');
    expect(problem).toContain('Qal');
  });

  it('reads a weqatal as a qatal once its conjunction is cut off', () => {
    // וְאָמַר is a weqatal; the אָמַר inside it is what a citation card shows.
    // Without the collapse, a corpus holding only the prefixed form would call
    // every citation form a weqatal.
    expect(witness([WEAMAR], { hebrew: 'אָמַר', binyan: 'Qal', conjugation: 'qatal' })).toEqual([]);
    expect(witness([WEAMAR], { hebrew: 'וְאָמַר', binyan: 'Qal', conjugation: 'weqatal' })).toEqual(
      [],
    );
    expect(witness([WEAMAR], { hebrew: 'וְאָמַר', binyan: 'Qal', conjugation: 'qatal' })).toHaveLength(
      1,
    );
  });

  it('counts a jussive as a witness to the yiqtol it is spelled as', () => {
    const jussive = { text: 'יֹאמַר', lemma: '559', parsing: 'HVqj3ms' };
    expect(witness([jussive], { hebrew: 'יֹאמַר', binyan: 'Qal', conjugation: 'yiqtol' })).toEqual(
      [],
    );
  });

  it('treats silence as no witness, not as disagreement', () => {
    // An unattested form and an unresolved entry both have nothing to say.
    expect(witness([AMAR], { hebrew: 'קָטַל', binyan: 'Qal', conjugation: 'qatal' })).toEqual([]);
    expect(witnessVerb(handout({ conjugation: 'qatal' }), { status: 'absent' }, new Map())).toEqual(
      [],
    );
  });

  it('does not let another lemma spelled the same way testify', () => {
    const other = { text: 'אָמַר', lemma: '7451', parsing: 'HVhv2ms' };
    expect(witness([AMAR, other], { hebrew: 'אָמַר', binyan: 'Qal', conjugation: 'qatal' })).toEqual(
      [],
    );
  });

  it('ignores Aramaic, where the stem letters mean something else', () => {
    const aramaic = { text: 'אָמַר', lemma: '559', parsing: 'AVhp3ms' };
    expect(
      witness([AMAR, aramaic], { hebrew: 'אָמַר', binyan: 'Qal', conjugation: 'qatal' }),
    ).toEqual([]);
  });

  it('skips a stem or conjugation letter it has no name for', () => {
    const odd = { text: 'אָמַר', lemma: '559', parsing: 'HVZp3ms' };
    expect(witness([odd], { hebrew: 'אָמַר', binyan: 'Qal', conjugation: 'qatal' })).toEqual([]);
  });
});

describe('emitModule', () => {
  const emit = (over = {}) =>
    emitModule({
      words: [
        {
          hebrew: 'אֹהֶל',
          root: 'אהל',
          strong: '168',
          gloss: 'tent',
          frequency: 345,
          partOfSpeech: 'noun',
          gender: 'm',
          chapters: ['2:core', '9:derived'],
        },
      ],
      corrections: [{ printed: 'a', corrected: 'b', reason: 'c' }],
      editorialNotes: [{ entry: 'a', change: 'b', reason: 'c' }],
      unmatched: [{ entry: 'הֹק', reason: 'absent' }],
      respellings: [{ printed: 'a', oshb: 'b', strong: '1' }],
      divergences: [{ hebrew: 'עִיר', textbook: 'm', corpus: 'f' }],
      ...over,
    });

  it('renders chapter tags as gd() calls, one per tag', () => {
    expect(emit()).toContain("chapters: [gd(2, 'core'), gd(9, 'derived')]");
  });

  it('omits absent fields rather than writing undefined', () => {
    const line = emit()
      .split('\n')
      .find((l) => l.startsWith("  { hebrew: 'אֹהֶל'"));
    expect(line).toBe(
      "  { hebrew: 'אֹהֶל', root: 'אהל', strong: '168', gloss: 'tent', frequency: 345, " +
        "partOfSpeech: 'noun', gender: 'm', chapters: [gd(2, 'core'), gd(9, 'derived')] },",
    );
  });

  it('escapes a quote in a gloss, so an apostrophe cannot end the string', () => {
    const source = emit({
      words: [
        {
          hebrew: 'א',
          gloss: "the LORD's word",
          partOfSpeech: 'noun',
          chapters: ['2:core'],
        },
      ],
    });
    expect(source).toContain("gloss: 'the LORD\\'s word'");
  });

  it('rejects a chapter tag it cannot parse rather than emitting broken source', () => {
    expect(() =>
      emit({ words: [{ hebrew: 'א', gloss: 'x', partOfSpeech: 'noun', chapters: ['core'] }] }),
    ).toThrow(/Malformed chapter tag/);
  });

  it('emits a stem form only when the handout prints one', () => {
    const source = emit({
      words: [
        {
          hebrew: 'א',
          gloss: 'x',
          partOfSpeech: 'verb',
          stems: [
            { stem: 'Qal', form: 'קָטַל', gloss: 'kill' },
            { stem: 'Piel', gloss: 'slaughter' },
          ],
          chapters: ['2:core'],
        },
      ],
    });
    expect(source).toContain("{ stem: 'Qal', form: 'קָטַל', gloss: 'kill' }");
    expect(source).toContain("{ stem: 'Piel', gloss: 'slaughter' }");
  });
});
