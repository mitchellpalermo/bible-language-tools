// Today's Session on greek.tools (#197): what is due here, and which drill
// fills today's slot. The queue builder, the clock and the summary are
// `@tools/shared/today`; this file supplies the candidates.
//
// The session runs in this order: due vocabulary, then one drill. Rules that
// decide what goes in, each of which looks arbitrary without its reason:
//
// - **Vocabulary is due only** (#224, as on hebrew.tools): no new words, no
//   weak ones. Introducing words is /flashcards' job, and a review session that
//   adds strangers piles up tomorrow's reviews. Due is everything the schedule
//   says is due, whatever deck or frequency band the student has open there.
// - **There is no paradigm section.** hebrew.tools schedules paradigm forms as
//   SRS cards; greek.tools' paradigm quiz does not schedule anything, so there
//   are no due cells to offer. The ladder (#199) is where paradigms join.
// - **Parse history has no schedule either**, so it is never "due". It enters
//   through the parse drill, which asks first about the kinds of form the
//   attempt log says the student misses (`parseWeakness`), and through a hint
//   on the plan and the summary naming the focus passage parsed worst.
// - **The drill rotates by day** among the drills that exist
//   (`DRILL_PROVIDERS`). A drill with a provider is in the rotation; one
//   without is not, so the ladder joins by adding one entry and nothing else.
//   A provider that has nothing to offer today is skipped for the next.

import type { Attempt } from '@tools/shared/attempt-log';
import { dayIndex } from '@tools/shared/daily';
import { shuffle } from '@tools/shared/flashcard-session';
import {
  buildTodayPlan,
  type Candidate,
  type DrillSlot,
  isTimeBudget,
  type TimeBudget,
  type TodayPlan,
} from '@tools/shared/today';
import type { FocusPassage, ParseHistory } from '../data/focusPassages';
import { daysFromNow, isDue, normalizeKey, type SRSCard } from '../data/srs';
import { type VocabWord, vocabulary } from '../data/vocabulary';
import { parseConcept, parseFormConcept, parseHistoryAsAttempts } from './parse-attempts';
import { buildSession, DEFAULT_PARSE_SETTINGS, type ParseItem } from './verb-parse';

type Store = Record<string, SRSCard>;

// ─── Estimates ────────────────────────────────────────────────────────────────

/**
 * Seconds per item. First guesses, deliberately on the slow side: an
 * overestimate ends a session early, an underestimate runs it over.
 */
export const SECONDS = {
  vocab: 10,
  parseItem: 25,
} as const;

/** About how long the drill slot is, by budget. */
export const DRILL_SECONDS: Record<TimeBudget, number> = { 20: 240, 45: 480, 90: 720 };

/** A kind of form below this accuracy is weak, once it has `MIN_WEAK_ATTEMPTS` answers. */
export const WEAK_ACCURACY = 0.7;
export const MIN_WEAK_ATTEMPTS = 3;
/** A focus passage needs this many parse answers before it is called weak. */
export const MIN_PASSAGE_ANSWERS = 10;

// ─── Items ────────────────────────────────────────────────────────────────────

/** The store key for a vocabulary card, the same one Flashcards uses. */
export const vocabSrsKey = (word: VocabWord) => normalizeKey(word.greek);

export interface TodayItem {
  kind: 'vocab';
  word: VocabWord;
}

export type TodayDrill =
  | { kind: 'parse'; items: ParseItem[] }
  | { kind: 'mixed'; words: VocabWord[] };

export type DrillKind = 'ladder' | TodayDrill['kind'];

/** Every drill the session is meant to have, in order. */
export const DRILL_ROTATION: readonly DrillKind[] = ['ladder', 'parse', 'mixed'];

export const DRILL_LABELS: Record<DrillKind, string> = {
  ladder: 'Paradigm ladder',
  parse: 'Parse quiz',
  mixed: 'Mixed review of learned words',
};

export const SECTION_LABELS = {
  vocab: 'Vocabulary',
  drill: 'Drill',
} as const;

export type GreekTodayPlan = TodayPlan<TodayItem, TodayDrill>;

// ─── Vocabulary ───────────────────────────────────────────────────────────────

/**
 * Vocabulary that is due, most overdue first. Never new, never weak: see the
 * top of this file. Each word once, however many vocabulary entries share its
 * store key.
 */
export function vocabCandidates(store: Store): Candidate<TodayItem>[] {
  const due: { word: VocabWord; card: SRSCard }[] = [];
  for (const word of vocabulary) {
    const card = store[vocabSrsKey(word)];
    if (card && isDue(card)) due.push({ word, card });
  }
  due.sort((a, b) => a.card.dueDate.localeCompare(b.card.dueDate));

  const seen = new Set<string>();
  const out: Candidate<TodayItem>[] = [];
  for (const { word } of due) {
    const id = vocabSrsKey(word);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, tier: 'due', seconds: SECONDS.vocab, payload: { kind: 'vocab', word } });
  }
  return out;
}

// ─── Parse history ────────────────────────────────────────────────────────────

/** Accuracy per kind of form (tense-voice-mood) from the attempt log. */
export function parseFormAccuracy(
  attempts: readonly Attempt[],
): Map<string, { correct: number; total: number }> {
  const out = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    if (!a.concept.startsWith('parse/paradigm/')) continue;
    const tally = out.get(a.concept) ?? { correct: 0, total: 0 };
    tally.total++;
    if (a.correct) tally.correct++;
    out.set(a.concept, tally);
  }
  return out;
}

/**
 * How weak a kind of form is, lower meaning weaker. A kind with too few
 * answers to judge sits in the middle, so unseen kinds are tried before ones
 * the student has shown they know.
 */
export function parseWeakness(
  item: Pick<ParseItem, 'tense' | 'voice' | 'mood'>,
  accuracy: ReturnType<typeof parseFormAccuracy>,
): number {
  const tally = accuracy.get(parseFormConcept(item));
  if (!tally || tally.total < MIN_WEAK_ATTEMPTS) return WEAK_ACCURACY;
  return tally.correct / tally.total;
}

/**
 * Parse items, the kinds the student misses most first and random within a
 * kind. `pool` is already shuffled, and a stable sort keeps that order.
 */
export function rankParseItems(
  pool: readonly ParseItem[],
  attempts: readonly Attempt[],
): ParseItem[] {
  const accuracy = parseFormAccuracy(attempts);
  return [...pool].sort((a, b) => parseWeakness(a, accuracy) - parseWeakness(b, accuracy));
}

export interface WeakPassage {
  id: string;
  label: string;
  accuracy: number;
}

/**
 * The focus passage parsed worst, if any is below `WEAK_ACCURACY` over at least
 * `MIN_PASSAGE_ANSWERS` answers. Reads totals and the attempt log through
 * `parseHistoryAsAttempts`, so a returning student's history counts.
 */
export function weakestPassage(
  passages: readonly FocusPassage[],
  history: Record<string, ParseHistory>,
  log: readonly Attempt[],
): WeakPassage | null {
  const all = parseHistoryAsAttempts(history, log);
  let worst: WeakPassage | null = null;
  for (const p of passages) {
    const mine = all.filter((a) => a.concept === parseConcept(p.id));
    if (mine.length < MIN_PASSAGE_ANSWERS) continue;
    const accuracy = mine.filter((a) => a.correct).length / mine.length;
    if (accuracy >= WEAK_ACCURACY || (worst && accuracy >= worst.accuracy)) continue;
    worst = { id: p.id, label: p.label ?? `${p.book} ${p.startChapter}:${p.startVerse}`, accuracy };
  }
  return worst;
}

// ─── The drill ────────────────────────────────────────────────────────────────

export interface DrillContext {
  budget: TimeBudget;
  store: Store;
  attempts: readonly Attempt[];
  random: () => number;
}

export type DrillProvider = (context: DrillContext) => DrillSlot<TodayDrill> | null;

const parseDrill: DrillProvider = ({ budget, attempts }) => {
  const count = Math.max(1, Math.floor(DRILL_SECONDS[budget] / SECONDS.parseItem));
  const items = rankParseItems(
    buildSession(DEFAULT_PARSE_SETTINGS, Number.MAX_SAFE_INTEGER),
    attempts,
  ).slice(0, count);
  if (items.length === 0) return null;
  return {
    id: 'parse',
    seconds: items.length * SECONDS.parseItem,
    payload: { kind: 'parse', items },
  };
};

/** Words that have started to stick and are not due: recall across the deck, unscheduled. */
const mixedDrill: DrillProvider = ({ budget, store, random }) => {
  const learned = vocabulary.filter((w) => {
    const card = store[vocabSrsKey(w)];
    return card && card.repetition > 0 && !isDue(card);
  });
  if (learned.length === 0) return null;
  const count = Math.floor(DRILL_SECONDS[budget] / SECONDS.vocab);
  const words = shuffle(learned, random).slice(0, count);
  return { id: 'mixed', seconds: words.length * SECONDS.vocab, payload: { kind: 'mixed', words } };
};

/**
 * The drills that exist. **The seam for the paradigm ladder (#199):** add a
 * `ladder` entry here, a `{ kind: 'ladder', ... }` variant to `TodayDrill`, and
 * the matching branch in `planSteps`. The rotation and the fallback below need
 * no change. Until then `ladder` is in `DRILL_ROTATION` and absent here, so it
 * is not dealt.
 */
export const DRILL_PROVIDERS: Partial<Record<DrillKind, DrillProvider>> = {
  parse: parseDrill,
  mixed: mixedDrill,
};

/**
 * Today's drill: the day's turn among the drills that exist, or the next that
 * has something to offer.
 */
export function todaysDrill(
  context: DrillContext,
  now = new Date(),
  providers: Partial<Record<DrillKind, DrillProvider>> = DRILL_PROVIDERS,
): DrillSlot<TodayDrill> | null {
  const available = DRILL_ROTATION.flatMap((kind) => {
    const provider = providers[kind];
    return provider ? [provider] : [];
  });
  const start = dayIndex(available.length, now);
  for (let i = 0; i < available.length; i++) {
    const drill = available[(start + i) % available.length](context);
    if (drill) return drill;
  }
  return null;
}

// ─── The plan ─────────────────────────────────────────────────────────────────

export interface PlanContext {
  budget: TimeBudget;
  store: Store;
  attempts?: readonly Attempt[];
  now?: Date;
  random?: () => number;
  providers?: Partial<Record<DrillKind, DrillProvider>>;
}

export function buildGreekPlan({
  budget,
  store,
  attempts = [],
  now = new Date(),
  random = Math.random,
  providers = DRILL_PROVIDERS,
}: PlanContext): GreekTodayPlan {
  return buildTodayPlan({
    budget,
    sections: [{ id: 'vocab', candidates: vocabCandidates(store) }],
    drill: todaysDrill({ budget, store, attempts, random }, now, providers),
  });
}

// ─── Tomorrow ─────────────────────────────────────────────────────────────────

const VOCAB_KEYS = new Set(vocabulary.map(vocabSrsKey));

/** What the next session will start from: vocabulary due by tomorrow. */
export function dueTomorrow(store: Store): number {
  const tomorrow = daysFromNow(1);
  let n = 0;
  for (const [key, card] of Object.entries(store)) {
    if (VOCAB_KEYS.has(key) && card.dueDate <= tomorrow) n++;
  }
  return n;
}

// ─── The budget ───────────────────────────────────────────────────────────────

/** The last budget picked. A preference, local to the browser and never synced. */
export const BUDGET_KEY = 'greek-tools-today-budget-v1';
export const DEFAULT_BUDGET: TimeBudget = 20;

export function loadBudget(): TimeBudget {
  try {
    const value = Number(localStorage.getItem(BUDGET_KEY));
    return isTimeBudget(value) ? value : DEFAULT_BUDGET;
  } catch {
    return DEFAULT_BUDGET;
  }
}

export function saveBudget(budget: TimeBudget): void {
  try {
    localStorage.setItem(BUDGET_KEY, String(budget));
  } catch {
    // A preference; losing it costs one tap.
  }
}
