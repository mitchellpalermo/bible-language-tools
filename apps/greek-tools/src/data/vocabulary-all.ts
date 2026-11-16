// The vocabulary the app studies: the generated list plus the hand-kept
// textbook supplement.
//
// `vocabulary.ts` is generated from MorphGNT and Dodson and is never edited.
// `vocabulary-textbook.ts` holds the few words a textbook assigns that the
// generator cannot produce. This module merges the two, most frequent first,
// as the generated list is.
//
// WHICH LIST TO IMPORT:
// - Anything that deals, lists or counts cards imports `vocabulary` from HERE:
//   /flashcards, the textbook decks, the deck builder, Today's Session.
// - Anything that looks a MorphGNT lemma up (the reader's word popup, the
//   book and passage decks) imports the generated list. A supplement word is
//   not a MorphGNT lemma, so it could never match there.

import { type VocabWord as GeneratedWord, vocabulary as generated } from './vocabulary';
import { type SupplementSource, TEXTBOOK_SUPPLEMENT } from './vocabulary-textbook';

/** A word of the vocabulary. `supplement` is set only on a hand-kept entry. */
export interface VocabWord extends GeneratedWord {
  supplement?: SupplementSource;
}

/**
 * The generated list with the supplement merged in by frequency. A supplement
 * word goes after the generated words of the same count, so the generated
 * order is undisturbed.
 */
export function mergeVocabulary(
  base: readonly GeneratedWord[],
  supplement: readonly VocabWord[],
): VocabWord[] {
  const merged: VocabWord[] = [...base];
  for (const word of supplement) {
    const at = merged.findIndex((w) => w.frequency < word.frequency);
    merged.splice(at === -1 ? merged.length : at, 0, word);
  }
  return merged;
}

export const vocabulary: VocabWord[] = mergeVocabulary(generated, TEXTBOOK_SUPPLEMENT);
