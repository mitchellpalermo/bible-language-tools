// Today's Session on hebrew.tools (#184): what goes in today's session, and
// how long each part is expected to take.
//
// The fill rules — due before weak before new, never over budget — and the
// drill rotation are language-agnostic and live in
// `@tools/shared/today-session`. This file says where Hebrew's items come
// from and what each costs.
//
// Things to know before changing it:
//
// - **The session runs in four parts, in this order:** review words, review
//   forms, new words, the drill. Weak cards ride with their kind's review, so
//   nothing new is ever studied before a due or weak card, and the drill is
//   last as the issue asks.
// - **"Due" means scheduled and due.** /paradigms counts a never-answered cell
//   as due (`isCellDue`), which is right for a table picker and wrong here: it
//   would make every unstarted table a review. A form the student has never
//   written is new material, and new material in the session is vocabulary.
// - **New words come from the student's own deck** (`deck-selection.ts`):
//   their textbook chapters in textbook order, or the whole vocabulary by
//   frequency. At most `NEW_WORDS_PER_SESSION`, however long the budget —
//   ninety minutes of first sightings is a pile of reviews for next week, not
//   a better session.
// - **A form is shown in its own verb's table when it has one.** A cell id is
//   the same in the verb and summary layouts, so the planner picks the table:
//   one verb's paradigm first, then the summary, then a ladder rung.
// - **The timings are estimates, kept here in one place.** The budget is
//   filled to the estimate, never past it; if sessions run long, change the
//   numbers here.

import { CLEAN_WRITES_TO_UNLOCK, type LadderProgress, rungStates } from '@tools/shared/ladder';
import {
  createStudyStreak,
  drillForToday,
  dueTomorrow,
  fillBudget,
  isSessionBudget,
  isWeak,
  type SessionBudget,
  type SessionCandidate,
  type SessionTier,
} from '@tools/shared/today-session';
import { isDue, type SRSCard, todayStr } from '../data/srs';
import { LADDER_RUNG_IDS } from '../data/suffix-ladder';
import { wordsInChapters } from '../data/textbooks';
import { type HebrewVocabWord, vocabSrsKey, vocabulary } from '../data/vocabulary';
import { ACCENT_KEY_PREFIX } from './accent-shift';
import type { DeckSelection } from './deck-selection';
import { buildTableModels, getQuizCells, type QuizCell, type TableModel } from './paradigm-quiz';
import { PARADIGM_KEY_PREFIX } from './paradigm-srs';

type Store = Record<string, SRSCard>;

// ─── Timings and limits ───────────────────────────────────────────────────────

/** One vocabulary card: read, recall, flip, grade. */
export const WORD_SECONDS = 12;
/** One blank in a paradigm table, typed with full pointing. */
export const FORM_SECONDS = 20;
/** Reading a table before writing in it, and reading the marking after. */
export const TABLE_SECONDS = 30;
/** One accent-shift item, all four steps. */
export const ACCENT_ITEM_SECONDS = 75;
/** Accent-shift items in the drill slot. */
export const ACCENT_ITEMS = 4;
/** Learned forms the mixed review asks for, and the most tables it spreads over. */
export const MIXED_FORMS = 8;
export const MIXED_TABLES = 3;
/** A mixed review needs at least this many learned forms to be worth running. */
export const MIXED_MIN_LEARNED = 4;
/** First sightings in one session, whatever the budget. */
export const NEW_WORDS_PER_SESSION = 15;

// ─── Storage ──────────────────────────────────────────────────────────────────

export const BUDGET_KEY = 'hebrew-tools-session-budget-v1';
export const STUDY_STREAK_KEY = 'hebrew-tools-study-streak-v1';

export const DEFAULT_BUDGET: SessionBudget = 20;

/** The budget picked last time. A display preference, local, never synced. */
export function loadBudget(): SessionBudget {
  try {
    const stored = Number(localStorage.getItem(BUDGET_KEY));
    return isSessionBudget(stored) ? stored : DEFAULT_BUDGET;
  } catch {
    return DEFAULT_BUDGET;
  }
}

export function saveBudget(budget: SessionBudget): void {
  try {
    localStorage.setItem(BUDGET_KEY, String(budget));
  } catch {
    /* a blocked store forgets the choice, nothing more */
  }
}

export const { loadStudyStreak, markStudiedToday } = createStudyStreak(STUDY_STREAK_KEY);

// ─── Tables ───────────────────────────────────────────────────────────────────

/** A table with some of its cells to write. */
export interface FormTable {
  table: TableModel;
  /** `cellId()`s of the blanks, in the order they were planned. */
  cellIds: string[];
}

/** The table's cells, blank exactly where the plan says. */
export function formCells({ table, cellIds }: FormTable): QuizCell[] {
  const blanks = new Set(cellIds);
  return getQuizCells(table).map((c) => ({
    ...c,
    isBlank: c.id !== undefined && blanks.has(c.id),
  }));
}

/** Verb and suffix tables first, then summaries, then ladder rungs. */
function tableRank(t: TableModel): number {
  if (t.rung) return 2;
  return t.layout === 'summary' ? 1 : 0;
}

let tableIndex: { tables: TableModel[]; byCell: Map<string, TableModel> } | null = null;

/** Every table, and the one each cell id is shown in. Built once. */
function tablesByCell() {
  if (!tableIndex) {
    const tables = buildTableModels();
    const byCell = new Map<string, TableModel>();
    for (const t of [...tables].sort((a, b) => tableRank(a) - tableRank(b))) {
      for (const c of getQuizCells(t)) if (c.id && !byCell.has(c.id)) byCell.set(c.id, t);
    }
    tableIndex = { tables, byCell };
  }
  return tableIndex;
}

/** Group cell ids by their table, tables in the order first reached. */
function groupByTable(cellIds: string[]): FormTable[] {
  const { byCell } = tablesByCell();
  const groups = new Map<string, FormTable>();
  for (const id of cellIds) {
    const table = byCell.get(id);
    if (!table) continue;
    const group = groups.get(table.id) ?? { table, cellIds: [] };
    group.cellIds.push(id);
    groups.set(table.id, group);
  }
  return [...groups.values()];
}

// ─── Vocabulary ───────────────────────────────────────────────────────────────

let wordIndex: Map<string, HebrewVocabWord> | null = null;

function wordsByKey(): Map<string, HebrewVocabWord> {
  wordIndex ??= new Map(vocabulary.map((w) => [vocabSrsKey(w), w]));
  return wordIndex;
}

/** The student's deck, in the order new words should arrive. */
function newWordPool(selection: DeckSelection): HebrewVocabWord[] {
  if (selection.deck !== 'all') {
    return wordsInChapters(selection.deck, selection.chapters, selection.categories);
  }
  return [...vocabulary].sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));
}

// ─── The drill slot ───────────────────────────────────────────────────────────

export const DRILL_ROTATION = ['accent', 'ladder', 'mixed'] as const;
export type DrillKind = (typeof DRILL_ROTATION)[number];

export const DRILL_TITLES: Record<DrillKind, string> = {
  accent: 'Accent shift',
  ladder: 'Suffix ladder',
  mixed: 'Mixed review',
};

export type DrillPlan =
  | { kind: 'accent'; items: number; seconds: number }
  | { kind: 'ladder' | 'mixed'; tables: FormTable[]; seconds: number };

function tablesSeconds(tables: FormTable[]): number {
  return tables.reduce((s, t) => s + TABLE_SECONDS + t.cellIds.length * FORM_SECONDS, 0);
}

/**
 * The rung to write today: the lowest open rung not yet climbed, so the drill
 * works toward the next unlock. With every open rung climbed, the one written
 * least.
 */
export function ladderRungForToday(progress: LadderProgress): string {
  const open = rungStates(LADDER_RUNG_IDS, progress).filter((r) => r.unlocked);
  const climbing = open.find((r) => r.cleanWrites < CLEAN_WRITES_TO_UNLOCK);
  if (climbing) return climbing.id;
  return [...open].sort((a, b) => a.cleanWrites - b.cleanWrites)[0].id;
}

function ladderDrill(progress: LadderProgress): DrillPlan {
  const rung = ladderRungForToday(progress);
  const table = tablesByCell().tables.find((t) => t.rung === rung) as TableModel;
  // A full table: only a clean Full-table write counts toward the next rung.
  const cellIds = getQuizCells(table).flatMap((c) => (c.id ? [c.id] : []));
  const tables = [{ table, cellIds }];
  return { kind: 'ladder', tables, seconds: tablesSeconds(tables) };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Learned forms that are not due: written before, scheduled for later. */
function learnedForms(store: Store, today: string, exclude: ReadonlySet<string>): string[] {
  const { byCell } = tablesByCell();
  return Object.values(store)
    .filter((c) => c.key.startsWith(PARADIGM_KEY_PREFIX) && c.dueDate > today)
    .map((c) => c.key.slice(PARADIGM_KEY_PREFIX.length))
    .filter((id) => byCell.has(id) && !exclude.has(id));
}

function mixedDrill(learned: string[], random: () => number): DrillPlan {
  const { byCell } = tablesByCell();
  const picked: string[] = [];
  const tables = new Set<string>();
  for (const id of shuffle(learned, random)) {
    if (picked.length >= MIXED_FORMS) break;
    const table = (byCell.get(id) as TableModel).id;
    if (!tables.has(table) && tables.size >= MIXED_TABLES) continue;
    tables.add(table);
    picked.push(id);
  }
  const grouped = groupByTable(picked);
  return { kind: 'mixed', tables: grouped, seconds: tablesSeconds(grouped) };
}

// ─── The plan ─────────────────────────────────────────────────────────────────

export interface SessionPlan {
  budget: SessionBudget;
  /** Due words, then weak ones. */
  reviewWords: HebrewVocabWord[];
  /** Due forms, then weak ones, by table. */
  reviewForms: FormTable[];
  newWords: HebrewVocabWord[];
  drill: DrillPlan | null;
  /** The estimate for the whole plan. Never more than the budget. */
  seconds: number;
}

export interface PlanInput {
  store: Store;
  budget: SessionBudget;
  selection: DeckSelection;
  ladder: LadderProgress;
  now?: Date;
  random?: () => number;
}

type Candidate = SessionCandidate &
  ({ kind: 'word'; word: HebrewVocabWord } | { kind: 'form'; cellId: string });

/** Most overdue first, then the weakest; the caller's order breaks ties. */
function byUrgency(a: SRSCard, b: SRSCard): number {
  return a.dueDate.localeCompare(b.dueDate) || a.easeFactor - b.easeFactor;
}

export function buildSessionPlan({
  store,
  budget,
  selection,
  ladder,
  now = new Date(),
  random = Math.random,
}: PlanInput): SessionPlan {
  const today = todayStr();
  const words = wordsByKey();
  const { byCell } = tablesByCell();

  // Reviews: due, then weak, from the words and forms the session can show.
  const reviews: { card: SRSCard; tier: SessionTier; candidate: Candidate }[] = [];
  for (const card of Object.values(store)) {
    const tier: SessionTier | null = isDue(card) ? 'due' : isWeak(card, today) ? 'weak' : null;
    if (!tier) continue;
    const word = words.get(card.key);
    if (word) {
      reviews.push({ card, tier, candidate: { kind: 'word', word, tier, seconds: WORD_SECONDS } });
      continue;
    }
    if (!card.key.startsWith(PARADIGM_KEY_PREFIX)) continue;
    const cellId = card.key.slice(PARADIGM_KEY_PREFIX.length);
    const table = byCell.get(cellId);
    if (!table) continue;
    reviews.push({
      card,
      tier,
      candidate: {
        kind: 'form',
        cellId,
        tier,
        seconds: FORM_SECONDS,
        group: table.id,
        groupSeconds: TABLE_SECONDS,
      },
    });
  }
  reviews.sort((a, b) => byUrgency(a.card, b.card));

  const fresh: Candidate[] = newWordPool(selection)
    .filter((w) => !store[vocabSrsKey(w)])
    .slice(0, NEW_WORDS_PER_SESSION)
    .map((word) => ({ kind: 'word', word, tier: 'new', seconds: WORD_SECONDS }));

  // The drill is part of every session, so its time is set aside first.
  const planned = new Set(
    reviews.map((r) => r.candidate).flatMap((c) => (c.kind === 'form' ? [c.cellId] : [])),
  );
  const learned = learnedForms(store, today, planned);
  const kind = drillForToday(
    DRILL_ROTATION,
    (d) => d !== 'mixed' || learned.length >= MIXED_MIN_LEARNED,
    now,
  );
  let drill: DrillPlan | null =
    kind === 'accent'
      ? { kind, items: ACCENT_ITEMS, seconds: ACCENT_ITEMS * ACCENT_ITEM_SECONDS }
      : kind === 'ladder'
        ? ladderDrill(ladder)
        : kind === 'mixed'
          ? mixedDrill(learned, random)
          : null;
  const budgetSeconds = budget * 60;
  if (drill && drill.seconds > budgetSeconds) drill = null;

  const filled = fillBudget(
    [...reviews.map((r) => r.candidate), ...fresh],
    budgetSeconds - (drill?.seconds ?? 0),
  );

  const reviewWords: HebrewVocabWord[] = [];
  const newWords: HebrewVocabWord[] = [];
  const formIds: string[] = [];
  for (const c of filled.items) {
    if (c.kind === 'form') formIds.push(c.cellId);
    else (c.tier === 'new' ? newWords : reviewWords).push(c.word);
  }

  return {
    budget,
    reviewWords,
    reviewForms: groupByTable(formIds),
    newWords,
    drill,
    seconds: filled.seconds + (drill?.seconds ?? 0),
  };
}

// ─── The parts, in order ──────────────────────────────────────────────────────

export type SessionPart =
  | { id: 'review-words' | 'new-words'; kind: 'words'; title: string; words: HebrewVocabWord[] }
  | { id: 'review-forms' | 'drill'; kind: 'forms'; title: string; tables: FormTable[] }
  | { id: 'drill'; kind: 'accent'; title: string; items: number };

/** The plan's parts that have something in them, in the order they run. */
export function sessionParts(plan: SessionPlan): SessionPart[] {
  const parts: SessionPart[] = [];
  if (plan.reviewWords.length > 0) {
    parts.push({
      id: 'review-words',
      kind: 'words',
      title: 'Review words',
      words: plan.reviewWords,
    });
  }
  if (plan.reviewForms.length > 0) {
    parts.push({
      id: 'review-forms',
      kind: 'forms',
      title: 'Review forms',
      tables: plan.reviewForms,
    });
  }
  if (plan.newWords.length > 0) {
    parts.push({ id: 'new-words', kind: 'words', title: 'New words', words: plan.newWords });
  }
  const { drill } = plan;
  if (drill?.kind === 'accent') {
    parts.push({ id: 'drill', kind: 'accent', title: DRILL_TITLES.accent, items: drill.items });
  } else if (drill && drill.tables.length > 0) {
    parts.push({
      id: 'drill',
      kind: 'forms',
      title: DRILL_TITLES[drill.kind],
      tables: drill.tables,
    });
  }
  return parts;
}

/** Forms in a list of tables. */
export function formCount(tables: FormTable[]): number {
  return tables.reduce((n, t) => n + t.cellIds.length, 0);
}

// ─── The summary ──────────────────────────────────────────────────────────────

/** Whether a store key is something Today's Session studies. */
export function isSessionKey(key: string): boolean {
  return (
    key.startsWith(PARADIGM_KEY_PREFIX) ||
    key.startsWith(ACCENT_KEY_PREFIX) ||
    wordsByKey().has(key)
  );
}

/** Words, forms and accent items due by the end of tomorrow. */
export function sessionDueTomorrow(store: Store, now = new Date()): number {
  return dueTomorrow(store, isSessionKey, now);
}

/** "about 18 min", rounded up: an estimate should not promise less than it is. */
export function minutesText(seconds: number): string {
  return `about ${Math.max(1, Math.ceil(seconds / 60))} min`;
}
