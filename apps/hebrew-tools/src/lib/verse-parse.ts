// The verbs of one verse as parse items, for the quiz on /daily. Pure.
//
// /parse asks forms from a pool built at build time (`scripts/lib/parse-forms.mjs`);
// /daily asks the verbs of the verse on the page. The rule for which words can
// be asked is the pool's, so a verb is asked on /daily exactly when its kind of
// word could be asked on /parse: a Hebrew verb in one of the seven stems, fully
// coded, with nothing after it (no object suffix, no paragogic letter), not a
// ketiv, and not a jussive or cohortative (`readVerbMorph` reads neither). The
// pool's floor of 50 occurrences is not applied: a rare verb in the verse is
// still the verse's verb.
//
// The app cannot import the build's `.mjs`, so `isAskableVerb` and
// `parseLemmaOf` are copies of `poolVerbCode` and `rootOf`, and
// `verse-parse.test.ts` pins each copy to the script's.

import type { HebrewWord, LemmaEntry } from '../data/morphhb';
import { stripCantillation } from './hebrew-input';
import { type ParseItem, type ParseLemma, readVerbMorph, STEM_LETTERS } from './verb-parse';

/** A verb of the verse, and where it sits in the verse's words. */
export interface VerseParseItem extends ParseItem {
  wordIndex: number;
}

/** Whether a word is one the pool's rule allows. Mirrors `poolVerbCode`. */
export function isAskableVerb(word: HebrewWord): boolean {
  if (!word.parsing.startsWith('H') || word.ketiv || word.qereOnly) return false;
  const segments = word.parsing.slice(1).split('/');
  const at = segments.findIndex((s) => s[0] === 'V');
  if (at === -1 || at !== segments.length - 1) return false;
  const code = segments[at];
  return code[1] in STEM_LETTERS && code.length >= 3;
}

/** The form a student is shown: pointed, unaccented, NFC, prefixes included. */
export function parseFormOf(word: HebrewWord): string {
  return stripCantillation(word.text).normalize('NFC').replace(/\//g, '');
}

/**
 * The verse's verbs, in text order. Each carries the one reading the verse
 * gives it, so the quiz grades it in context (`gradeParse`'s `inContext`).
 */
export function verseVerbs(words: readonly HebrewWord[]): VerseParseItem[] {
  return words.flatMap((word, wordIndex) => {
    if (!isAskableVerb(word)) return [];
    const reading = readVerbMorph(word.lemma, word.parsing.slice(1));
    return reading ? [{ form: parseFormOf(word), readings: [reading], wordIndex }] : [];
  });
}

/** A lemma's headword and root, as the pool would carry them. Mirrors `rootOf`. */
export function parseLemmaOf(entry: LemmaEntry | undefined): ParseLemma | undefined {
  if (!entry) return undefined;
  const headword = entry.hebrew ?? '';
  return { headword, root: entry.root || headword.replace(/[^א-תׁׂ]/g, '') };
}

/** The lemma table the grading reads, for just these items. */
export function verseLemmas(
  items: readonly ParseItem[],
  index: Record<string, LemmaEntry>,
): Record<string, ParseLemma> {
  const out: Record<string, ParseLemma> = {};
  for (const item of items) {
    for (const { lemma } of item.readings) {
      const entry = parseLemmaOf(index[lemma]);
      if (entry) out[lemma] = entry;
    }
  }
  return out;
}
