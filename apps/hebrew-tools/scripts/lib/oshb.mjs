/**
 * Pure parsing functions for the Open Scriptures Hebrew Bible (OSHB) pipeline.
 *
 * No I/O lives here — `build-morphhb.mjs` fetches and writes, this module decides.
 * Everything below is a pure function over strings, which is what makes the
 * pipeline's real decisions (morpheme heads, ketiv/qere, gender) testable without
 * a 30 MB corpus on disk.
 *
 * Sources, both CC BY 4.0:
 *   - openscriptures/morphhb        `wlc/*.xml`      — WLC text + morphology
 *   - openscriptures/HebrewLexicon  `AugIndex.xml`   — augmented Strong's → lexical index id
 *                                   `LexicalIndex.xml` — pointed lexical form, POS, root
 *                                   `HebrewStrong.xml` — Strong's glosses
 *                                   `BrownDriverBriggs.xml` — BDB glosses and stem senses
 */

// ─── Unicode ─────────────────────────────────────────────────────────────────

/**
 * Cantillation marks (te'amim) and the punctuation codepoints that travel with
 * them. Stripped from *lexical* forms only — the running text keeps them, since
 * the WLC's accents are part of what a reader is reading.
 *
 * U+0591–U+05AF are the accents proper; U+05BD (meteg), U+05BF (rafe),
 * U+05C0 (paseq), U+05C3 (sof pasuq), U+05C6 (nun hafukha) are the strays that
 * show up inside `LexicalIndex.xml` headwords (e.g. אַבְדָ֑ן carries an etnahta).
 */
const CANTILLATION = /[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C3\u05C6]/g;

/** Strip cantillation, keeping consonants and nikud. */
export function stripCantillation(s) {
  return s.replace(CANTILLATION, '');
}

// ─── XML scraping helpers ────────────────────────────────────────────────────

/**
 * OSHB's XML is machine-generated and shallow, so regex scraping is both
 * sufficient and an order of magnitude faster than a DOM over 30 MB. The one
 * thing it must get right is that `<w>` elements appear in two very different
 * places — see `parseVerse`.
 */
const attr = (source, name) => {
  const m = new RegExp(`${name}="([^"]*)"`).exec(source);
  return m ? m[1] : undefined;
};

/** Drop nested markup, keeping its text. */
const textOf = (inner) => inner.replace(/<[^>]*>/g, '');

// ─── Morpheme analysis ───────────────────────────────────────────────────────

/**
 * Normalize an OSHB lemma segment into a `lemmas.json` key.
 *
 * OSHB writes augmented Strong's numbers with a space (`1121 a`); the lexicon's
 * `AugIndex.xml` writes them closed up (`1121a`). The trailing `+` marks the
 * first half of a compound proper name (`1035+` = the בֵּית of בֵּית לֶחֶם) and is
 * not part of the identity.
 */
export function normalizeLemmaKey(segment) {
  return segment.replace(/\s+/g, '').replace(/\+$/, '');
}

/**
 * The head lemma of a morpheme stack.
 *
 * A Hebrew word is a stack: conjunction + preposition + article + stem +
 * pronominal suffix, written in the XML as slash-separated lemma segments
 * (`c/802`) against slash-separated morph codes (`HC/Ncfsc/Sp3ms`). The word's
 * lexical identity is the last *numeric* segment — the prefixes ahead of it are
 * lettered codes (`c`, `d`, `b`, `l`, `m`, `k`, `i`, `s`).
 *
 * When there is no numeric segment at all the word *is* a particle carrying a
 * suffix — לוֹ is `lemma="l" morph="HR/Sp3ms"` — and the last lettered segment is
 * the head.
 */
export function headLemmaIndex(segments) {
  if (segments.length === 0) return -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^\d/.test(segments[i])) return i;
  }
  return segments.length - 1;
}

export function headLemma(lemma) {
  const segments = lemma.split('/').filter(Boolean);
  const i = headLemmaIndex(segments);
  return i === -1 ? '' : normalizeLemmaKey(segments[i]);
}

/** Split a morph string into its language marker and its segment codes. */
export function splitMorph(morph) {
  const language = morph.startsWith('A') ? 'arc' : 'heb';
  const codes = morph.replace(/^[HA]/, '').split('/').filter(Boolean);
  return { language, codes };
}

/**
 * The head morph code of a morpheme stack: the last segment that is neither a
 * suffix nor the definite article. What remains is the stem — the verb in
 * `HC/Vqw3ms`, the noun in `HC/Ncfsc/Sp3ms`, the preposition in `HR/Sp3ms`.
 *
 * Suffix codes all start with `S` (`Sp` pronominal, `Sd` directional he, `Sh`
 * paragogic he, `Sn` paragogic nun). `Td` has to be excluded by name because in
 * **Aramaic the article is postpositive** — מַלְכָּא is `ANcmsd/Td`, so the last
 * non-suffix segment is the article and a rule that stopped at suffixes would
 * call every determined Aramaic noun in Daniel and Ezra an article.
 *
 * A morph string that is *only* an article (`HTd`) falls through to the last
 * segment, which is the article, correctly.
 */
export function headMorph(morph) {
  const { codes } = splitMorph(morph);
  if (codes.length === 0) return '';
  for (let i = codes.length - 1; i >= 0; i--) {
    if (!codes[i].startsWith('S') && codes[i] !== 'Td') return codes[i];
  }
  return codes[codes.length - 1];
}

/**
 * The part-of-speech prefix of a head morph code, e.g. `Ncmsa` → `Nc`,
 * `Vqw3ms` → `Vq`, `R` → `R`.
 *
 * Two characters for the categories that subdivide — noun (common/proper/
 * gentilic), verb (by binyan), adjective, pronoun, particle, suffix — and one
 * for those that do not (preposition, conjunction, adverb). Full morphology
 * stays available in `parsing`; this is the coarse handle a UI filters or
 * colours by without decoding anything.
 */
const SUBDIVIDED = new Set(['N', 'V', 'A', 'P', 'T', 'S']);
export function posOf(headMorphCode) {
  if (!headMorphCode) return '';
  return SUBDIVIDED.has(headMorphCode[0]) ? headMorphCode.slice(0, 2) : headMorphCode.slice(0, 1);
}

/**
 * The lexical gender of a noun occurrence, or undefined when the code carries
 * none.
 *
 * Hebrew nouns do not inflect for gender, so the gender in a common-noun code
 * (`Ncmsa` → position 2) *is* the lemma's gender. Proper nouns (`Np`) are coded
 * without one, and adjectives agree with their head rather than declaring their
 * own, so neither is a witness.
 *
 * OSHB's `b` ("both") is the corpus saying the noun is attested either way,
 * which is exactly `HebrewGender`'s `fm`.
 */
export function nounGender(headMorphCode) {
  if (!headMorphCode.startsWith('Nc') || headMorphCode.length < 3) return undefined;
  const code = headMorphCode[2];
  if (code === 'm' || code === 'f') return code;
  if (code === 'b' || code === 'c') return 'fm';
  return undefined;
}

/**
 * Reduce a lemma's per-occurrence gender witnesses to one value.
 * A word attested both ways is `fm` — that is a fact about the word, not noise.
 */
export function resolveGender(witnesses) {
  const seen = new Set(witnesses);
  if (seen.has('fm')) return 'fm';
  if (seen.has('m') && seen.has('f')) return 'fm';
  if (seen.has('m')) return 'm';
  if (seen.has('f')) return 'f';
  return undefined;
}

// ─── Punctuation ─────────────────────────────────────────────────────────────

/**
 * The `<seg>` types that belong to the running text, mapped in reading order
 * onto the word they follow.
 *
 * Deliberately excluded: `x-samekh`, `x-pe` and `x-reversednun` are scribal
 * section markers rather than text, and `x-large` / `x-small` / `x-suspended`
 * are letter *styling* that appears nested inside a `<w>` — their character is
 * already part of the word.
 */
const TEXT_SEGS = new Set(['x-maqqef', 'x-paseq', 'x-sof-pasuq']);

// ─── Verse parsing ───────────────────────────────────────────────────────────

/**
 * Every element inside a verse, in document order. Used instead of separate
 * per-element scans because ketiv/qere and trailing punctuation are both
 * questions about what comes *next*.
 */
const TOKEN_RE =
  /<w\b[^>]*>[\s\S]*?<\/w>|<note\b[\s\S]*?<\/note>|<seg\b[^>]*\/>|<seg\b[^>]*>[\s\S]*?<\/seg>/g;

/** Pull the qere reading out of a `<note>`, or undefined if it carries none. */
function qereOf(note) {
  if (!/type="variant"/.test(note)) return undefined;
  const rdg = /<rdg type="x-qere"\s*\/>|<rdg type="x-qere">([\s\S]*?)<\/rdg>/.exec(note);
  if (!rdg) return undefined;
  // A self-closing or empty <rdg> is ketiv wela qere — written but not read.
  const inner = rdg[1];
  if (!inner) return { words: [], text: '' };

  const words = [...inner.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/g)].map((m) => ({
    attrs: m[1],
    text: textOf(m[2]),
  }));
  return { words, text: words.map((w) => w.text).join(' ') };
}

/**
 * Build the word record for a `<w>` element's attributes and text, reporting
 * each of its lemma morphemes to `onMorpheme` as it goes.
 *
 * The callback exists so that frequency counting rides the same walk that builds
 * the words, rather than a second scan with its own copy of the rules about
 * which `<w>` elements are running text. What the counts describe is then exactly
 * what the shipped JSON contains.
 */
function wordFrom(attrs, text, onMorpheme) {
  const morph = attr(attrs, 'morph') ?? '';
  const lemma = attr(attrs, 'lemma') ?? '';
  const head = headMorph(morph);

  const segments = lemma.split('/').filter(Boolean);
  const headIndex = headLemmaIndex(segments);

  if (onMorpheme) {
    for (const [i, segment] of segments.entries()) {
      // The first half of a compound proper name (`1035+` = the בֵּית of
      // בֵּית לֶחֶם) is the same lemma as the word that follows it. Counting both
      // halves would double every Bethlehem in the corpus.
      if (segment.endsWith('+')) continue;
      onMorpheme(normalizeLemmaKey(segment), i === headIndex ? head : undefined);
    }
  }

  return {
    text,
    lemma: headIndex === -1 ? '' : normalizeLemmaKey(segments[headIndex]),
    pos: posOf(head),
    parsing: morph,
  };
}

/**
 * Parse one verse's inner XML into an ordered list of words.
 *
 * The three things this has to get right:
 *
 * 1. **`<w>` appears in two places.** Main-text words are direct children of the
 *    verse; the `<w>` inside a `<note type="variant">` is a *qere* reading, not
 *    running text. Scanning for `<w>` without excluding notes silently adds 1,254
 *    phantom words to the corpus.
 * 2. **Ketiv/qere.** A word written one way and read another appears as
 *    `<w type="x-ketiv">` (consonants only, no pointing) followed by a note
 *    holding the pointed qere. `text` always stays the WLC's written form and the
 *    reading goes in `qere`, so choosing which to display is the reader's call,
 *    not the pipeline's. Where the qere has no ketiv to attach to — a word read
 *    but not written, יְהוָה צְבָאוֹת in 2 Kings 19:31 — it is inserted into the
 *    stream as its own word marked `qereOnly`, because it is genuinely read.
 * 3. **Punctuation follows the word.** Maqqef, paseq and sof pasuq are siblings
 *    of `<w>`, so they land in `after` on the word they trail.
 */
export function parseVerse(inner, onMorpheme) {
  const tokens = [...inner.matchAll(TOKEN_RE)].map((m) => m[0]);
  const words = [];

  for (const token of tokens) {
    if (token.startsWith('<w')) {
      const attrs = /<w\b([^>]*)>/.exec(token)?.[1] ?? '';
      const inner = textOf(/<w\b[^>]*>([\s\S]*)<\/w>/.exec(token)?.[1] ?? '');
      const word = wordFrom(attrs, inner, onMorpheme);
      if (/type="x-ketiv"/.test(attrs)) word.ketiv = true;
      words.push(word);
      continue;
    }

    if (token.startsWith('<seg')) {
      const type = attr(token, 'type');
      if (type && TEXT_SEGS.has(type) && words.length > 0) {
        const last = words[words.length - 1];
        last.after =
          (last.after ?? '') + textOf(token.replace(/<seg\b[^>]*>/, '').replace('</seg>', ''));
      }
      continue;
    }

    // <note>
    const qere = qereOf(token);
    if (!qere) continue;
    const previous = words[words.length - 1];
    if (previous?.ketiv) {
      // Nothing to record when the note is empty: that *is* ketiv wela qere.
      if (qere.text) previous.qere = qere.text;
    } else {
      for (const w of qere.words) {
        words.push({ ...wordFrom(w.attrs, w.text, onMorpheme), qereOnly: true });
      }
    }
  }

  return words;
}

/**
 * Parse a whole OSHB book file into `{ [chapter]: { [verse]: words } }`.
 *
 * Chapter and verse come from `<verse osisID="Gen.1.1">` rather than from
 * `<chapter>` nesting, because the osisID is authoritative and every one of the
 * corpus's 23,213 verses carries a well-formed three-part id.
 */
export function parseBook(xml, onMorpheme) {
  const start = xml.indexOf('<div type="book"');
  const body = start === -1 ? xml : xml.slice(start);
  const chapters = {};

  for (const m of body.matchAll(/<verse osisID="([^"]*)">([\s\S]*?)<\/verse>/g)) {
    const parts = m[1].split('.');
    if (parts.length !== 3) continue;
    const [, chapter, verse] = parts;
    const words = parseVerse(m[2], onMorpheme);
    if (words.length === 0) continue;
    chapters[chapter] ??= {};
    chapters[chapter][verse] = words;
  }

  return chapters;
}

// ─── Lemma statistics ────────────────────────────────────────────────────────

/**
 * An accumulator for the per-lemma facts the corpus itself can answer: how often
 * a morpheme occurs, and what gender its noun occurrences are coded with.
 *
 * Pass `record` as the `onMorpheme` callback to `parseBook`.
 */
export function createLemmaStats() {
  /** @type {Map<string, { count: number, genders: Set<string> }>} */
  const stats = new Map();

  const record = (key, headMorphCode) => {
    if (!key) return;
    let entry = stats.get(key);
    if (!entry) {
      entry = { count: 0, genders: new Set() };
      stats.set(key, entry);
    }
    entry.count++;
    // Only the head morpheme witnesses the lemma's gender; a prefix has none.
    if (headMorphCode) {
      const gender = nounGender(headMorphCode);
      if (gender) entry.genders.add(gender);
    }
  };

  return { stats, record };
}

// ─── Lemma index ─────────────────────────────────────────────────────────────

/**
 * Join corpus statistics against the lexicon into `lemmas.json`.
 *
 * The result is keyed by the same lemma string the per-word `lemma` field
 * carries, so a reader popup or a vocabulary build is one lookup away from the
 * pointed lexical form, the root and the occurrence count.
 *
 * A lemma the lexicon cannot resolve still gets an entry — its count is a fact
 * regardless — with the lexical fields absent. Those are returned in
 * `unresolved` rather than guessed at: OSHB writes a handful of homograph lemmas
 * without their disambiguating letter (bare `7451` where the corpus otherwise
 * uses `7451 a` / `7451 b`), and picking one would silently attribute the
 * occurrences to whichever homograph we chose.
 */
export function buildLemmaIndex(stats, augIndex, lexicalIndex, glosses = new Map()) {
  /** @type {Record<string, object>} */
  const lemmas = {};
  const unresolved = [];
  const glossless = [];
  const strongConflicts = [];

  for (const [key, { count, genders }] of stats) {
    const id = augIndex.get(key);
    const entry = id ? lexicalIndex.get(id) : undefined;
    if (!entry) unresolved.push({ lemma: key, count });

    const strong = strongOf(key);
    // The lexicon's own cross-reference agrees with the key's digits for 9,240
    // of the 9,241 lemmas that carry both, so a disagreement is upstream news
    // rather than a rule — reported, not silently resolved either way.
    if (strong && entry?.strong && entry.strong !== strong) {
      strongConflicts.push({ lemma: key, lexicon: entry.strong });
    }

    const gender = resolveGender(genders);
    const root = id ? resolveRoot(lexicalIndex, id) : undefined;
    const gloss = strong ? glosses.get(strong) : undefined;
    if (!gloss) glossless.push({ lemma: key, count });

    lemmas[key] = {
      count,
      ...(entry?.hebrew ? { hebrew: entry.hebrew } : {}),
      ...(entry?.xlit ? { xlit: entry.xlit } : {}),
      ...(entry?.pos ? { pos: entry.pos } : {}),
      ...(gender ? { gender } : {}),
      ...(root ? { root } : {}),
      ...(gloss ? { gloss } : {}),
    };
  }

  const byCount = (a, b) => b.count - a.count;
  unresolved.sort(byCount);
  glossless.sort(byCount);
  return { lemmas, unresolved, glossless, strongConflicts };
}

/**
 * The Strong's number a lemma key names: `1121a` → `1121`.
 *
 * OSHB's `lemma` attribute *is* an augmented Strong's number, so the digits are
 * the number by construction. The inseparable prefixes are the exception —
 * `l`, `b`, `c` and the rest are letter codes with no Strong's entry behind
 * them, and they get no number here.
 */
export function strongOf(lemmaKey) {
  return /^(\d+)/.exec(lemmaKey)?.[1];
}

// ─── Lexicon parsing ─────────────────────────────────────────────────────────

/** `AugIndex.xml`: augmented Strong's number → lexical index entry id. */
export function parseAugIndex(xml) {
  const index = new Map();
  for (const m of xml.matchAll(/<w aug="([^"]*)">([^<]*)<\/w>/g)) {
    index.set(m[1].trim(), m[2].trim());
  }
  return index;
}

/**
 * `LexicalIndex.xml`: entry id → pointed headword, transliteration, POS, and the
 * etymology links that roots hang off.
 *
 * Root resolution is two-step by design. A main entry carries
 * `<etym root="אבד" type="main">`, and its derivatives carry
 * `<etym type="sub">aaf</etym>` naming the parent — so a derived noun's root is
 * its parent's, and only about 58% of entries can reach one at all. `root` is
 * therefore optional, not missing data to be papered over.
 */
export function parseLexicalIndex(xml) {
  const entries = new Map();
  for (const m of xml.matchAll(/<entry id="([^"]*)">([\s\S]*?)<\/entry>/g)) {
    const body = m[2];
    const headword = /<w(?:\s+xlit="([^"]*)")?\s*>([^<]*)<\/w>/.exec(body);
    const etym = /<etym([^>]*)>([\s\S]*?)<\/etym>/.exec(body);
    entries.set(m[1], {
      hebrew: headword ? stripCantillation(headword[2].trim()) : undefined,
      xlit: headword?.[1],
      pos: /<pos>([^<]*)<\/pos>/.exec(body)?.[1]?.trim(),
      // The lexicon's own link to Strong's. Only used to check the number the
      // lemma key already carries — see `buildLemmaIndex`.
      strong: /<xref[^>]*strong="([^"]*)"/.exec(body)?.[1]?.trim(),
      // The entry's id in `BrownDriverBriggs.xml`. Reached through the exact
      // augmented key, so `5921a` lands on עַל "upon" and never on the other
      // entries that share Strong's 5921 — see `buildGlossIndex`.
      bdb: /<xref[^>]*bdb="([^"]*)"/.exec(body)?.[1]?.trim(),
      root: etym ? attr(etym[1], 'root') : undefined,
      parents: etym
        ? etym[2]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    });
  }
  return entries;
}

/**
 * `HebrewStrong.xml`: Strong's number (bare, no `H`) → a short gloss.
 *
 * **The `<def>` elements inside `<meaning>` are the gloss, not `<usage>`.**
 * `<usage>` is the KJV's translation words with all the apparatus attached —
 * H1 reads `chief, (fore-) father(-less), × patrimony, principal.` where the
 * `<def>` reads `father`. Strong's marks the definitional words inside a
 * discursive sentence, and lifting exactly those out is what turns "to do or
 * make, in the broadest sense and widest application" into "do, make".
 *
 * 9,002 of the 9,256 lemmas in the corpus resolve that way. `<usage>` is the
 * fallback for the 245 that carry no `<meaning>` — almost all of them the
 * Aramaic "corresponding to H*n*" entries, whose usage lines are already short
 * ("destroy, perish.").
 *
 * Known limitation: proper names keep Strong's own romanizations, so H3478 is
 * "he will rule as God, Jisraël". The popup shows the pointed lemma beside it,
 * and inventing a normalization rule for archaic spellings would break more
 * than it fixed.
 */
export function parseStrongGlosses(xml) {
  const glosses = new Map();
  /** Entries that define themselves as another entry's counterpart. @type {Map<string,string>} */
  const counterparts = new Map();

  for (const m of xml.matchAll(/<entry id="H(\d+)">([\s\S]*?)<\/entry>/g)) {
    const gloss = glossFromEntry(m[2]);
    if (gloss) glosses.set(m[1], gloss);
    else {
      // "(Aramaic) corresponding to H3389" is the whole entry for a handful of
      // words — Aramaic Jerusalem among them, which a student reading Daniel
      // will hover. Taking the counterpart's gloss is what the entry says to do.
      const source = /<source>([\s\S]*?)<\/source>/.exec(m[2]);
      const ref = source && /corresponding to\s*<w src="H(\d+)"/.exec(source[1]);
      if (ref) counterparts.set(m[1], ref[1]);
    }
  }

  // One hop only. A counterpart of a counterpart does not occur, and following
  // a chain would need cycle detection for no gain.
  for (const [id, target] of counterparts) {
    const gloss = glosses.get(target);
    if (gloss) glosses.set(id, gloss);
  }
  return glosses;
}

function glossFromEntry(body) {
  const meaning = /<meaning>([\s\S]*?)<\/meaning>/.exec(body);
  if (meaning) {
    const defs = [...meaning[1].matchAll(/<def>([\s\S]*?)<\/def>/g)]
      .map((d) => collapse(stripTags(d[1])))
      .filter(Boolean);
    // Strong's repeats a word across senses often enough to be worth deduping.
    const unique = [...new Set(defs)];
    if (unique.length) return unique.join(', ');
  }
  const usage = /<usage>([\s\S]*?)<\/usage>/.exec(body);
  return usage ? cleanUsage(stripTags(usage[1])) : undefined;
}

const stripTags = (s) => s.replace(/<[^>]*>/g, '');
const collapse = (s) => s.replace(/\s+/g, ' ').trim();

/** How many of `<usage>`'s comma-separated alternatives are worth showing. */
const USAGE_ALTERNATIVES = 4;

/**
 * `<usage>` cleaned down to something a popup can hold.
 *
 * `×` and `+` are Strong's markers for "the KJV supplies this word" and "this
 * is part of a phrase"; `Compare 3050, 3069.` is a cross-reference, not a
 * gloss. What is left is a comma-separated list, and the first few of it are
 * the useful part.
 */
function cleanUsage(text) {
  const parts = text
    .replace(/\bCompare[^.]*\.?/g, '')
    .replace(/[×+]/g, '')
    .replace(/\.\s*$/, '')
    .split(',')
    .map((part) => collapse(part))
    .filter(Boolean);
  // An entry whose usage line is nothing but apparatus has said nothing, and
  // an empty string would render as a gloss.
  return parts.length ? parts.slice(0, USAGE_ALTERNATIVES).join(', ') : undefined;
}

/** Walk `etym type="sub"` links up to the main entry that declares the root. */
export function resolveRoot(entries, id, depth = 0) {
  const entry = entries.get(id);
  if (!entry || depth > 4) return undefined;
  if (entry.root) return stripCantillation(entry.root);
  for (const parent of entry.parents) {
    const root = resolveRoot(entries, parent, depth + 1);
    if (root) return root;
  }
  return undefined;
}

// ─── BDB glosses (issue #131) ────────────────────────────────────────────────

/**
 * BDB's stem labels → the names `src/lib/morph-parse.ts` renders.
 *
 * Built from every `<stem>` value in the pinned `BrownDriverBriggs.xml`, and
 * **an unknown label throws** (`bdbStemNames`). A stem that was silently
 * dropped would look exactly like a verb BDB does not cover, so the build
 * fails instead and the label gets added here.
 *
 * Most labels name one stem. A few name two, because BDB and OSHB cut the same
 * forms differently: BDB writes one "Pōʿl" family where OSHB separates Polel
 * (`o`) from Poel (`m`), and its Aramaic "Hithpa" covers both of OSHB's
 * Hithpaal (`M`) and Ithpaal (`P`). The senses are filed under each.
 *
 * Labels are compared after `cleanStemLabel`, which drops a trailing period, a
 * trailing sense number ("Qal 1", "Pi. 2") and editorial brackets ("[Qal]").
 */
const STEM_LABELS = {
  // Hebrew, the seven
  Qal: ['Qal'],
  'Qal pass': ['Qal passive'],
  Niph: ['Niphal'],
  Pi: ['Piel'],
  Piel: ['Piel'],
  Pu: ['Pual'],
  Pual: ['Pual'],
  Hiph: ['Hiphil'],
  Hoph: ['Hophal'],
  Hithp: ['Hithpael'],
  // Hebrew, the hollow and geminate variants
  Po: ['Polel', 'Poel'],
  'Pō‛': ['Polel', 'Poel'],
  'Po‛': ['Polel', 'Poel'],
  'Pō‛l': ['Polel', 'Poel'],
  'Po‛l': ['Polel', 'Poel'],
  Pol: ['Polel', 'Poel'],
  Polel: ['Polel', 'Poel'],
  'Po‛lel': ['Polel', 'Poel'],
  'Po‛lēl': ['Polel', 'Poel'],
  'Pō‛lēl': ['Polel', 'Poel'],
  'Pô‛lēl': ['Polel', 'Poel'],
  'Pōl‛ēl': ['Polel', 'Poel'],
  'Pôl‛el': ['Polel', 'Poel'],
  'Po‛ēl': ['Polel', 'Poel'],
  'Po‛el': ['Polel', 'Poel'],
  'Pō‛ēl': ['Polel', 'Poel'],
  'Pō‛êl': ['Polel', 'Poel'],
  'Pō‛el': ['Polel', 'Poel'],
  'Pô‛el': ['Polel', 'Poel'],
  'Po‛al': ['Polal', 'Poal'],
  'Pō‛al': ['Polal', 'Poal'],
  'Pō‛lal': ['Polal', 'Poal'],
  'Po‛lal': ['Polal', 'Poal'],
  'Pu‛l': ['Pulal'],
  Hithpo: ['Hithpolel', 'Hithpoel'],
  Hithpol: ['Hithpolel', 'Hithpoel'],
  'Hithpō‛': ['Hithpolel', 'Hithpoel'],
  'Hithpô‛': ['Hithpolel', 'Hithpoel'],
  'Hithpō‛l': ['Hithpolel', 'Hithpoel'],
  'Hithpo‛l': ['Hithpolel', 'Hithpoel'],
  Hithpōl: ['Hithpolel', 'Hithpoel'],
  'Hithpō‛lēl': ['Hithpolel', 'Hithpoel'],
  'Hithpo‛lel': ['Hithpolel', 'Hithpoel'],
  'Hithpo‛el': ['Hithpolel', 'Hithpoel'],
  'Po‛. Hithpo‛l': ['Polel', 'Poel', 'Hithpolel', 'Hithpoel'],
  Pilp: ['Pilpel'],
  Pilpēl: ['Pilpel'],
  Palp: ['Pilpel', 'Palpel'],
  Polp: ['Polpal'],
  Hithpalp: ['Hithpalpel'],
  Pil: ['Pilel'],
  'Pi‛lēl': ['Pilel'],
  'Pi‛lel': ['Pilel'],
  'Pa‛lel': ['Palel'],
  'Pa‛l': ['Palel'],
  'Pe‛al‛al': ['Pealal'],
  'Hithpa‛lēl': ['Hithpalel', 'Nithpalel'],
  Hothp: ['Hothpaal'],
  Nithp: ['Nithpael'],
  Tiph: ['Tiphil', 'Tiphel'],
  Shaph: ['Shaphel'],
  Ishtaph: ['Ishtaphel', 'Hishtaphel'],
  // Aramaic
  Pe: ['Peal'],
  'Pe‛îl': ['Peil'],
  'Pᵉ‛îl': ['Peil'],
  Pa: ['Pael'],
  Haph: ['Haphel'],
  Hêphal: ['Hephal'],
  Hithpe: ['Hithpeel', 'Ithpeel'],
  Ithpe: ['Ithpeel', 'Hithpeel'],
  Hithpa: ['Hithpaal', 'Ithpaal'],
  Ithpa: ['Ithpaal', 'Hithpaal'],
  'Ethpō‛l': ['Ithpolel', 'Ithpoel'],
};

/**
 * `<stem>` values that are not stems. BDB's markup tags one noun sense of a
 * root with `<stem>n.[m.]</stem>`; its senses are a noun's, so they are not
 * filed under any stem.
 */
const NOT_STEMS = new Set(['n.[m.]']);

function cleanStemLabel(raw) {
  return raw
    .trim()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\s+\d+$/, '')
    .replace(/\.$/, '')
    .trim();
}

/**
 * The `morph-parse.ts` stem names a BDB `<stem>` label covers, or `null` for a
 * label that is not a stem. Throws on a label it does not know.
 */
export function bdbStemNames(raw) {
  const label = cleanStemLabel(raw);
  if (NOT_STEMS.has(label)) return null;
  const names = STEM_LABELS[label];
  if (!names) throw new Error(`BDB stem label "${raw}" is not mapped — add it to STEM_LABELS`);
  return names;
}

const HEBREW_LETTER = /[א-ת]/;

/**
 * **A `<def>` that translates a cited phrase is not a gloss.** Inside a verb's
 * stem senses BDB marks the English of a specific quotation with `<def>` too —
 * חָזַק Qal II "transit. only *strengthened him not*", נָכָה Niphal "*and he
 * shall be smitten*", שָׁלַח Niphal "*letters were sent*". On their own those
 * read as nonsense. What gives them away is a personal pronoun, a finite
 * auxiliary or a leading "and": a stem sense is a dictionary form and has
 * none of them.
 *
 * **One cited item condemns its whole sense.** BDB splits a quotation into
 * several defs as readily as a phrase, so the pieces around a cited item are
 * fragments of the same quotation: נָכָה Niphal is "*and he shall be smitten*,
 * *and die*", שָׁלַח Hiphil "*and I* … *will send*". Keeping the survivors
 * would leave "and die" as the Niphal of "smite".
 *
 * Only stem senses are filtered. In an entry's head a pronoun *is* the gloss —
 * הוּא is "he, she, it".
 */
const CITED_PHRASE =
  /\b(?:he|she|it|they|we|thou|him|her|me|thee|us|them|ye|thy|thine|my|his|our|their|was|were|shall|will|hath|hast)\b|\bI\b|^and\b/i;

/**
 * Turn one region's run of text and `<def>`s into gloss items.
 *
 * **BDB tags pieces of one phrase as separate `<def>`s.** חָזַק opens with
 * "`<def>be</def>` or `<def>grow firm</def>`", and a first-def rule reads
 * "be". Defs separated only by "or", "and" or "/" are one item, joined with
 * the word between them. So is a pair split by a short parenthetical, so that
 * קָנָה's Hiphil reads "caused (one) to purchase me" as one phrase — which the
 * cited-phrase rule then drops whole, rather than leaving "caused" behind.
 * Anything else between two defs — a comma, a reference, a Hebrew citation, a
 * word of commentary — starts a new item.
 *
 * **A def inside parentheses is etymology, not a gloss.** יִשְׂרָאֵל is
 * "`<def>Israel</def>` (`<def>Ēl persisteth</def>`)": the name, then what it
 * means. Parenthesized defs are dropped and break the phrase they interrupt.
 */
function glossItems(parts, { stem = false } = {}) {
  const items = [];
  let cited = false;
  let current = null;
  let gap = '';
  const flush = () => {
    if (current === null) return;
    let item = current.replace(/\s+/g, ' ').trim();
    if (stem) {
      if (CITED_PHRASE.test(item)) cited = true;
      // "to hear", "to be blessed": an infinitive marker is not part of a gloss.
      item = item.replace(/^to\s+/, '');
    }
    if (item && !HEBREW_LETTER.test(item) && !items.includes(item)) items.push(item);
    current = null;
  };

  for (const part of parts) {
    if (part.def === undefined) {
      gap += part.text;
      continue;
    }
    if (part.paren > 0) {
      flush();
      gap = '¶';
      continue;
    }
    const joiner = /^\s*(or|and|\/|\([^()¶]*\))\s*$/.exec(gap);
    if (current !== null && joiner) current += ` ${joiner[1]} ${part.def}`;
    else {
      flush();
      current = part.def;
    }
    gap = '';
  }
  flush();
  return cited ? [] : items;
}

/**
 * Parse one BDB `<entry>` body into a tree of senses.
 *
 * Each node is `{ stems, parts, children }`: `stems` is set on a sense that
 * opens with `<stem>`, `parts` is the node's own text and defs in order (a
 * `<w>` Hebrew citation is a separator), and `children` are its nested
 * `<sense>`s. The root is the entry's head, before any sense.
 */
function senseTree(body) {
  const root = { stems: null, parts: [], children: [], trailing: [] };
  const stack = [root];
  let node = root;
  let paren = 0;
  let mode = null; // 'def' | 'stem' | 'w' | 'skip'
  let buffer = '';
  let wDepth = 0;

  const clean = body.replace(/<status\b[\s\S]*?<\/status>/g, '');
  for (const [token] of clean.matchAll(/<[^>]+>|[^<]+/g)) {
    if (token.startsWith('<')) {
      if (/^<sense\b/.test(token)) {
        const child = { stems: null, parts: [], children: [] };
        node.children.push(child);
        stack.push(child);
        node = child;
        paren = 0;
      } else if (token === '</sense>') {
        if (stack.length > 1) stack.pop();
        node = stack[stack.length - 1];
      } else if (token === '<def>') {
        mode = 'def';
        buffer = '';
      } else if (token === '</def>') {
        if (node !== root || root.children.length === 0) {
          node.parts.push({ def: decodeEntities(buffer), paren });
        } else {
          root.trailing.push(decodeEntities(buffer));
        }
        mode = null;
      } else if (token === '<stem>') {
        mode = 'stem';
        buffer = '';
      } else if (token === '</stem>') {
        // A verb used in one stem only names it in the head, with no <sense>
        // around it: צָוָה is "<stem>Pi</stem>. lay charge, give charge".
        node.stems = bdbStemNames(decodeEntities(buffer));
        mode = null;
      } else if (/^<w\b/.test(token) && !token.endsWith('/>')) {
        wDepth++;
        node.parts.push({ text: ' ¶ ' });
      } else if (token === '</w>') {
        wDepth = Math.max(0, wDepth - 1);
      } else if (/^<ref\b/.test(token)) {
        // A reference interrupts a phrase the same way a citation does.
        node.parts.push({ text: ' ¶ ' });
      }
      continue;
    }
    if (mode === 'def' || mode === 'stem') {
      buffer += token;
      continue;
    }
    if (wDepth > 0) continue;
    // The head is what comes before the first sense; text after the last one
    // is commentary on the whole entry.
    if (node === root && root.children.length > 0) continue;
    node.parts.push({ text: token });
    for (const c of token) {
      if (c === '(') paren++;
      else if (c === ')') paren = Math.max(0, paren - 1);
    }
  }
  return root;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Depth-first, the first node at or under `node` that yields any items. */
function firstItems(node) {
  const own = glossItems(node.parts);
  if (own.length > 0) return own;
  for (const child of node.children) {
    const found = firstItems(child);
    if (found.length > 0) return found;
  }
  return [];
}

/** Every node's items under a stem, depth-first, one array per sense that has any. */
function allSenses(node, out = []) {
  const own = glossItems(node.parts, { stem: true });
  if (own.length > 0) out.push(own);
  for (const child of node.children) if (!child.stems) allSenses(child, out);
  return out;
}

/**
 * Whether a stem block says nothing about its primary sense: no defs of its
 * own, and none anywhere under its first sense. הָלַךְ's Qal is like that —
 * the file is abridged, sense I (go, come, walk) carries no defs, and the
 * first def under Qal is sense II's "pass away, die".
 */
function primaryIsBare(block) {
  if (glossItems(block.parts, { stem: true }).length > 0) return false;
  const first = block.children.find((child) => !child.stems);
  return !first || allSenses(first).length === 0;
}

/** Words BDB capitalizes because they are names, not because they open a sense. */
const PROPER = new Set(['God', 'Yahweh', 'Lord', 'Israel']);

/**
 * BDB capitalizes the opening def of some numbered senses ("Say", "Fall
 * out"). Inside a stem's sense list that is typography, not a proper noun.
 */
function lowerFirst(item) {
  const word = item.split(/\s/)[0];
  return /^[A-Z][a-z]/.test(item) && !PROPER.has(word)
    ? item[0].toLowerCase() + item.slice(1)
    : item;
}

/** Drop a sense that adds nothing to the ones before it ("see", "see", "see"). */
function distinctSenses(senses) {
  const seen = new Set();
  return senses.filter((items) => {
    const fresh = items.some((item) => !seen.has(item));
    for (const item of items) seen.add(item);
    return fresh;
  });
}

/**
 * Every stem block in an entry, wherever BDB nested it — including the head
 * itself, for a verb that names its one stem there.
 */
function stemBlocks(root) {
  const out = root.stems ? [root] : [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.stems) out.push(child);
      else walk(child);
    }
  };
  walk(root);
  return out;
}

/** Every def an entry carries, cleaned the same way items are. For pin checks. */
function allDefs(node, out = new Set()) {
  for (const def of node.trailing ?? []) out.add(def.replace(/\s+/g, ' ').trim());
  for (const part of node.parts) {
    if (part.def !== undefined) out.add(part.def.replace(/\s+/g, ' ').trim());
  }
  for (const child of node.children) allDefs(child, out);
  return out;
}

/**
 * Parse one BDB entry body.
 *
 * - `gloss` — the entry's own head: the defs before its first `<sense>`, or
 *   failing that the first sense that has any. גַּם → `['also', 'moreover',
 *   'yea']`; מְלָאכָה → `['occupation', 'work']`.
 * - `stems` — for a verb, stem name → its senses in BDB's order, each a list of
 *   items: חָזַק's Hiphil is `[['make strong', 'strengthen'], ['make firm'], …]`.
 * - `defs` — every def in the entry, which is what a pin is checked against.
 */
export function parseBdbEntry(body) {
  const tree = senseTree(body);
  const gloss = firstItems(tree);
  const stems = {};
  for (const block of stemBlocks(tree)) {
    let senses = allSenses(block).map((items) => items.map(lowerFirst));
    // The head of a verb entry is BDB's Qal meaning, so it stands in for a Qal
    // whose own first sense is bare. A derived stem gets no such stand-in: the
    // head would give a Hiphil the Qal's meaning.
    const basic = block.stems.includes('Qal') || block.stems.includes('Peal');
    if (basic && block !== tree && gloss.length > 0 && primaryIsBare(block)) {
      senses = [gloss, ...senses];
    }
    if (senses.length === 0) continue;
    for (const name of block.stems) {
      // A stem BDB lists twice (a second Hiphil block further down) keeps both.
      stems[name] = distinctSenses([...(stems[name] ?? []), ...senses]);
    }
  }
  return { gloss, stems, defs: allDefs(tree) };
}

/** `BrownDriverBriggs.xml`: entry id → `parseBdbEntry` result. */
export function parseBdb(xml) {
  const entries = new Map();
  for (const m of xml.matchAll(/<entry id="([^"]*)"[^>]*>([\s\S]*?)<\/entry>/g)) {
    entries.set(m[1], parseBdbEntry(m[2]));
  }
  return entries;
}

/**
 * A pin chooses among the entry's defs and never supplies its own, so the
 * wording stays BDB's. A pinned def the entry does not carry — a typo, or an
 * upstream edit to the lexicon — fails the build by name.
 */
function checkPin(key, pin, entry) {
  const named = [...(pin.gloss ?? []), ...Object.values(pin.stems ?? {}).flat()];
  const missing = named.filter((def) => !entry?.defs.has(def));
  if (missing.length > 0) {
    throw new Error(
      `BDB pin for ${key} names defs the entry does not carry: ${missing.join(', ')}`,
    );
  }
}

/** How much of each list survives into `glosses.json`. */
export const GLOSS_LIMITS = { items: 3, senses: 4, senseItems: 2 };

/**
 * Join BDB into the per-lemma gloss file, `glosses.json`.
 *
 * `lemmas` is `buildLemmaIndex`'s output (for `pos`, `xlit` and the Strong's
 * gloss), and `pins` is `scripts/data/bdb-pins.json`'s `pins`.
 *
 * Each lemma gets `{ g, s? }`: `g` is the short gloss as a list of items, `s`
 * the stem senses for a verb. Where `g` comes from, in order:
 *
 * 1. **A pin**, for the handful of common words whose first BDB sense
 *    misleads (אֱלֹהִים "rulers, judges"). A pin names defs *from the entry*,
 *    so the wording stays BDB's, and a pinned def the entry does not carry
 *    throws — that is how a pin goes stale.
 * 2. **BDB**, through the exact augmented key: `lemma → AugIndex →
 *    LexicalIndex <xref bdb> → entry`. Looking BDB up by bare Strong's number
 *    instead lands עַל (`5921a`) on the wrong entry.
 * 3. **For a proper name, the lexicon's transliteration** — BDB gives the
 *    English name for most (Israel, Moses), and not for שָׁאוּל.
 * 4. **Strong's**, trimmed to the same length, for what BDB leaves bare —
 *    אֲשֶׁר among them, which BDB describes rather than glosses.
 *
 * The inseparable prefixes are letter codes, not numbers, and are skipped:
 * `src/lib/gloss.ts` answers for them, as it always has.
 */
export function buildGlossIndex(lemmas, augIndex, lexicalIndex, bdb, pins = {}) {
  /** @type {Record<string, { g: string[], s?: Record<string, string[][]> }>} */
  const glosses = {};
  const sources = { pin: [], bdb: [], xlit: [], strong: [], none: [] };
  const stemmed = [];
  const noEntry = [];

  for (const [key, lemma] of Object.entries(lemmas)) {
    if (!/^\d/.test(key)) continue;
    const id = augIndex.get(key);
    const bdbId = id ? lexicalIndex.get(id)?.bdb : undefined;
    const entry = bdbId ? bdb.get(bdbId) : undefined;
    if (!entry) noEntry.push({ lemma: key, count: lemma.count });

    const pin = pins[key];
    if (pin) checkPin(key, pin, entry);

    let g;
    let source;
    if (pin?.gloss) [g, source] = [pin.gloss, 'pin'];
    else if (entry?.gloss.length) [g, source] = [entry.gloss, 'bdb'];
    else if (lemma.pos === 'Np' && lemma.xlit) [g, source] = [[lemma.xlit], 'xlit'];
    else if (lemma.gloss) [g, source] = [lemma.gloss.split(/,\s*/), 'strong'];
    else [g, source] = [[], 'none'];
    sources[source].push({ lemma: key, count: lemma.count });

    const stems = { ...(entry?.stems ?? {}) };
    for (const [stem, first] of Object.entries(pin?.stems ?? {})) {
      stems[stem] = distinctSenses([first, ...(stems[stem] ?? [])]);
    }
    const s = {};
    for (const [stem, senses] of Object.entries(stems)) {
      s[stem] = senses
        .slice(0, GLOSS_LIMITS.senses)
        .map((items) => items.slice(0, GLOSS_LIMITS.senseItems));
    }
    if (Object.keys(s).length > 0) stemmed.push({ lemma: key, count: lemma.count });

    if (g.length === 0 && Object.keys(s).length === 0) continue;
    glosses[key] = {
      g: g.slice(0, GLOSS_LIMITS.items),
      ...(Object.keys(s).length > 0 ? { s } : {}),
    };
  }

  const byCount = (a, b) => b.count - a.count;
  for (const list of [...Object.values(sources), stemmed, noEntry]) list.sort(byCount);
  return { glosses, sources, stemmed, noEntry };
}
