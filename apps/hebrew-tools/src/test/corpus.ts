// The Westminster Leningrad Codex as a second witness for hand-entered forms.
//
// A paradigm cell or a grammar example is typed in by hand, and that is exactly
// the kind of thing that goes wrong by one vowel. Looking each form up in the
// text catches the slip without making the corpus the authority — a regular
// form is regular whether or not Scripture happens to use it, so each caller
// keeps a named list of the forms it knows to be unattested. **A new
// unattested form is what a typo looks like.**
//
// The corpus is 24 MB and gitignored, so these checks run only where
// `pnpm build:data` has been run; guard the suite with
// `describe.skipIf(!hasCorpus)` so a fresh checkout can still run the tests.
// CI builds the corpus before the tests (`.github/workflows/hebrew-tools.yml`),
// which is what makes this a gate — and `corpus.test.ts` fails there if the
// corpus is missing, so the gate cannot quietly turn back into a skip.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HebrewBook, HebrewBookMeta } from '../data/morphhb';
import type { Conjugation, FormKey, Stem } from '../data/verb-paradigms';
import { stripCantillation } from '../lib/hebrew-input';

const CORPUS_DIR = join(__dirname, '../../public/data/morphhb');

export const hasCorpus = existsSync(join(CORPUS_DIR, 'GEN.json'));

let cache: Set<string> | undefined;

/** Every word of the text and every morpheme within one, unaccented and NFC. */
export function corpusForms(): Set<string> {
  if (cache) return cache;
  const seen = new Set<string>();
  // The book list, not the directory: the folder also holds the lemma index
  // and the glosses, and a listing that skipped known non-books by name read
  // the next one added as a book.
  const index = JSON.parse(
    readFileSync(join(CORPUS_DIR, 'books.json'), 'utf8'),
  ) as HebrewBookMeta[];
  for (const { code } of index) {
    const book = JSON.parse(readFileSync(join(CORPUS_DIR, `${code}.json`), 'utf8')) as HebrewBook;
    for (const chapter of Object.values(book)) {
      for (const verse of Object.values(chapter)) {
        for (const word of verse) {
          const text = stripCantillation(word.text).normalize('NFC');
          seen.add(text.replaceAll('/', ''));
          for (const morpheme of text.split('/')) seen.add(morpheme);
        }
      }
    }
  }
  cache = seen;
  return seen;
}

/** A form as the text would write it: no stress mark, NFC. */
export function plainForm(form: string): string {
  return stripCantillation(form).normalize('NFC');
}

/**
 * The form as it reads after a word ending in a vowel, where a begadkephat
 * first letter loses its dagesh lene: the paradigm's בָּנִיתָ is the text's
 * לֹא־בָנִיתָ. Only the first dagesh can be a dagesh lene at the head of a word.
 */
export function spirantized(form: string): string {
  return plainForm(form).replace(/^([א-ת][ְ-ֻ]*)ּ/, '$1');
}

/**
 * Whether the text has this form. A phrase joined by maqqef or spaces is
 * attested when each of its words is — the corpus stores words, not phrases.
 */
export function isAttested(form: string): boolean {
  const corpus = corpusForms();
  return plainForm(form)
    .split(/[־\s]+/)
    .every((word) => corpus.has(word) || corpus.has(spirantized(word)));
}

// ─── The parse-aware gate (6d, #153) ──────────────────────────────────────────
//
// `isAttested` asks only whether a spelling occurs, which is too weak for a verb
// table: תִּכְתֹּב is both the 3fs and the 2ms yiqtol, so a form typed into the
// wrong cell still passes. `attestation` asks whether the spelling occurs *as
// that form*, by its OSHB parse, and when it does not, whether it occurs as
// something else — which is what a wrong-cell slip looks like.

/**
 * The app's terms in OSHB's letters, in one place. A conjugation lists every
 * letter whose forms it shares a spelling with: in a strong verb the jussive is
 * spelled as the yiqtol, so a yiqtol cell is attested by either.
 */
export const OSHB_STEM: Record<Stem, string> = { qal: 'q' };
export const OSHB_CONJUGATION: Record<Conjugation, string[]> = {
  qatal: ['p'],
  yiqtol: ['i', 'j'],
  wayyiqtol: ['w'],
  weqatal: ['q'],
  imperative: ['v'],
  'infinitive-construct': ['c'],
  'infinitive-absolute': ['a'],
  'participle-active': ['r'],
  'participle-passive': ['s'],
};

/** OSHB's sequential conjugations, whose waw belongs to the form. */
const SEQUENTIAL = new Set(['w', 'q']);

/** A Hebrew verb parse as `<stem><conjugation><features>`: `qw3ms`, `qrmsa`, `qc`. */
type VerbParse = string;

let parseCache: Map<string, Set<VerbParse>> | undefined;

/**
 * Every spelling a Hebrew verb takes in the text, with the parses it takes
 * them under. A word is indexed whole (וַיִּכְתֹּב, which is how a wayyiqtol or
 * weqatal cell is spelled) and as its verb morpheme alone (כְתֹב after a
 * conjunction), both with the verb's parse. Aramaic is left out: its stem
 * letters mean other things.
 */
export function corpusVerbParses(): Map<string, Set<VerbParse>> {
  if (parseCache) return parseCache;
  const index = new Map<string, Set<VerbParse>>();
  const add = (text: string, parse: VerbParse) => {
    const set = index.get(text) ?? new Set();
    set.add(parse);
    index.set(text, set);
  };
  const books = JSON.parse(
    readFileSync(join(CORPUS_DIR, 'books.json'), 'utf8'),
  ) as HebrewBookMeta[];
  for (const { code } of books) {
    const book = JSON.parse(readFileSync(join(CORPUS_DIR, `${code}.json`), 'utf8')) as HebrewBook;
    for (const chapter of Object.values(book)) {
      for (const verse of Object.values(chapter)) {
        for (const word of verse) {
          if (!word.parsing.startsWith('H')) continue;
          const codes = word.parsing.slice(1).split('/');
          const at = codes.findIndex((c) => c.startsWith('V'));
          if (at === -1) continue;
          const parse = codes[at].slice(1);
          const text = stripCantillation(word.text).normalize('NFC');
          add(text.replaceAll('/', ''), parse);
          // A wayyiqtol's or weqatal's waw is part of the form: the verb
          // morpheme without it is no form at all, and indexed under that
          // parse it would vouch for a yiqtol or qatal cell spelled the same.
          if (SEQUENTIAL.has(parse[1])) continue;
          const morpheme = text.split('/')[at];
          if (morpheme) add(morpheme, parse);
        }
      }
    }
  }
  parseCache = index;
  return index;
}

/** Whether a parse is this cell's: stem, a conjugation letter, and the key. */
function parseMatches(parse: VerbParse, stem: Stem, conjugation: Conjugation, key: FormKey) {
  if (parse[0] !== OSHB_STEM[stem] || !OSHB_CONJUGATION[conjugation].includes(parse[1])) {
    return false;
  }
  const features = parse.slice(2);
  if (key === 'inf') return features === '';
  // A participle's third letter is its state; the spelling already says which.
  if (key.length === 2) return features.slice(0, 2) === key;
  return features === key;
}

export type Attestation = 'as-this-form' | 'as-another-form' | 'unattested';

/**
 * How the text attests a verb cell, with `isAttested`'s leniency: no stress
 * mark, and an optional leading dagesh lene.
 */
export function attestation(
  form: string,
  cell: { stem: Stem; conjugation: Conjugation; key: FormKey },
): Attestation {
  const index = corpusVerbParses();
  const parses = [...(index.get(plainForm(form)) ?? []), ...(index.get(spirantized(form)) ?? [])];
  if (parses.length === 0) return 'unattested';
  return parses.some((p) => parseMatches(p, cell.stem, cell.conjugation, cell.key))
    ? 'as-this-form'
    : 'as-another-form';
}
