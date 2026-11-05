// Today's Session on hebrew.tools (#184): what is due, weak and new here, and
// which drill fills today's slot. The queue builder, the clock and the summary
// are `@tools/shared/today`; this file supplies the candidates.
//
// The session runs in this order: due vocabulary, paradigm forms, one drill.
// Vocabulary is due cards only (#224); new words are introduced on /flashcards. The rules that decide what goes in, each of which looks arbitrary
// without its reason:
//
// - **Due work is everything the schedule says is due**, whatever deck the
//   student has picked on /flashcards.
// - **Vocabulary is due only**: no new words, no weak ones.
// - **A weak form is practice, never a review.** It is not due, so answering
//   it must not move its schedule forward: weak forms are graded with
//   `practice`, which can demote a card and never promote it.
// - **New paradigm forms come only from tables the student has started.** The
//   app cannot know which tables the course has reached; a table with no
//   answered form in it is one the student has not been taught.
// - **The drill rotates by day** between the Accent-Shift Trainer, the suffix
//   ladder and a mixed review of forms already learned, skipping one that has
//   nothing to offer.

import { dayIndex } from '@tools/shared/daily';
import { shuffle } from '@tools/shared/flashcard-session';
import { type LadderProgress, rungStates } from '@tools/shared/ladder';
import {
  buildTodayPlan,
  type Candidate,
  type DrillSlot,
  isTimeBudget,
  type SectionInput,
  type Tier,
  type TimeBudget,
  type TodayPlan,
} from '@tools/shared/today';
import type { ShiftItem } from '../data/accent-shift';
import { daysFromNow, isDue, normalizeKey, type SRSCard, todayStr } from '../data/srs';
import { LADDER_RUNG_IDS } from '../data/suffix-ladder';
import { cardKey, type HebrewVocabWord, vocabulary } from '../data/vocabulary';
import { ACCENT_KEY_PREFIX, buildQueue as buildAccentQueue } from './accent-shift';
import { buildTableModels, getQuizCells, type TableModel } from './paradigm-quiz';
import { PARADIGM_KEY_PREFIX, paradigmCardKey } from './paradigm-srs';

type Store = Record<string, SRSCard>;

// ─── Estimates ────────────────────────────────────────────────────────────────

/**
 * Seconds per item. First guesses, deliberately on the slow side: an
 * overestimate ends a session early, an underestimate runs it over. #190 will
 * measure each student's own pace.
 */
export const SECONDS = {
  vocab: 10,
  formCell: 15,
  accentItem: 90,
} as const;

/** About how long the drill slot is, by budget. */
export const DRILL_SECONDS: Record<TimeBudget, number> = { 20: 240, 45: 480, 90: 720 };

/** At most this many new paradigm forms a day, by budget, so new cards do not pile up tomorrow's reviews. */
export const MAX_NEW: Record<TimeBudget, { forms: number }> = {
  20: { forms: 10 },
  45: { forms: 20 },
  90: { forms: 30 },
};

/** Forms per paradigm item. Smaller items share the time more evenly. */
export const MAX_CELLS_PER_ITEM = 8;

/** Below this ease a card that is not due counts as weak. A new card starts at 2.5. */
export const WEAK_EASE = 2.0;

// ─── Items ────────────────────────────────────────────────────────────────────

/** The store key for a vocabulary card — the same one Flashcards uses. */
export const vocabSrsKey = (word: HebrewVocabWord) => normalizeKey(cardKey(word));

export type TodayItem =
  | { kind: 'vocab'; word: HebrewVocabWord }
  | { kind: 'forms'; table: TableModel; blankIds: string[] };

/** One table's worth of forms to fill in. */
export interface FormsRound {
  table: TableModel;
  blankIds: string[];
}

export type TodayDrill =
  | { kind: 'accent'; items: ShiftItem[] }
  | { kind: 'ladder'; table: TableModel }
  | { kind: 'mixed'; rounds: FormsRound[] };

export type DrillKind = TodayDrill['kind'];

export const DRILL_ROTATION: readonly DrillKind[] = ['accent', 'ladder', 'mixed'];

export const DRILL_LABELS: Record<DrillKind, string> = {
  accent: 'Accent Shift',
  ladder: 'Suffix ladder',
  mixed: 'Mixed review of learned forms',
};

export const SECTION_LABELS = {
  vocab: 'Vocabulary',
  forms: 'Paradigm forms',
  drill: 'Drill',
} as const;

export type HebrewTodayPlan = TodayPlan<TodayItem, TodayDrill>;

/** Not due, not seen today, and the student keeps missing it. */
export function isWeak(card: SRSCard, today = todayStr()): boolean {
  if (isDue(card) || card.lastReviewed === today || card.lastReviewed === '') return false;
  return card.easeFactor < WEAK_EASE || card.repetition === 0;
}

function tierOf(card: SRSCard | undefined): Tier | null {
  if (!card) return 'new';
  if (isDue(card)) return 'due';
  if (isWeak(card)) return 'weak';
  return null;
}

/** Most overdue first, then lowest ease. */
function byUrgency(a: SRSCard | undefined, b: SRSCard | undefined): number {
  if (!a || !b) return 0;
  return a.dueDate.localeCompare(b.dueDate) || a.easeFactor - b.easeFactor;
}

// ─── Vocabulary ───────────────────────────────────────────────────────────────

/**
 * Vocabulary that is due, most overdue first. Never new words (#224): Today is
 * review, and a student introduces words on /flashcards. Never weak words
 * either: a card that is not due is practice, not review.
 */
export function vocabCandidates(store: Store): Candidate<TodayItem>[] {
  const due: { word: HebrewVocabWord; card: SRSCard }[] = [];
  for (const word of vocabulary) {
    const card = store[vocabSrsKey(word)];
    if (card && isDue(card)) due.push({ word, card });
  }
  due.sort((a, b) => byUrgency(a.card, b.card));

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

// ─── Paradigm forms ───────────────────────────────────────────────────────────

interface FormHome {
  table: TableModel;
  order: number;
}

/**
 * Each form's home table: the narrowest table it appears in. A form is in its
 * own verb's table, the summary beside the other classes, and sometimes a
 * ladder rung; the narrowest asks for the fewest other forms around it.
 */
export function formHomes(
  tables: readonly TableModel[] = buildTableModels(),
): Map<string, FormHome> {
  const homes = new Map<string, FormHome>();
  tables.forEach((table, order) => {
    for (const cell of getQuizCells(table)) {
      if (!cell.id) continue;
      const current = homes.get(cell.id);
      if (!current || table.cols.length < current.table.cols.length) {
        homes.set(cell.id, { table, order });
      }
    }
  });
  return homes;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function formCandidates(
  store: Store,
  homes: Map<string, FormHome> = formHomes(),
): Candidate<TodayItem>[] {
  // Tables with at least one answered form: the only ones new forms come from.
  const started = new Set<string>();
  for (const [id, home] of homes) if (store[paradigmCardKey(id)]) started.add(home.table.id);

  const byTier: Record<Tier, Map<string, { home: FormHome; ids: string[]; cards: SRSCard[] }>> = {
    due: new Map(),
    weak: new Map(),
    new: new Map(),
  };
  for (const [id, home] of homes) {
    const card = store[paradigmCardKey(id)];
    const tier = tierOf(card);
    if (!tier || (tier === 'new' && !started.has(home.table.id))) continue;
    const group = byTier[tier].get(home.table.id) ?? { home, ids: [], cards: [] };
    group.ids.push(id);
    if (card) group.cards.push(card);
    byTier[tier].set(home.table.id, group);
  }

  const out: Candidate<TodayItem>[] = [];
  for (const tier of ['due', 'weak', 'new'] as const) {
    const groups = [...byTier[tier].values()];
    const urgency = (g: (typeof groups)[number]) => [...g.cards].sort((a, b) => byUrgency(a, b))[0];
    groups.sort((a, b) => byUrgency(urgency(a), urgency(b)) || a.home.order - b.home.order);
    for (const { home, ids } of groups) {
      chunk(ids, MAX_CELLS_PER_ITEM).forEach((blankIds, i) => {
        out.push({
          id: `${tier}:${home.table.id}:${i}`,
          tier,
          seconds: blankIds.length * SECONDS.formCell,
          payload: { kind: 'forms', table: home.table, blankIds },
        });
      });
    }
  }
  return out;
}

// ─── The drill ────────────────────────────────────────────────────────────────

/** The rung being climbed: the highest open one, as the ladder shows it. */
export function currentRung(progress: LadderProgress, tables = buildTableModels()) {
  const open = rungStates(LADDER_RUNG_IDS, progress).filter((r) => r.unlocked);
  const rung = open[open.length - 1];
  return tables.find((t) => t.rung === rung.id) as TableModel;
}

export function buildDrill(
  kind: DrillKind,
  { budget, store, ladder, homes, random }: DrillContext,
): DrillSlot<TodayDrill> | null {
  const seconds = DRILL_SECONDS[budget];
  switch (kind) {
    case 'accent': {
      const count = Math.max(1, Math.floor(seconds / SECONDS.accentItem));
      const items = buildAccentQueue(store, random).slice(0, count);
      return { id: 'accent', seconds: items.length * SECONDS.accentItem, payload: { kind, items } };
    }
    case 'ladder': {
      const table = currentRung(ladder);
      const cells = getQuizCells(table).length;
      return { id: 'ladder', seconds: cells * SECONDS.formCell, payload: { kind, table } };
    }
    case 'mixed': {
      // Forms already learned and not due: recall of something that has
      // started to stick, across tables rather than one at a time.
      const learned = [...homes.keys()].filter((id) => {
        const card = store[paradigmCardKey(id)];
        return card && card.repetition > 0 && !isDue(card);
      });
      if (learned.length === 0) return null;
      const picked = shuffle(learned, random).slice(0, Math.floor(seconds / SECONDS.formCell));
      const byTable = new Map<string, FormsRound>();
      for (const id of picked) {
        const table = (homes.get(id) as FormHome).table;
        const round = byTable.get(table.id) ?? { table, blankIds: [] };
        round.blankIds.push(id);
        byTable.set(table.id, round);
      }
      const rounds = [...byTable.values()];
      return { id: 'mixed', seconds: picked.length * SECONDS.formCell, payload: { kind, rounds } };
    }
  }
}

interface DrillContext {
  budget: TimeBudget;
  store: Store;
  ladder: LadderProgress;
  homes: Map<string, FormHome>;
  random: () => number;
}

/** Today's drill: the day's turn in the rotation, or the next that has something. */
export function todaysDrill(context: DrillContext, now = new Date()): DrillSlot<TodayDrill> | null {
  const start = dayIndex(DRILL_ROTATION.length, now);
  for (let i = 0; i < DRILL_ROTATION.length; i++) {
    const drill = buildDrill(DRILL_ROTATION[(start + i) % DRILL_ROTATION.length], context);
    if (drill) return drill;
  }
  return null;
}

// ─── The plan ─────────────────────────────────────────────────────────────────

export interface PlanContext {
  budget: TimeBudget;
  store: Store;
  ladder: LadderProgress;
  now?: Date;
  random?: () => number;
}

export function buildHebrewPlan({
  budget,
  store,
  ladder,
  now = new Date(),
  random = Math.random,
}: PlanContext): HebrewTodayPlan {
  const homes = formHomes();
  const sections: SectionInput<TodayItem>[] = [
    { id: 'vocab', candidates: vocabCandidates(store) },
    { id: 'forms', candidates: formCandidates(store, homes), maxNew: MAX_NEW[budget].forms },
  ];
  return buildTodayPlan({
    budget,
    sections,
    drill: todaysDrill({ budget, store, ladder, homes, random }, now),
  });
}

/** Planned forms in each tier, counted by form rather than by table. */
export function countForms(plan: HebrewTodayPlan): number {
  return plan.sections
    .flatMap((s) => s.items)
    .reduce((n, i) => n + (i.payload.kind === 'forms' ? i.payload.blankIds.length : 0), 0);
}

// ─── Tomorrow ─────────────────────────────────────────────────────────────────

const VOCAB_KEYS = new Set(vocabulary.map(vocabSrsKey));

/** What the next session will start from: vocabulary, forms and drill items due by tomorrow. */
export function dueTomorrow(store: Store): number {
  const tomorrow = daysFromNow(1);
  let n = 0;
  for (const [key, card] of Object.entries(store)) {
    const counted =
      VOCAB_KEYS.has(key) ||
      key.startsWith(PARADIGM_KEY_PREFIX) ||
      key.startsWith(ACCENT_KEY_PREFIX);
    if (counted && card.dueDate <= tomorrow) n++;
  }
  return n;
}

// ─── The budget ───────────────────────────────────────────────────────────────

/** The last budget picked. A preference, local to the browser and never synced. */
export const BUDGET_KEY = 'hebrew-tools-today-budget-v1';
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
