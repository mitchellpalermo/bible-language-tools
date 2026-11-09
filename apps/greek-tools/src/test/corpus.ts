// The Greek New Testament (MorphGNT) as a second witness for hand-entered forms.
//
// A paradigm cell is typed in by hand, and that is where a wrong accent or a
// missing iota subscript creeps in. Looking each form up in the text catches the
// slip without making the corpus the authority: a regular form is regular
// whether or not the New Testament happens to use it, so each caller keeps a
// named list of the forms it knows to be unattested. A new unattested form is
// what a typo looks like.
//
// The corpus is gitignored and built by `pnpm build:data`, so these checks run
// only where it exists; guard the suite with `describe.skipIf(!hasCorpus)` so a
// fresh checkout can still run the tests. CI builds it first
// (`.github/workflows/greek-tools.yml`), and `corpus.test.ts` fails there if it
// is missing, so the gate cannot quietly turn back into a skip.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripDiacritics } from '../lib/greek-input';

const CORPUS_DIR = join(__dirname, '../../public/data/morphgnt');

export const hasCorpus = existsSync(join(CORPUS_DIR, 'books.json'));

export interface CorpusWord {
  /** The word as written, with punctuation and the text's grave accents removed. */
  form: string;
  lemma: string;
  /** MorphGNT's eight-position parse: person, tense, voice, mood, case, number, gender, degree. */
  parsing: string;
}

const GRAVE_TO_ACUTE: Record<string, string> = {
  ὰ: 'ά',
  ὲ: 'έ',
  ὴ: 'ή',
  ὶ: 'ί',
  ὸ: 'ό',
  ὺ: 'ύ',
  ὼ: 'ώ',
  ἂ: 'ἄ',
  ἃ: 'ἅ',
  ἒ: 'ἔ',
  ἓ: 'ἕ',
  ἢ: 'ἤ',
  ἣ: 'ἥ',
  ἲ: 'ἴ',
  ἳ: 'ἵ',
  ὂ: 'ὄ',
  ὃ: 'ὅ',
  ὒ: 'ὔ',
  ὓ: 'ὕ',
  ὢ: 'ὤ',
  ὣ: 'ὥ',
};

/**
 * Words are written with a grave accent before another word, where the
 * paradigm gives the acute. Both are the same word, so the text is read with
 * the acute, and the punctuation MorphGNT keeps on a word is dropped.
 */
export function plainForm(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[.,;·!?—"'“”‘’()[\]]/g, '')
    .replace(/[ὰὲὴὶὸὺὼἂἃἒἓἢἣἲἳὂὃὒὓὢὣ]/g, (c) => GRAVE_TO_ACUTE[c] ?? c);
}

let cache: CorpusWord[] | undefined;

/** Every word of the text, once. */
export function corpusWords(): CorpusWord[] {
  if (cache) return cache;
  const words: CorpusWord[] = [];
  const index = JSON.parse(readFileSync(join(CORPUS_DIR, 'books.json'), 'utf8')) as {
    code: string;
  }[];
  for (const { code } of index) {
    const book = JSON.parse(readFileSync(join(CORPUS_DIR, `${code}.json`), 'utf8')) as Record<
      string,
      Record<string, { text: string; lemma: string; parsing: string }[]>
    >;
    for (const chapter of Object.values(book)) {
      for (const verse of Object.values(chapter)) {
        for (const w of verse) {
          words.push({ form: plainForm(w.text), lemma: w.lemma, parsing: w.parsing });
        }
      }
    }
  }
  cache = words;
  return words;
}

/** The same word without accents, breathings or subscripts, lowercase: for a "letters only" comparison. */
export const bareLetters = (s: string): string => stripDiacritics(s).toLowerCase();
