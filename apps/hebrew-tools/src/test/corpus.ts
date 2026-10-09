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

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HebrewBook } from '../data/morphhb';
import { stripCantillation } from '../lib/hebrew-input';

const CORPUS_DIR = join(__dirname, '../../public/data/morphhb');

export const hasCorpus = existsSync(join(CORPUS_DIR, 'GEN.json'));

let cache: Set<string> | undefined;

/** Every word of the text and every morpheme within one, unaccented and NFC. */
export function corpusForms(): Set<string> {
  if (cache) return cache;
  const seen = new Set<string>();
  for (const file of readdirSync(CORPUS_DIR)) {
    if (file === 'books.json' || file === 'lemmas.json') continue;
    const book = JSON.parse(readFileSync(join(CORPUS_DIR, file), 'utf8')) as HebrewBook;
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
