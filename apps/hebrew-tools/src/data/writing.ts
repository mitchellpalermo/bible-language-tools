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
// prefix or the two features will collide on a single-letter word. Handwriting
// spends two of them — `write:letter:` and `write:nikud:` — for the reason
// given at `KEY_PREFIX`.

import {
  allGlyphs,
  glyphsInGroup,
  type ScriptPack,
  VERDICT_THRESHOLDS,
  type WritableGlyph,
} from '@tools/shared/ink';
import { hebrewScriptPack } from './script-pack';
import { isDue, type SRSCard } from './srs';

/**
 * Prefix per glyph group. See the note above.
 *
 * Letters and vowel points are separated because they are separate skills on
 * separate schedules — a student fluent in the alphabet meets the nikud weeks
 * later — and because the two namespaces would otherwise collide outright:
 * shureq's card is keyed by וּ, which is also how a vav with a dagesh is
 * written as a consonant.
 *
 * Confusable decks deliberately get no prefix of their own. They drill the
 * same letters the alphabet deck does, from a different angle, and reviewing ד
 * in one should move the same card as reviewing it in the other.
 */
const KEY_PREFIX: Record<WritableGlyph['group'], string> = {
  consonant: 'write:letter:',
  final: 'write:letter:',
  vowel: 'write:nikud:',
  other: 'write:letter:',
};

export const WRITING_KEY_PREFIXES = ['write:letter:', 'write:nikud:'] as const;

export function writingCardKey(glyph: WritableGlyph): string {
  return `${KEY_PREFIX[glyph.group]}${glyph.char}`;
}

export function isWritingKey(key: string): boolean {
  return WRITING_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
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

/** Sections of the deck picker. */
export type WritingDeckCategory = 'letters' | 'vowels' | 'confusables';

export const WRITING_DECK_CATEGORIES: { id: WritingDeckCategory; label: string }[] = [
  { id: 'letters', label: 'Letters' },
  { id: 'vowels', label: 'Vowel points' },
  { id: 'confusables', label: 'Easily confused' },
];

/**
 * How a deck's queue is ordered.
 *
 * - `due-first` — due cards, then unseen; each in pack order.
 * - `as-built`  — the deck's own order, filtered to what is due or unseen.
 *
 * The second exists for the confusable decks and is not a stylistic
 * preference. Their order *is* the pedagogy: they are built round-robin so
 * that ד and ר alternate, and hoisting due cards to the front reassembles
 * exactly the blocked presentation the deck was constructed to avoid.
 */
export type WritingQueueOrder = 'due-first' | 'as-built';

export interface WritingDeck {
  id: string;
  label: string;
  category: WritingDeckCategory;
  glyphs: WritableGlyph[];
  order: WritingQueueOrder;
}

/**
 * How many times each member of a confusable deck comes round.
 *
 * Discrimination is built by alternation, so a pair deck has to be long enough
 * to alternate: ד ר ד ר ד ר. One pass would be two cards and no contrast at
 * all. Repeats within a session are why `shouldUpdateCard` exists.
 */
export const CONFUSABLE_ROUNDS = 3;

/**
 * Groups of glyphs that beginners mix up, closed over `confusableWith`.
 *
 * The relation is stored per glyph and pointing outward, so ה naming ח and ת
 * while ח names ה and ת describes one group of three, not three of two. The
 * edges are read as undirected: a glyph that names a partner joins that
 * partner's group whether or not the partner names it back, so a half-written
 * pair cannot silently split into two singleton decks.
 *
 * Groups come out in pack order, and so do their members — which for the
 * alphabet is alphabetical order, the order the student is also learning.
 */
export function confusableGroups(pack: ScriptPack = hebrewScriptPack): WritableGlyph[][] {
  const glyphs = allGlyphs(pack);
  const index = new Map(glyphs.map((g, i) => [g.char, i]));
  const edges = new Map<string, Set<string>>();

  const link = (a: string, b: string) => {
    if (!index.has(a) || !index.has(b) || a === b) return;
    if (!edges.has(a)) edges.set(a, new Set());
    if (!edges.has(b)) edges.set(b, new Set());
    edges.get(a)?.add(b);
    edges.get(b)?.add(a);
  };

  for (const g of glyphs) {
    for (const other of g.confusableWith ?? []) link(g.char, other);
  }

  const seen = new Set<string>();
  const groups: WritableGlyph[][] = [];

  for (const glyph of glyphs) {
    if (seen.has(glyph.char) || !edges.has(glyph.char)) continue;

    const members: string[] = [];
    const pending = [glyph.char];
    while (pending.length > 0) {
      const char = pending.pop() as string;
      if (seen.has(char)) continue;
      seen.add(char);
      members.push(char);
      for (const other of edges.get(char) ?? []) pending.push(other);
    }

    members.sort((a, b) => (index.get(a) ?? 0) - (index.get(b) ?? 0));
    groups.push(members.map((char) => glyphs[index.get(char) as number]));
  }

  return groups;
}

/**
 * Deal groups round-robin, one member from each in turn.
 *
 * This is the whole of "interleave rather than block". Taking a slice across
 * the groups puts the greatest possible distance between members of the same
 * group, which is what forces a discrimination rather than a recollection —
 * drilling ד ten times over teaches ד, and teaches nothing about ר.
 */
export function interleave(groups: WritableGlyph[][], rounds = 1): WritableGlyph[] {
  const longest = groups.reduce((max, g) => Math.max(max, g.length), 0);
  const out: WritableGlyph[] = [];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < longest; i++) {
      for (const group of groups) {
        if (i < group.length) out.push(group[i]);
      }
    }
  }

  return out;
}

/** Decks available in the writing drill, in picker order. */
export function buildDecks(pack: ScriptPack = hebrewScriptPack): WritingDeck[] {
  const consonants = glyphsInGroup(pack, 'consonant');
  const finals = glyphsInGroup(pack, 'final');
  const vowels = glyphsInGroup(pack, 'vowel');
  const groups = confusableGroups(pack);

  return [
    // 23 cards, not 22: the alphabet has 22 letters, but shin and sin are
    // drilled separately because writing the dot on the correct side is the
    // whole skill.
    {
      id: 'alphabet',
      label: 'The alphabet',
      category: 'letters',
      glyphs: consonants,
      order: 'due-first',
    },
    { id: 'finals', label: 'Final forms', category: 'letters', glyphs: finals, order: 'due-first' },
    {
      id: 'all-consonants',
      label: 'Letters + finals',
      category: 'letters',
      glyphs: [...consonants, ...finals],
      order: 'due-first',
    },
    {
      id: 'nikud',
      label: 'All vowel points',
      category: 'vowels',
      glyphs: vowels,
      order: 'due-first',
    },
    // One pass across every group: no pair lands back to back, and the deck
    // stays one review per letter.
    {
      id: 'confusable-all',
      label: 'All pairs',
      category: 'confusables',
      glyphs: interleave(groups),
      order: 'as-built',
    },
    ...groups.map((group) => ({
      id: `confusable-${group.map((g) => g.char).join('')}`,
      // Named, not shown as glyphs: the point of the deck is that these
      // letters look alike, so a row of them is an unreadable picker label.
      label: group.map((g) => g.name).join(' / '),
      category: 'confusables' as const,
      glyphs: interleave([group], CONFUSABLE_ROUNDS),
      order: 'as-built' as const,
    })),
  ];
}

/**
 * Order a deck for study.
 *
 * Unlike the vocabulary flashcards, this does NOT shuffle. Alphabetical order
 * is part of what is being learned — a student who can write every letter but
 * cannot recite the alphabet in order has not learned the alphabet. Under
 * `due-first`, due cards come first and each group keeps its pack order; under
 * `as-built` the deck's own order survives intact. See `WritingQueueOrder`.
 */
export function buildQueue(
  deck: Pick<WritingDeck, 'glyphs' | 'order'>,
  store: Record<string, SRSCard>,
  mode: 'srs' | 'all' = 'srs',
): WritableGlyph[] {
  if (mode === 'all') return [...deck.glyphs];

  const wanted = (g: WritableGlyph) => {
    const card = store[writingCardKey(g)];
    return !card || isDue(card);
  };

  if (deck.order === 'as-built') return deck.glyphs.filter(wanted);

  const due: WritableGlyph[] = [];
  const fresh: WritableGlyph[] = [];

  for (const g of deck.glyphs) {
    const card = store[writingCardKey(g)];
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
  return WRITING_GRADES.find((g) => g.id === grade)?.quality ?? 1;
}

/**
 * Where the geometric score starts to look like effortless recall.
 *
 * Above the pass threshold but not yet here, "Good" is the honest answer: the
 * letterform is right and SM-2 should schedule it normally. `easy` stretches
 * the interval hard, so it needs more than merely passing.
 */
const EFFORTLESS_SCORE = 92;

/**
 * The grade a score suggests.
 *
 * Only ever a suggestion. Geometric scoring grades shape occupancy, so it can
 * be confidently wrong in both directions — a ד drawn as a ר scores well, and a
 * correct letter written unusually small can score badly. The student is the
 * one who knows which happened, so every grade button stays live.
 */
export function suggestedGrade(score: number): WritingGrade {
  if (score >= EFFORTLESS_SCORE) return 'easy';
  if (score >= VERDICT_THRESHOLDS.pass) return 'good';
  if (score >= VERDICT_THRESHOLDS.close) return 'hard';
  return 'again';
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

/**
 * Whether a grade should move the SRS card, given this glyph has already been
 * graded earlier in the same session.
 *
 * A confusable deck presents ד three times in one sitting, and three passing
 * grades in five minutes would stretch the interval as though they were three
 * days apart — SM-2 assumes its reviews are spaced, and here they deliberately
 * are not. So within a session a repeat can demote but never promote: a lapse
 * still pulls the schedule in, because getting it wrong on the second look is
 * real information, while getting it right again immediately is not.
 */
export function shouldUpdateCard(alreadyReviewed: boolean, grade: WritingGrade): boolean {
  return !alreadyReviewed || !isPassingGrade(grade);
}

/**
 * How many distinct glyphs in a deck have never been written.
 *
 * Distinct, because the confusable decks repeat their members and "6 new" for
 * a ד/ר pair would be a lie about a two-letter deck.
 */
export function countNew(glyphs: WritableGlyph[], store: Record<string, SRSCard>): number {
  const unseen = new Set<string>();
  for (const g of glyphs) {
    const key = writingCardKey(g);
    if (!store[key]) unseen.add(key);
  }
  return unseen.size;
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
