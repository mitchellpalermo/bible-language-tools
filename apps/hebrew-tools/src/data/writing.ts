// Deck construction and SRS wiring for handwriting practice.
//
// Writing cards live in the SAME store as vocabulary cards
// (`hebrew-tools-srs-v1`), separated only by a key prefix. That is deliberate:
// it means handwriting reviews sync through /api/progress and count toward the
// daily streak from the day the feature ships, with no schema change to
// packages/db, sync-merge, or progress-store.
//
// The cost is a shared key namespace. Vocabulary keys are bare lemmas
// (`normalizeKey(word.hebrew)`), so every non-vocabulary card MUST carry a
// prefix or the two features will collide on a single-letter word.

import { allGlyphs, glyphsInGroup, type ScriptPack, type WritableGlyph } from '@tools/shared/ink';
import { hebrewScriptPack } from './script-pack';
import { isDue, type SRSCard } from './srs';

/** Prefix for every handwriting card key. See the note above. */
export const WRITING_KEY_PREFIX = 'write:letter:';

export function writingCardKey(char: string): string {
  return `${WRITING_KEY_PREFIX}${char}`;
}

export function isWritingKey(key: string): boolean {
  return key.startsWith(WRITING_KEY_PREFIX);
}

/**
 * The trace → copy → recall progression.
 *
 * - `trace`  — the glyph is ghosted on the surface; the student draws over it
 * - `copy`   — the glyph is shown beside an empty surface
 * - `recall` — only the letter's name and sound are given
 *
 * This is the pedagogy the whole feature is built around; the stylus is just
 * how it is delivered.
 */
export type WritingMode = 'trace' | 'copy' | 'recall';

export const WRITING_MODES: { id: WritingMode; label: string; hint: string }[] = [
  { id: 'trace', label: 'Trace', hint: 'Draw over the ghosted letter' },
  { id: 'copy', label: 'Copy', hint: 'The letter is shown; write it yourself' },
  { id: 'recall', label: 'Recall', hint: 'Only the name is given' },
];

export interface WritingDeck {
  id: string;
  label: string;
  glyphs: WritableGlyph[];
}

/**
 * Decks available in the letters drill.
 *
 * Vowel points are excluded — they are their own deck (issue #101) and need
 * the host consonant composed in, which the UI does not do yet.
 */
export function buildDecks(pack: ScriptPack = hebrewScriptPack): WritingDeck[] {
  const consonants = glyphsInGroup(pack, 'consonant');
  const finals = glyphsInGroup(pack, 'final');

  return [
    // 23 cards, not 22: the alphabet has 22 letters, but shin and sin are
    // drilled separately because writing the dot on the correct side is the
    // whole skill.
    { id: 'alphabet', label: 'The alphabet', glyphs: consonants },
    { id: 'finals', label: 'Final forms', glyphs: finals },
    { id: 'all-consonants', label: 'Letters + finals', glyphs: [...consonants, ...finals] },
  ];
}

/**
 * Order a deck for study.
 *
 * Unlike the vocabulary flashcards, this does NOT shuffle. Alphabetical order
 * is part of what is being learned — a student who can write every letter but
 * cannot recite the alphabet in order has not learned the alphabet. Due cards
 * come first, but each group keeps its pack order.
 */
export function buildQueue(
  glyphs: WritableGlyph[],
  store: Record<string, SRSCard>,
  mode: 'srs' | 'all' = 'srs',
): WritableGlyph[] {
  if (mode === 'all') return [...glyphs];

  const due: WritableGlyph[] = [];
  const fresh: WritableGlyph[] = [];

  for (const g of glyphs) {
    const card = store[writingCardKey(g.char)];
    if (!card) fresh.push(g);
    else if (isDue(card)) due.push(g);
  }

  return [...due, ...fresh];
}

/** The four self-assessment buttons, mapped to SM-2 quality scores. */
export type WritingGrade = 'again' | 'hard' | 'good' | 'easy';

export const WRITING_GRADES: { id: WritingGrade; label: string; quality: number }[] = [
  { id: 'again', label: 'Again', quality: 1 },
  { id: 'hard', label: 'Hard', quality: 3 },
  { id: 'good', label: 'Good', quality: 4 },
  { id: 'easy', label: 'Easy', quality: 5 },
];

export function qualityFor(grade: WritingGrade): number {
  return WRITING_GRADES.find(g => g.id === grade)?.quality ?? 1;
}

/**
 * Whether a grade counts as correct for streak and accuracy purposes.
 *
 * Mirrors SM-2's own threshold: quality < 3 resets the repetition count, so
 * anything below 3 is a lapse.
 */
export function isPassingGrade(grade: WritingGrade): boolean {
  return qualityFor(grade) >= 3;
}

/** How many glyphs in a deck have never been written. */
export function countNew(glyphs: WritableGlyph[], store: Record<string, SRSCard>): number {
  return glyphs.filter(g => !store[writingCardKey(g.char)]).length;
}

/** Every writing card currently in the store, for progress display. */
export function writingCards(store: Record<string, SRSCard>): SRSCard[] {
  return Object.entries(store)
    .filter(([key]) => isWritingKey(key))
    .map(([, card]) => card);
}

/** All practiceable glyphs in a pack, including the vowels not yet drilled. */
export function practiceableGlyphs(pack: ScriptPack = hebrewScriptPack): WritableGlyph[] {
  return allGlyphs(pack);
}
