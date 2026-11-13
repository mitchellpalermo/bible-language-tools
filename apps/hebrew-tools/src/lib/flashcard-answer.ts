// Which way a flashcard is asked, and how a typed answer is marked (#74).
//
// Pure: no React, no storage. The session that deals the cards is
// `useFlashcardSession` in @tools/shared; this is the part of it that is Hebrew.
//
// Two things here are pedagogy rather than plumbing:
//
// **A direction can only ask a word it has a prompt for.** Transliterations
// exist on the hand-curated words alone (see "Textbook chapter decks" in this
// app's CLAUDE.md), and a few glosses quote the Hebrew they translate. Such a
// word is left out of the deck in that direction. It is never asked some other
// way instead: a prompt that silently changes kind is worse than a smaller
// deck. Same rule as /write's word mode.
//
// **A mark is information, never the answer.** `markTypedAnswer` says how the
// typed text compares; the student still picks the grade.

import { checkGlossAnswer } from '@tools/shared/gloss-answer';
import type { HebrewVocabWord } from '../data/vocabulary-types';
import { glossPrompt } from './gloss-prompt';
import { type AnswerResult, applyFinalForms, checkHebrewAnswer } from './hebrew-input';

export type Direction = 'he-en' | 'en-he' | 'translit-he';

export const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: 'he-en', label: 'Hebrew → English' },
  { id: 'en-he', label: 'English → Hebrew' },
  { id: 'translit-he', label: 'Transliteration → Hebrew' },
];

/** Whether the answer side is the Hebrew word, so a typed answer is Hebrew. */
export function asksForHebrew(direction: Direction): boolean {
  return direction !== 'he-en';
}

/** What the front of the card shows, or null when this word cannot be asked that way. */
export function frontText(word: HebrewVocabWord, direction: Direction): string | null {
  if (direction === 'he-en') return word.hebrew;
  if (direction === 'translit-he') return word.transliteration ?? null;
  return glossPrompt(word.gloss);
}

export function canAsk(word: HebrewVocabWord, direction: Direction): boolean {
  return frontText(word, direction) !== null;
}

// ─── Marking ──────────────────────────────────────────────────────────────────

/** A typed answer, marked. Kept whole so the feedback does not depend on later state. */
export interface TypedMark {
  result: AnswerResult;
  /** The answer the card was looking for, as it is shown back to the student. */
  answer: string;
  /** What was typed, as it appeared in the field. */
  typed: string;
  /** Whether `answer` and `typed` are Hebrew. */
  hebrew: boolean;
}

/** Best first: the mark a typed form earns is its best against any accepted spelling. */
const RANK: AnswerResult[] = ['correct', 'dagesh-only', 'nikud-only', 'wrong'];

const MAQQEF = /־/g;

/**
 * A maqqef joins two words and the keyboard mapping has no key for it, so
 * בַּת־שֶׁבַע is typed with a space. Both sides are compared that way.
 */
function hebrewForComparison(text: string): string {
  return text.replace(MAQQEF, ' ').replace(/\s+/g, ' ').trim();
}

function markSpelling(typed: string, word: HebrewVocabWord): AnswerResult {
  if (typed.length === 0) return 'wrong';
  const results = [word.hebrew, ...(word.alternates ?? [])].map((answer) =>
    checkHebrewAnswer(typed, hebrewForComparison(answer)),
  );
  return RANK.find((rank) => results.includes(rank)) ?? 'wrong';
}

/**
 * Mark typed Hebrew against a word's headword and the alternates the textbook
 * lists for it, and say which spelling of the input earned the mark.
 *
 * `input` is the raw value of a `useHebrewInput` field, where a word's last
 * letter is stored in its ordinary form and shown as a final. So the input is
 * marked with final forms applied, which is what the student saw. It is also
 * marked as typed, because the inseparable preposition כְּ is a whole entry
 * that ends in a kaf which is not final: it is a prefix, and the field cannot
 * know that. The better mark stands.
 */
function markHebrewInput(
  input: string,
  word: HebrewVocabWord,
): { result: AnswerResult; typed: string } {
  const raw = hebrewForComparison(input);
  const shown = applyFinalForms(raw);
  const asShown = markSpelling(shown, word);
  const asTyped = markSpelling(raw, word);
  return RANK.indexOf(asTyped) < RANK.indexOf(asShown)
    ? { result: asTyped, typed: raw }
    : { result: asShown, typed: shown };
}

export function markHebrew(input: string, word: HebrewVocabWord): AnswerResult {
  return markHebrewInput(input, word).result;
}

const STEM_LABEL = /^\s*[A-Z][a-z]+:\s*/;
const ASIDES = /\([^()]*\)/g;
const QUOTES = /[“”"]/g;
const SUBJECT = /^(he|she|it|they|i|you|we)\s+/i;

/**
 * Other wordings of one sense of a gloss that a student may fairly type.
 *
 * The vocabulary's glosses carry more than a bare word: a verb's citation form
 * is glossed as the form it is ("he wrote"), a verb listed across stems labels
 * each ("Qal: he went up"), and the textbook's asides sit in parentheses
 * ("(qatal 1cs) I fed"). Each is right on a card back and none of it should be
 * needed in a typed answer, so "wrote" and "fed" are accepted.
 */
export function glossVariants(sense: string): string[] {
  const bare = sense
    .replace(STEM_LABEL, '')
    .replace(ASIDES, ' ')
    .replace(QUOTES, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [bare, bare.replace(SUBJECT, '')];
}

/** Senses are divided by commas and slashes, and stems by semicolons. */
const SENSE_SEPARATORS = /[,/;]/;

export function markGloss(input: string, word: HebrewVocabWord): AnswerResult {
  return checkGlossAnswer(input, word.gloss, {
    separators: SENSE_SEPARATORS,
    variants: glossVariants,
  })
    ? 'correct'
    : 'wrong';
}

/** Mark a typed answer for the card as it is being asked. */
export function markTypedAnswer(
  input: string,
  word: HebrewVocabWord,
  direction: Direction,
): TypedMark {
  if (asksForHebrew(direction)) {
    return { ...markHebrewInput(input, word), answer: word.hebrew, hebrew: true };
  }
  return { result: markGloss(input, word), answer: word.gloss, typed: input.trim(), hebrew: false };
}
