/**
 * TodaySession — one daily session sized to a time budget (#184).
 *
 * Pick 20, 45 or 90 minutes and the session runs in order: due vocabulary,
 * due paradigm forms, then one short drill, ending on a summary. What goes in
 * is `lib/today.ts` over `@tools/shared/today`; this file runs it.
 *
 * Things to know before changing it:
 *
 * - **Every part reuses the page it comes from.** Vocabulary is the flashcard
 *   session hook with the flashcard's own `VocabCard`; forms and the ladder are
 *   `ParadigmQuiz` in its `session` mode; Accent Shift is `AccentTrainer` in
 *   its. Grading, scheduling and the attempt log are theirs, unchanged.
 * - **The clock decides between items, never during one.** Before each card,
 *   table or drill item the session asks `canStartNext`; a started item is
 *   always finished. That is what holds a session within 10% of its budget.
 * - **A session counts toward the streak once anything was answered.** Ending
 *   early or running out of time still counts; opening the page does not.
 * - **`/today?start=20` starts at once**, which is how the Study page's budget
 *   buttons make it one tap.
 * - **The first render is the same on server and client** (ADR 006): the
 *   plan is built from the store only after hydration.
 */

import DrillButtons from '@tools/shared/components/DrillButtons';
import GradeButtons from '@tools/shared/components/GradeButtons';
import { BudgetPicker, SessionSummaryCard } from '@tools/shared/components/TodaySession';
import { currentStudyStreak, emptyStudyStreak, studiedToday } from '@tools/shared/study-streak';
import {
  type ActiveClock,
  canStartNext,
  createActiveClock,
  formatMinutes,
  isTimeBudget,
  type Outcome,
  type SessionSummary,
  summarizeSession,
  type Tier,
  type TimeBudget,
} from '@tools/shared/today';
import {
  type FlashcardSessionEvent,
  type FlashcardStorage,
  useFlashcardSession,
} from '@tools/shared/use-flashcard-session';
import { useHydrated, useStoredState } from '@tools/shared/use-stored-state';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShiftItem } from '../data/accent-shift';
import { loadSRSStore, loadStats, newCard, saveSRSStore, saveStats } from '../data/srs';
import type { HebrewVocabWord } from '../data/vocabulary';
import { loadFlashcardSettings } from '../lib/flashcard-settings';
import { getQuizCells } from '../lib/paradigm-quiz';
import { loadStudyStreak, markSessionComplete } from '../lib/study-streak';
import { loadLadderProgress } from '../lib/suffix-ladder';
import {
  buildHebrewPlan,
  countForms,
  DEFAULT_BUDGET,
  DRILL_LABELS,
  type DrillKind,
  dueTomorrow,
  type FormsRound,
  type HebrewTodayPlan,
  loadBudget,
  SECONDS,
  SECTION_LABELS,
  saveBudget,
  vocabSrsKey,
} from '../lib/today';
import AccentTrainer from './AccentTrainer';
import ErrorBoundary from './ErrorBoundary';
import ParadigmQuiz from './ParadigmQuiz';
import VocabCard from './VocabCard';

const ACCENT = 'var(--color-primary, #15803D)';

const STORAGE: FlashcardStorage = {
  loadStore: loadSRSStore,
  saveStore: saveSRSStore,
  loadStats,
  saveStats,
};

// ─── Steps ────────────────────────────────────────────────────────────────────

type Section = keyof typeof SECTION_LABELS;

interface PracticeRound extends FormsRound {
  practice: boolean;
}

/** One part of the session, in the order it runs. */
export type Step =
  | { kind: 'vocab'; mode: 'srs' | 'all'; words: HebrewVocabWord[]; label: string }
  | { kind: 'forms'; section: Section; rounds: PracticeRound[]; label: string }
  | { kind: 'accent'; items: ShiftItem[]; label: string };

/** Why the session ended, for the summary and for analytics. */
type EndReason = 'done' | 'time' | 'early';

/**
 * The plan as steps. Vocabulary is due cards only (#224).
 */
export function planSteps(plan: HebrewTodayPlan): Step[] {
  const steps: Step[] = [];
  const items = (id: string) => plan.sections.find((s) => s.id === id)?.items ?? [];

  const vocab = items('vocab');
  const words = (tiers: Tier[]) =>
    vocab.flatMap((i) =>
      tiers.includes(i.tier) && i.payload.kind === 'vocab' ? [i.payload.word] : [],
    );
  const review = words(['due']);
  if (review.length) steps.push({ kind: 'vocab', mode: 'srs', words: review, label: 'Vocabulary' });

  const rounds = items('forms').flatMap((i) =>
    i.payload.kind === 'forms'
      ? [{ table: i.payload.table, blankIds: i.payload.blankIds, practice: i.tier === 'weak' }]
      : [],
  );
  if (rounds.length)
    steps.push({ kind: 'forms', section: 'forms', rounds, label: 'Paradigm forms' });

  const drill = plan.drill?.payload;
  if (drill) {
    const label = `Drill: ${DRILL_LABELS[drill.kind]}`;
    if (drill.kind === 'accent') steps.push({ kind: 'accent', items: drill.items, label });
    if (drill.kind === 'ladder') {
      const blankIds = getIds(drill.table);
      steps.push({
        kind: 'forms',
        section: 'drill',
        rounds: [{ table: drill.table, blankIds, practice: false }],
        label,
      });
    }
    if (drill.kind === 'mixed') {
      steps.push({
        kind: 'forms',
        section: 'drill',
        rounds: drill.rounds.map((r) => ({ ...r, practice: true })),
        label,
      });
    }
  }
  return steps;
}

/** Every form in a table: the ladder drill is a Full-table write. */
function getIds(table: FormsRound['table']): string[] {
  return getQuizCells(table).flatMap((c) => (c.id ? [c.id] : []));
}

/** The estimate for a step's first item, for the clock. */
function firstItemSeconds(step: Step): number {
  if (step.kind === 'vocab') return SECONDS.vocab;
  if (step.kind === 'accent') return SECONDS.accentItem;
  return step.rounds[0].blankIds.length * SECONDS.formCell;
}

// ─── Parts ────────────────────────────────────────────────────────────────────

interface PartProps {
  onOutcome: (section: Section, id: string, correct: boolean) => void;
  canStart: (seconds: number) => boolean;
  onDone: (reason: 'done' | 'time') => void;
}

function VocabPart({
  step,
  onOutcome,
  canStart,
  onDone,
}: PartProps & { step: Extract<Step, { kind: 'vocab' }> }) {
  const showPartOfSpeech = useMemo(() => loadFlashcardSettings().showPartOfSpeech, []);
  const cardRef = useRef<HebrewVocabWord | null>(null);
  const [outOfTime, setOutOfTime] = useState(false);

  const onEvent = (event: FlashcardSessionEvent) => {
    const word = cardRef.current;
    if (!word) return;
    if (event.type === 'reviewed') {
      onOutcome('vocab', vocabSrsKey(word), event.result === 'correct');
      posthog.capture('hebrew_flashcard_reviewed', {
        result: event.result,
        grade: event.grade,
        interval_days: event.intervalDays,
        source: 'today',
      });
    } else if (event.type === 'drilled') {
      if (event.firstAttempt) onOutcome('vocab', vocabSrsKey(word), event.result === 'correct');
    } else {
      return;
    }
    if (!canStart(SECONDS.vocab)) setOutOfTime(true);
  };

  const { card, flipped, flip, review, drill, sessionDone, srsStore, index, queue } =
    useFlashcardSession({
      words: step.words,
      getKey: vocabSrsKey,
      studyMode: step.mode,
      restartKey: 'today',
      storage: STORAGE,
      onEvent,
    });
  cardRef.current = card ?? null;

  useEffect(() => {
    if (outOfTime) onDone('time');
    else if (sessionDone) onDone('done');
  }, [outOfTime, sessionDone, onDone]);

  if (!card) return <p className="text-text-muted">Dealing the cards…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted" data-testid="today-card-progress">
        Card {Math.min(index + 1, queue.length)} of {queue.length}
        {step.mode === 'all' && ' · practice, not scheduled'}
      </p>
      <VocabCard card={card} flipped={flipped} onFlip={flip} showPartOfSpeech={showPartOfSpeech} />
      {flipped &&
        (step.mode === 'srs' ? (
          <GradeButtons
            card={srsStore[vocabSrsKey(card)] ?? newCard(vocabSrsKey(card))}
            onGrade={review}
          />
        ) : (
          <DrillButtons onAnswer={drill} />
        ))}
    </div>
  );
}

function FormsPart({
  step,
  onOutcome,
  canStart,
  onDone,
}: PartProps & { step: Extract<Step, { kind: 'forms' }> }) {
  const [at, setAt] = useState(0);
  const round = step.rounds[at];
  return (
    <div className="space-y-2">
      {step.rounds.length > 1 && (
        <p className="text-sm text-text-muted">
          Table {at + 1} of {step.rounds.length}
          {round.practice && ' · practice, not scheduled ahead'}
        </p>
      )}
      <ParadigmQuiz
        key={at}
        session={{
          table: round.table,
          blankIds: round.blankIds,
          practice: round.practice,
          onChecked: (outcomes) => {
            for (const o of outcomes) onOutcome(step.section, o.id, o.correct);
          },
          onContinue: () => {
            const next = step.rounds[at + 1];
            if (!next) onDone('done');
            else if (canStart(next.blankIds.length * SECONDS.formCell)) setAt(at + 1);
            else onDone('time');
          },
        }}
      />
    </div>
  );
}

function AccentPart({
  step,
  onOutcome,
  canStart,
  onDone,
}: PartProps & { step: Extract<Step, { kind: 'accent' }> }) {
  const finishedAll = useRef(0);
  return (
    <AccentTrainer
      session={{
        items: step.items,
        onItemDone: (id, clean) => {
          finishedAll.current++;
          onOutcome('drill', id, clean);
        },
        canContinue: () => canStart(SECONDS.accentItem),
        onFinished: () => onDone(finishedAll.current >= step.items.length ? 'done' : 'time'),
      }}
    />
  );
}

// ─── The session ──────────────────────────────────────────────────────────────

function Runner({
  steps,
  budget,
  clock,
  onOutcome,
  onEnd,
}: {
  steps: Step[];
  budget: TimeBudget;
  clock: ActiveClock;
  onOutcome: PartProps['onOutcome'];
  onEnd: (reason: EndReason) => void;
}) {
  const [at, setAt] = useState(0);
  const [, tick] = useState(0);

  // Redraw the minutes now and then; the clock itself never needs a render.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const canStart = useCallback(
    (seconds: number) => canStartNext(clock.elapsedMs(), seconds, budget),
    [clock, budget],
  );

  const onDone = useCallback(
    (reason: 'done' | 'time') => {
      if (reason === 'time') return onEnd('time');
      const next = steps[at + 1];
      if (!next) return onEnd('done');
      if (!canStart(firstItemSeconds(next))) return onEnd('time');
      setAt(at + 1);
    },
    [at, steps, canStart, onEnd],
  );

  const step = steps[at];
  const minutes = Math.floor(clock.elapsedMs() / 60_000);
  const props = { onOutcome, canStart, onDone };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-card rounded-2xl border-2 border-primary/10 px-4 py-2.5 shadow-sm">
        <p className="text-sm font-semibold text-primary" aria-live="polite">
          Part {at + 1} of {steps.length}: {step.label}
        </p>
        <div className="flex items-center gap-4">
          <p className="text-sm text-text-muted" data-testid="today-clock">
            {minutes} of {budget} min
          </p>
          <button
            type="button"
            onClick={() => onEnd('early')}
            className="text-sm text-text-muted underline hover:text-primary"
          >
            End session
          </button>
        </div>
      </div>
      {step.kind === 'vocab' && <VocabPart key={at} step={step} {...props} />}
      {step.kind === 'forms' && <FormsPart key={at} step={step} {...props} />}
      {step.kind === 'accent' && <AccentPart key={at} step={step} {...props} />}
    </div>
  );
}

function PlanPreview({ plan }: { plan: HebrewTodayPlan }) {
  const tiers = (id: string) => {
    const counts: Record<Tier, number> = { due: 0, weak: 0, new: 0 };
    for (const i of plan.sections.find((s) => s.id === id)?.items ?? []) {
      counts[i.tier] += i.payload.kind === 'forms' ? i.payload.blankIds.length : 1;
    }
    return counts;
  };
  const describe = ({ due, weak, new: fresh }: Record<Tier, number>) =>
    [due && `${due} due`, weak && `${weak} to strengthen`, fresh && `${fresh} new`]
      .filter(Boolean)
      .join(', ');

  const vocab = tiers('vocab');
  const vocabTotal = vocab.due;
  const forms = countForms(plan);
  const drill = plan.drill?.payload;
  const waiting = plan.leftOut.due;

  return (
    <div className="space-y-2">
      <ol className="space-y-2 text-sm">
        <li className="flex justify-between gap-3">
          <span className="font-semibold text-text">1. Vocabulary</span>
          <span className="text-text-muted text-right">
            {vocabTotal ? `${count(vocabTotal, 'card')} due` : 'Nothing due'}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="font-semibold text-text">2. Paradigm forms</span>
          <span className="text-text-muted text-right">
            {forms ? `${count(forms, 'form')} (${describe(tiers('forms'))})` : 'Nothing due'}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="font-semibold text-text">3. Drill</span>
          <span className="text-text-muted text-right">
            {drill ? drillDetail(drill.kind, plan) : 'None today'}
          </span>
        </li>
      </ol>
      {vocabTotal + forms === 0 && (
        <p className="text-sm text-text-muted" data-testid="nothing-due">
          Nothing is due today. New words are introduced on{' '}
          <a href="/flashcards" className="text-primary underline">
            Flashcards
          </a>
          .
        </p>
      )}
      <p className="text-sm text-text-muted">
        About {formatMinutes(plan.plannedSeconds)} of {plan.budget}.
        {waiting > 0 &&
          ` ${waiting} due ${waiting === 1 ? 'item waits' : 'items wait'} for tomorrow; a longer budget fits more.`}
      </p>
    </div>
  );
}

/** "1 form", "3 forms". */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function drillDetail(kind: DrillKind, plan: HebrewTodayPlan): string {
  const drill = plan.drill?.payload;
  const label = DRILL_LABELS[kind];
  if (drill?.kind === 'accent') return `${label}, ${count(drill.items.length, 'word')}`;
  if (drill?.kind === 'ladder') return `${label}, ${drill.table.label.replace(/^Rung \d+ — /, '')}`;
  if (drill?.kind === 'mixed') {
    const n = drill.rounds.reduce((sum, r) => sum + r.blankIds.length, 0);
    return `${label}, ${count(n, 'form')}`;
  }
  return label;
}

type Phase =
  | { name: 'pick' }
  | { name: 'run'; plan: HebrewTodayPlan; steps: Step[] }
  | {
      name: 'summary';
      plan: HebrewTodayPlan;
      summary: SessionSummary;
      reason: EndReason;
      streak: number;
      dueTomorrow: number;
    };

const END_NOTES: Record<EndReason, string> = {
  done: 'Everything planned is done.',
  time: 'Time was up, so the rest waits for tomorrow.',
  early: 'Ended early.',
};

function TodaySessionInner() {
  const hydrated = useHydrated();
  const [budget, setBudget] = useStoredState(loadBudget, DEFAULT_BUDGET, saveBudget);
  const [streakData, setStreakData] = useStoredState(loadStudyStreak, emptyStudyStreak());
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  // Bumped after a session, so the preview is rebuilt from the updated store.
  const [version, setVersion] = useState(0);
  const clock = useRef(createActiveClock());
  const outcomes = useRef<Outcome[]>([]);

  const preview = useMemo(
    () =>
      hydrated && phase.name === 'pick'
        ? buildHebrewPlan({
            budget,
            store: loadSRSStore(),
            ladder: loadLadderProgress(),
          })
        : null,
    // `version` rebuilds it after a session.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above
    [hydrated, budget, phase.name, version],
  );

  const start = useCallback((plan: HebrewTodayPlan) => {
    outcomes.current = [];
    clock.current = createActiveClock();
    clock.current.start();
    setPhase({ name: 'run', plan, steps: planSteps(plan) });
    posthog.capture('hebrew_today_started', {
      budget: plan.budget,
      vocab: plan.sections.find((s) => s.id === 'vocab')?.items.length ?? 0,
      forms: countForms(plan),
      drill: plan.drill?.payload.kind ?? null,
      planned_seconds: plan.plannedSeconds,
    });
  }, []);

  // `/today?start=45`: the Study page's one-tap start.
  useEffect(() => {
    const requested = Number(new URLSearchParams(window.location.search).get('start'));
    if (!isTimeBudget(requested)) return;
    window.history.replaceState(null, '', window.location.pathname);
    setBudget(requested);
    start(
      buildHebrewPlan({
        budget: requested,
        store: loadSRSStore(),
        ladder: loadLadderProgress(),
      }),
    );
  }, [setBudget, start]);

  // The clock runs only while the session is on screen.
  useEffect(() => {
    if (phase.name !== 'run') return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clock.current.pause();
      else clock.current.start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase.name]);

  const onOutcome = useCallback((section: Section, id: string, correct: boolean) => {
    outcomes.current.push({ section, id, correct });
  }, []);

  const end = useCallback(
    (reason: EndReason) => {
      if (phase.name !== 'run') return;
      clock.current.pause();
      const summary = summarizeSession(outcomes.current);
      const streak = summary.reviewed > 0 ? markSessionComplete() : loadStudyStreak();
      setStreakData(streak);
      setPhase({
        name: 'summary',
        plan: phase.plan,
        summary,
        reason,
        streak: currentStudyStreak(streak),
        dueTomorrow: dueTomorrow(loadSRSStore()),
      });
      posthog.capture('hebrew_today_finished', {
        budget: phase.plan.budget,
        reason,
        reviewed: summary.reviewed,
        missed: summary.missed,
        elapsed_seconds: Math.round(clock.current.elapsedMs() / 1000),
      });
    },
    [phase, setStreakData],
  );

  if (phase.name === 'run') {
    return (
      <Runner
        steps={phase.steps}
        budget={phase.plan.budget}
        clock={clock.current}
        onOutcome={onOutcome}
        onEnd={end}
      />
    );
  }

  if (phase.name === 'summary') {
    const drillKind = phase.plan.drill?.payload.kind;
    const rows = (['vocab', 'forms', 'drill'] as const)
      .filter((s) => phase.summary.bySection[s])
      .map((s) => ({
        label: s === 'drill' && drillKind ? DRILL_LABELS[drillKind] : SECTION_LABELS[s],
        ...phase.summary.bySection[s],
      }));
    return (
      <div className="space-y-5 max-w-xl">
        <h2 className="text-2xl font-bold text-text">Session complete</h2>
        <SessionSummaryCard
          rows={rows}
          reviewed={phase.summary.reviewed}
          missed={phase.summary.missed}
          dueTomorrow={phase.dueTomorrow}
          streak={phase.streak}
          accent={ACCENT}
          note={END_NOTES[phase.reason]}
        />
        {phase.summary.missed > 0 && (
          <p className="text-sm text-text-muted">
            What you missed is already scheduled to come back. Nothing else to do.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <a
            href="/study"
            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-primary text-white"
          >
            Back to Study
          </a>
          <button
            type="button"
            onClick={() => {
              setVersion((v) => v + 1);
              setPhase({ name: 'pick' });
            }}
            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-bg-card text-primary border border-primary/15"
          >
            Plan another session
          </button>
        </div>
      </div>
    );
  }

  const streak = currentStudyStreak(streakData);
  const doneToday = studiedToday(streakData);

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-bg-card rounded-2xl border-2 border-primary/10 p-5 shadow-sm space-y-5">
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">
            How long do you have?
          </h2>
          <BudgetPicker value={budget} onChange={setBudget} accent={ACCENT} />
        </div>
        {preview ? (
          <PlanPreview plan={preview} />
        ) : (
          <p className="text-sm text-text-muted">Planning today’s session…</p>
        )}
        <button
          type="button"
          disabled={!preview}
          onClick={() => preview && start(preview)}
          className="w-full px-6 py-3 rounded-xl font-bold bg-primary text-white disabled:opacity-50"
        >
          Start {budget}-minute session
        </button>
      </div>
      <p className="text-sm text-text-muted" data-testid="today-streak">
        {hydrated && streak > 0
          ? `Study streak: ${streak} day${streak === 1 ? '' : 's'}${doneToday ? ' · today is done' : ''}.`
          : 'Finish a session to start a study streak.'}
      </p>
    </div>
  );
}

export default function TodaySession() {
  return (
    <ErrorBoundary component="TodaySession">
      <TodaySessionInner />
    </ErrorBoundary>
  );
}
