// Checking the Accent-Shift Trainer's four steps, and scheduling its items
// (#185). Pure; `AccentTrainer.tsx` holds the state.
//
// The four steps, and what each is checked against:
//
// 1. **Syllables** are divided on the bare letters of the new form, דברים, not
//    the pointed one — the pointing is step 4's answer. A division is the set
//    of gaps between letters the student marked.
// 2. **Accent** is a syllable index.
// 3. **Positions** label every syllable before the accent pretonic or distant.
// 4. **Form** is typed with full pointing and compared syllable by syllable,
//    so a miss names the rule behind each syllable that came out wrong.
//
// A missed item comes back through the SRS store as `accent:<item id>`, the
// same store the flashcards and paradigm quiz use.

import { shuffle } from '@tools/shared/flashcard-session';
import { splitClusters } from '@tools/shared/ink';
import { createStepDrillHistory } from '@tools/shared/step-drill';
import {
  positionOf,
  SHIFT_ITEMS,
  type ShiftItem,
  type ShiftRuleId,
  type SyllablePosition,
} from '../data/accent-shift';
import {
  GRADE_QUALITY,
  isDue,
  newCard,
  nextSRS,
  type ReviewGrade,
  recordReview,
  type SRSCard,
  type StudyStats,
  shouldUpdateCard,
  todayStr,
} from '../data/srs';
import {
  type AnswerResult,
  applyFinalForms,
  checkHebrewAnswer,
  stripCantillation,
  stripNikud,
} from './hebrew-input';

export const STEP_LABELS = ['Syllables', 'Accent', 'Pretonic / distant', 'Form'] as const;

/** Steps 1–3; speed mode starts past them. */
export const SCAFFOLD_STEPS = 3;

export interface StepCheck {
  correct: boolean;
  /** The rules a miss broke, for the feedback panel. Empty when correct. */
  rules: ShiftRuleId[];
}

// ─── Step 1: syllables ───────────────────────────────────────────────────────

/** The new form's bare letters, one per cluster, in reading order. */
export function letters(form: string): string[] {
  return splitClusters(stripNikud(form.normalize('NFC'))).map((c) => c.base);
}

function letterCount(text: string): number {
  return letters(text).length;
}

/**
 * The correct division, as gap indexes: gap `g` sits after letter `g` (1-based),
 * so דְּ / בָ / רִים is `{1, 2}`.
 */
export function syllableGaps(item: ShiftItem): Set<number> {
  const gaps = new Set<number>();
  let at = 0;
  for (const s of item.syllables.slice(0, -1)) {
    at += letterCount(s.text);
    gaps.add(at);
  }
  return gaps;
}

/** A syllable that is one consonant and a sheva or hateph: דְּ, חֲ, פְ. */
function isReducedSyllable(text: string): boolean {
  return letterCount(text) === 1 && /[ְ-ֳ]/.test(text);
}

export function checkSyllables(item: ShiftItem, chosen: ReadonlySet<number>): StepCheck {
  const gaps = syllableGaps(item);
  const correct = gaps.size === chosen.size && [...gaps].every((g) => chosen.has(g));
  if (correct) return { correct, rules: [] };

  // A missed gap after a lone sheva syllable is the vocal-sheva convention;
  // anything else is the general rule.
  let at = 0;
  const rules = new Set<ShiftRuleId>();
  for (const s of item.syllables.slice(0, -1)) {
    at += letterCount(s.text);
    if (!chosen.has(at)) {
      rules.add(isReducedSyllable(s.text) ? 'vocal-sheva-syllable' : 'syllable-per-consonant');
    }
  }
  if ([...chosen].some((g) => !gaps.has(g))) rules.add('syllable-per-consonant');
  return { correct, rules: [...rules] };
}

// ─── Step 2: accent ──────────────────────────────────────────────────────────

export function checkAccent(item: ShiftItem, chosen: number | null): StepCheck {
  const correct = chosen === item.accent;
  return { correct, rules: correct ? [] : ['ending-takes-accent'] };
}

// ─── Step 3: positions ───────────────────────────────────────────────────────

export type PositionLabel = Exclude<SyllablePosition, 'accented'>;

export function expectedPositions(item: ShiftItem): (PositionLabel | null)[] {
  return item.syllables.map((_, i) => {
    const p = positionOf(i, item.accent);
    return p === 'accented' ? null : p;
  });
}

export function checkPositions(
  item: ShiftItem,
  chosen: ReadonlyArray<PositionLabel | null>,
): StepCheck {
  const rules = new Set<ShiftRuleId>();
  expectedPositions(item).forEach((want, i) => {
    if (want === null || chosen[i] === want) return;
    rules.add(want === 'pretonic' ? 'pretonic-position' : 'distant-position');
  });
  return { correct: rules.size === 0, rules: [...rules] };
}

// ─── Step 4: the form ────────────────────────────────────────────────────────

export interface FormCheck extends StepCheck {
  result: AnswerResult;
  /** Indexes of syllables whose pointing differs. All but the accent when unknown. */
  wrongSyllables: number[];
}

/** What was typed, finalized and stripped of anything the drill does not ask for. */
function normalizeTyped(input: string): string {
  return applyFinalForms(stripCantillation(input.trim())).normalize('NFC');
}

/** Split typed text into the item's syllables by letter count. */
function splitLike(item: ShiftItem, text: string): string[] {
  const clusters = splitClusters(text);
  const out: string[] = [];
  let at = 0;
  for (const s of item.syllables) {
    const n = letterCount(s.text);
    out.push(
      clusters
        .slice(at, at + n)
        .map((c) => c.text)
        .join(''),
    );
    at += n;
  }
  return out;
}

/**
 * A missing dagesh is accepted: the drill is about vowels, and the result still
 * says `dagesh-only` so the page can point it out. Wrong letters cannot be
 * attributed to a syllable, so every changed syllable's rule is offered.
 */
export function checkForm(item: ShiftItem, input: string): FormCheck {
  const typed = normalizeTyped(input);
  const result = checkHebrewAnswer(typed, item.form);
  if (result === 'correct' || result === 'dagesh-only') {
    return { correct: true, result, rules: [], wrongSyllables: [] };
  }

  let wrongSyllables: number[];
  if (result === 'nikud-only') {
    const got = splitLike(item, typed);
    wrongSyllables = item.syllables
      .map((s, i) =>
        ['correct', 'dagesh-only'].includes(checkHebrewAnswer(got[i], s.text)) ? -1 : i,
      )
      .filter((i) => i >= 0);
  } else {
    wrongSyllables = item.syllables.map((_, i) => i).filter((i) => i !== item.accent);
  }
  const rules = [...new Set(wrongSyllables.map((i) => item.syllables[i].rule))];
  return { correct: false, result, rules, wrongSyllables };
}

// ─── The attempt log ─────────────────────────────────────────────────────────

/** Concept ids for `@tools/shared/attempt-log`. Stable: renaming one splits its history. */
export const STEP_CONCEPTS = [
  'accent-shift/syllables',
  'accent-shift/accent',
  'accent-shift/positions',
] as const;

/** Step 4 logs one attempt per syllable, under the rule that sets its vowel. */
export function formConcepts(item: ShiftItem, check: FormCheck) {
  return item.syllables.map((s, i) => ({
    concept: `accent-shift/${s.rule}`,
    correct: !check.wrongSyllables.includes(i),
  }));
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

type Store = Record<string, SRSCard>;

/**
 * The SRS prefix for trainer items. Distinct from every other prefix in the
 * store (see "SRS key namespace" in this app's CLAUDE.md).
 */
export const ACCENT_KEY_PREFIX = 'accent:';

export function accentCardKey(itemId: string): string {
  return `${ACCENT_KEY_PREFIX}${itemId}`;
}

/**
 * Apply a finished item. A clean pass is `good`; any step that needed a second
 * try, or a reveal, is `again`, so the item comes back tomorrow. A repeat the
 * same day can demote but not promote (`shouldUpdateCard`).
 */
export function recordItem(
  store: Store,
  stats: StudyStats,
  itemId: string,
  clean: boolean,
): { store: Store; stats: StudyStats } {
  const grade: ReviewGrade = clean ? 'good' : 'again';
  const key = accentCardKey(itemId);
  const card = store[key] ?? newCard(key);
  const nextStats = recordReview(stats, clean);
  if (!shouldUpdateCard(card.lastReviewed === todayStr(), grade)) {
    return { store, stats: nextStats };
  }
  return { store: { ...store, [key]: nextSRS(card, GRADE_QUALITY[grade]) }, stats: nextStats };
}

/** Never seen, or due for review. */
export function isItemPending(item: ShiftItem, store: Store): boolean {
  const card = store[accentCardKey(item.id)];
  return !card || isDue(card);
}

/** Due and never-seen items first, each group shuffled, then the rest. */
export function buildQueue(
  store: Store,
  random: () => number = Math.random,
  items: ShiftItem[] = SHIFT_ITEMS,
): ShiftItem[] {
  return [
    ...shuffle(
      items.filter((i) => isItemPending(i, store)),
      random,
    ),
    ...shuffle(
      items.filter((i) => !isItemPending(i, store)),
      random,
    ),
  ];
}

// ─── Speed mode ──────────────────────────────────────────────────────────────

/** First-try results of steps 1–3, for `canSkipScaffold`. Local, never synced. */
export const SCAFFOLD_HISTORY_KEY = 'hebrew-tools-accent-scaffold-v1';

export const { loadHistory: loadScaffoldHistory, saveHistory: saveScaffoldHistory } =
  createStepDrillHistory(SCAFFOLD_HISTORY_KEY);
