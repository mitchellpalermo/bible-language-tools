// Vocabulary a textbook assigns that the generated list cannot hold. Hand-kept.
//
// `vocabulary.ts` is one entry per MorphGNT lemma. Three headwords of Merkle
// and Plummer's chapter lists are not MorphGNT lemmas, so they had no card:
// ἱερόν and δεῖ (the corpus files them under ἱερός and δέω) and the phrase
// ἐὰν μή. Mitch approved adding these three with the textbook as their source
// (Nov 2026): "The textbook can be its own source of truth for this."
//
// THAT APPROVAL IS FOR THESE THREE ENTRIES. What may come from the book here is
// a headword, its part of speech and a short gloss. No prose, cognate note or
// mnemonic, and the rule for everything else is unchanged: see "Textbook
// chapter decks" in this app's CLAUDE.md. Where Dodson (the lexicon the
// generated list uses) has a close gloss, it is used instead of the book's.
//
// The entries are merged into the app's vocabulary by `vocabulary-all.ts`, so
// regenerating `vocabulary.ts` neither drops nor duplicates them. If the
// generator ever produces one of these words itself, `vocabulary-all.test.ts`
// fails: delete the entry here rather than let it shadow the generated one.
//
// THE SRS KEY IS THE HEADWORD, as for every other word (`normalizeKey(greek)`).
// It is not prefixed. A prefixed key would need every keying site to know about
// supplements, and it would orphan the student's card on the day the generator
// gains the word. With the plain headword the card simply carries over. The
// same test is what keeps a key from colliding with a generated one today.

import type { VocabWord } from './vocabulary';

/** Where a hand-kept entry came from, field by field. */
export interface SupplementSource {
  /** The textbook whose chapter list has the headword. An id in `textbooks.ts`. */
  textbook: string;
  /** `dodson`: the Dodson lexicon's brief gloss. `textbook`: the book's own. */
  gloss: 'dodson' | 'textbook';
  /** How `frequency` was counted from MorphGNT. Recomputed by a corpus test. */
  count: string;
}

export interface SupplementWord extends VocabWord {
  /** Present on a hand-kept entry and absent on a generated one. */
  supplement: SupplementSource;
}

export const TEXTBOOK_SUPPLEMENT: readonly SupplementWord[] = [
  {
    greek: 'ἱερόν',
    gloss: 'a temple',
    frequency: 71,
    partOfSpeech: 'noun',
    supplement: {
      textbook: 'beginning-with-nt-greek',
      gloss: 'dodson',
      count: 'Neuter singular forms MorphGNT files under ἱερός',
    },
  },
  {
    greek: 'δεῖ',
    gloss: 'it is necessary, inevitable',
    frequency: 101,
    partOfSpeech: 'verb',
    supplement: {
      textbook: 'beginning-with-nt-greek',
      gloss: 'dodson',
      count: 'Present and imperfect active forms MorphGNT files under δέω',
    },
  },
  {
    greek: 'ἐὰν μή',
    gloss: 'unless',
    frequency: 47,
    partOfSpeech: 'conjunction',
    supplement: {
      textbook: 'beginning-with-nt-greek',
      gloss: 'textbook',
      count: 'ἐάν directly followed by μή in the same verse',
    },
  },
];
