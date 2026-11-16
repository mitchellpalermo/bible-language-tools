/**
 * The form pool behind `/parse` (#82): every verb form the Westminster
 * Leningrad Codex writes, with every parse it gives that spelling.
 *
 * Pure: it reads the per-book JSON `build-morphhb.mjs` has already written and
 * returns what goes in `parse-forms.json`. The build runs it whether or not it
 * refetched the corpus, so an older checkout with the books already present
 * still gets the file.
 *
 * What is in the pool, and why each rule is there:
 *
 * - **Hebrew verbs only.** Daniel's and Ezra's Aramaic verbs use the same stem
 *   letters for different stems (`Vp` is Pael), and a first-year course does
 *   not teach them.
 * - **The seven stems a course teaches**: Qal, Niphal, Piel, Pual, Hithpael,
 *   Hiphil, Hophal. Polel, Pilpel, Qal passive and the rest (616 words) are
 *   left out rather than offered as an eighth choice nobody has learned.
 * - **No suffix after the verb.** A verb with an object suffix (7,785 words) or
 *   a paragogic letter is a second skill, and the drill asks nothing about the
 *   suffix. Prefixes stay: וַיֹּאמֶר is the most common verb form in the Bible
 *   and its ו is what makes it a wayyiqtol.
 * - **No ketiv.** Its `text` is unpointed consonants; there is nothing to parse.
 * - **Verbs occurring at least `MIN_LEMMA_COUNT` times.** A first-year student
 *   parses the verbs a course teaches, which are the common ones, and a hapax
 *   is a lexicon look-up rather than a parse.
 * - **No jussive or cohortative, for now** (`withoutVolitives`).
 *
 * A spelling is one item, with every reading the corpus gives it (`Vqi3ms` and
 * `Vqi3fs` for תֹּאכַל; Qal and Hiphil for וַיַּרְא). The drill accepts any of
 * them: out of context the student cannot know which one a given verse meant.
 */

import { stripCantillation } from './oshb.mjs';

/** OSHB stem letter → the stem id the app uses (`STEM_NAMES` in stem-patterns.ts). */
export const PARSE_STEM_LETTERS = {
  q: 'qal',
  N: 'niphal',
  p: 'piel',
  P: 'pual',
  t: 'hithpael',
  h: 'hiphil',
  H: 'hophal',
};

/** A verb whose lemma occurs fewer times than this is left out of the pool. */
export const MIN_LEMMA_COUNT = 50;

/**
 * The verb segment of a Hebrew word, if the word belongs in the pool: a verb in
 * one of the seven stems, fully coded, with nothing after it. `null` otherwise.
 */
export function poolVerbCode(word) {
  if (!word.parsing.startsWith('H') || word.ketiv || word.qereOnly) return null;
  const segments = word.parsing.slice(1).split('/');
  const at = segments.findIndex((s) => s[0] === 'V');
  if (at === -1 || at !== segments.length - 1) return null;
  const code = segments[at];
  if (!(code[1] in PARSE_STEM_LETTERS) || code.length < 3) return null;
  return code;
}

/** The root a student would write: the lexicon's, else the headword's consonants. */
export function rootOf(entry) {
  if (entry.root) return entry.root;
  return (entry.hebrew ?? '').replace(/[^א-תׁׂ]/g, '');
}

/** Conjugations a prefix decides: never borrowed from another spelling. */
const PREFIX_BOUND = new Set(['q', 'w']);

/**
 * Readings the same verb letters carry inside other words, with a count of 0.
 *
 * שְׁמֹר stands alone in the text only as an imperative, but the same letters
 * are an infinitive construct in לִשְׁמֹר; out of context both are right. The
 * match is on exact pointed letters, so a dagesh or vowel a prefix changes
 * simply finds no witness. Weqatal and wayyiqtol are never borrowed: they are
 * what the ו in front makes of the letters, and a bare form has none. The
 * caller borrows only for a bare form, never into a prefixed one.
 */
export function witnessed(own, verbReadings) {
  if (!verbReadings) return [];
  const have = new Set(own.map(([lemma, morph]) => `${lemma}|${morph.split('/').at(-1)}`));
  return [...verbReadings.keys()]
    .filter((key) => !have.has(key) && !PREFIX_BOUND.has(key.split('|')[1][2]))
    .sort()
    .map((key) => [...key.split('|'), 0]);
}

/** OSHB's conjugation letters for the cohortative and the jussive. */
const VOLITIVE = new Set(['h', 'j']);

const conjugationLetter = (morph) => morph.split('/').at(-1)[2];
const isVolitive = (reading) => VOLITIVE.has(conjugationLetter(reading[1]));

/**
 * A spelling's readings with the jussive and cohortative taken out (Mitch,
 * Nov 2026: "keep the jussive and cohortative off of this for now"). Out of
 * context they are mostly a yiqtol's letters read by the verse, and the drill
 * has no fair way to ask for them yet.
 *
 * A spelling the text uses mostly as a jussive or cohortative is kept only if
 * the text also reads that same spelling as a yiqtol, and then it is filed as
 * that yiqtol (its first reading). Otherwise it is left out (`[]`). A spelling
 * filed under anything else just loses its volitive readings.
 */
export function withoutVolitives(readings) {
  const rest = readings.filter((r) => !isVolitive(r));
  if (readings.length === 0 || !isVolitive(readings[0])) return rest;
  const yiqtol = rest.find((r) => r[2] > 0 && conjugationLetter(r[1]) === 'i');
  return yiqtol ? [yiqtol, ...rest.filter((r) => r !== yiqtol)] : [];
}

/**
 * Build `parse-forms.json`.
 *
 * `books` is every book's chapters (`{ [ch]: { [v]: HebrewWord[] } }`);
 * `lemmas` is `lemmas.json`. Returns
 * `{ lemmas: { [lemma]: [headword, root] }, forms: [[form, [[lemma, morph, count], …]], …] }`.
 * `morph` is the OSHB code without its language letter (`C/Vqw3ms`). The
 * spelling's own readings come first, most frequent first; then the readings
 * its verb letters carry elsewhere, with a count of 0 (`witnessed`). Forms are
 * in the order the text first uses them, so the file is stable for an
 * unchanged corpus.
 */
export function buildParseForms(books, lemmas, minCount = MIN_LEMMA_COUNT) {
  /** form → (lemma|morph → count). `morph` is the whole code, prefixes included. */
  const byForm = new Map();
  /** the verb morpheme's own letters → (lemma|verb code → count) */
  const byVerbText = new Map();
  /** form → its verb morpheme's letters */
  const verbTextOf = new Map();

  const tally = (map, outer, key) => {
    const inner = map.get(outer) ?? new Map();
    inner.set(key, (inner.get(key) ?? 0) + 1);
    map.set(outer, inner);
  };

  for (const chapters of books) {
    for (const verses of Object.values(chapters)) {
      for (const words of Object.values(verses)) {
        for (const word of words) {
          const code = poolVerbCode(word);
          if (!code) continue;
          const entry = lemmas[word.lemma];
          if (!entry || entry.count < minCount || !entry.hebrew) continue;
          // NFC: the WLC writes a dagesh before a holam, and a form typed or
          // compared anywhere else in the app is NFC.
          const text = stripCantillation(word.text).normalize('NFC');
          const form = text.replace(/\//g, '');
          const verbText = text.split('/').at(-1);
          tally(byForm, form, `${word.lemma}|${word.parsing.slice(1)}`);
          tally(byVerbText, verbText, `${word.lemma}|${code}`);
          verbTextOf.set(form, verbText);
        }
      }
    }
  }

  const byCount = (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]);
  const forms = [];
  for (const [form, readings] of byForm) {
    const own = [...readings].sort(byCount).map(([key, count]) => [...key.split('|'), count]);
    // Only a bare form borrows: a reading of the letters alone says nothing
    // about them behind a prefix (the imperative שְׁמֹר is no reading of לִשְׁמֹר).
    const verbText = verbTextOf.get(form);
    const borrowed = verbText === form ? witnessed(own, byVerbText.get(verbText)) : [];
    const kept = withoutVolitives([...own, ...borrowed]);
    if (kept.length > 0) forms.push([form, kept]);
  }

  const lemmaTable = Object.fromEntries(
    [...new Set(forms.flatMap(([, rs]) => rs.map(([lemma]) => lemma)))]
      .sort()
      .map((lemma) => [lemma, [lemmas[lemma].hebrew, rootOf(lemmas[lemma])]]),
  );

  return { lemmas: lemmaTable, forms };
}
