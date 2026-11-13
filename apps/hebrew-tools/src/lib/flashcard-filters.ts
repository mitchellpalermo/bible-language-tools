// The part-of-speech and root filters on /flashcards (#74).
//
// Pure: they narrow whatever deck is selected (the whole vocabulary, a
// textbook's chapters, a custom or passage deck) and know nothing about which.
//
// **Roots are the vocabulary's own `root` field and nothing else.** It comes
// from the OSHB lexicon through `scripts/build-vocabulary.mjs`, or is
// hand-entered on a curated word. About a quarter of the vocabulary has none
// (most particles and proper names, and nouns the lexicon gives no root for),
// and such a word matches no root filter. Nothing here derives a root from a
// headword: a guessed root is an error the data tests cannot catch.

import type { HebrewVocabWord } from '../data/vocabulary-types';
import { FINAL_FORM_MAP, stripAllDiacritics } from './hebrew-input';

export interface CardFilters {
  /** Parts of speech to keep. Empty keeps every one. */
  partsOfSpeech: string[];
  /** Roots to keep. Empty keeps every word, with or without a root. */
  roots: string[];
}

export const NO_FILTERS: CardFilters = { partsOfSpeech: [], roots: [] };

export function hasFilters(filters: CardFilters): boolean {
  return filters.partsOfSpeech.length > 0 || filters.roots.length > 0;
}

export function matchesFilters(word: HebrewVocabWord, filters: CardFilters): boolean {
  const { partsOfSpeech, roots } = filters;
  if (partsOfSpeech.length > 0 && !partsOfSpeech.includes(word.partOfSpeech)) return false;
  if (roots.length > 0 && (word.root === undefined || !roots.includes(word.root))) return false;
  return true;
}

/** Add `value` to the list, or remove it if it is there. */
export function toggled(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// ─── Part of speech ───────────────────────────────────────────────────────────

/** The order the chips are drawn in: the open classes first, as on greek.tools. */
const PART_OF_SPEECH_ORDER = [
  'noun',
  'verb',
  'adjective',
  'preposition',
  'conjunction',
  'adverb',
  'particle',
  'proper noun',
];

export interface Count {
  value: string;
  count: number;
}

/** The parts of speech present in `words`, with how many words each has. */
export function partOfSpeechCounts(words: readonly HebrewVocabWord[]): Count[] {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word.partOfSpeech, (counts.get(word.partOfSpeech) ?? 0) + 1);
  const rank = (pos: string) => {
    const at = PART_OF_SPEECH_ORDER.indexOf(pos);
    return at === -1 ? PART_OF_SPEECH_ORDER.length : at;
  };
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => rank(a.value) - rank(b.value) || a.value.localeCompare(b.value));
}

// ─── Roots ────────────────────────────────────────────────────────────────────

/** The roots present in `words`, the largest word family first. */
export function rootCounts(words: readonly HebrewVocabWord[]): Count[] {
  const counts = new Map<string, number>();
  for (const word of words) {
    if (word.root !== undefined) counts.set(word.root, (counts.get(word.root) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'he'));
}

const NON_FINAL = Object.fromEntries(
  Object.entries(FINAL_FORM_MAP).map(([plain, final]) => [final, plain]),
);

/**
 * A root reduced to what a search compares: bare consonants, no final forms.
 *
 * A root is stored with its shin or sin dot (שׁמע) and its last letter in final
 * form (מלך). A search is typed a letter at a time, where the field shows the
 * last letter typed as a final (אמ reads אם on the way to אמר) and nobody
 * types the dot. Without this neither would find its root.
 */
export function rootSearchKey(text: string): string {
  return [...stripAllDiacritics(text)]
    .filter((ch) => !/\s/.test(ch))
    .map((ch) => NON_FINAL[ch] ?? ch)
    .join('');
}

/** How many roots are offered before anything is typed. */
export const ROOT_SUGGESTIONS = 12;
/** How many roots a search shows. */
export const ROOT_SEARCH_LIMIT = 24;

/**
 * The roots to offer as chips.
 *
 * With nothing typed: the largest word families, which is what a root filter
 * is for. A root with a single word is a filter that deals one card, so those
 * are found by typing. With a query: the roots that begin with it, then the
 * ones that contain it. Selected roots are always listed, first, so each can
 * be switched off again whatever the deck now holds.
 */
export function rootChoices(roots: readonly Count[], query: string, selected: readonly string[]) {
  const key = rootSearchKey(query);
  const found =
    key.length === 0
      ? roots.filter((r) => r.count > 1).slice(0, ROOT_SUGGESTIONS)
      : [
          ...roots.filter((r) => rootSearchKey(r.value).startsWith(key)),
          ...roots.filter((r) => rootSearchKey(r.value).indexOf(key) > 0),
        ].slice(0, ROOT_SEARCH_LIMIT);
  const chosen = selected.map(
    (value) => roots.find((r) => r.value === value) ?? { value, count: 0 },
  );
  return [...chosen, ...found.filter((r) => !selected.includes(r.value))];
}
