/**
 * TodaySession: one daily session sized to a time budget (#197).
 *
 * Pick 20, 45 or 90 minutes and the session runs in order: due vocabulary,
 * then one short drill, ending on a summary. What goes in is `lib/today.ts`
 * over `@tools/shared/today`; this file runs it.
 *
 * Things to know before changing it:
 *
 * - **Every part reuses the page it comes from.** Vocabulary is the flashcard
 *   session hook with the flashcard's own `VocabCard`; the parse drill is
 *   `ParseQuestion` and `ParseFeedback`. Grading and scheduling are theirs.
 * - **The clock decides between items, never during one.** Before each card or
 *   parse item the session asks `canStartNext`; a started item is always
 *   finished. That is what holds a session within 10% of its budget.
 * - **A session counts toward the streak once anything was answered.** Ending
 *   early or running out of time still counts; opening the page does not.
 * - **`/today?start=20` starts at once**, which is how the Study page's budget
 *   buttons make it one tap.
 * - **The first render is the same on server and client** (ADR 006): the plan
 *   is built from the stores only after hydration.
 * - **The drill is one `Step` kind per drill.** The ladder (#199) adds a kind
 *   to `TodayDrill` in `lib/today.ts` and a branch in `planSteps`.
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
import { loadFocusPassages, loadParseHistoryStore } from '../data/focusPassages';
import { loadSRSStore, loadStats, newCard, saveSRSStore, saveStats } from '../data/srs';
import type { VocabWord } from '../data/vocabulary';
import { loadAttempts, logAttempts } from '../lib/attempt-log';
import { loadFlashcardSettings } from '../lib/flashcard-settings';
import { parseFormConcept } from '../lib/parse-attempts';
import { loadStudyStreak, markSessionComplete } from '../lib/study-streak';
import {
  buildGreekPlan,
  DEFAULT_BUDGET,
  DRILL_LABELS,
  type DrillKind,
  dueTomorrow,
  type GreekTodayPlan,
  loadBudget,
  SECONDS,
  SECTION_LABELS,
  saveBudget,
  vocabSrsKey,
  type WeakPassage,
  weakestPassage,
} from '../lib/today';
import { emptyAnswer, gradeAnswer, type ParseAnswer, type ParseItem } from '../lib/verb-parse';
import ErrorBoundary from './ErrorBoundary';
import ParseFeedback from './ParseFeedback';
import ParseQuestion from './ParseQuestion';
import VocabCard from './VocabCard';

const ACCENT = 'var(--color-primary, #1D4ED8)';

const STORAGE: FlashcardStorage = {
  loadStore: loadSRSStore,
  saveStore: saveSRSStore,
  loadStats,
  saveStats,
};

// ─── Steps ────────────────────────────────────────────────────────────────────

type Section = keyof typeof SECTION_LABELS;

/** One part of the session, in the order it runs. */
export type Step =
  | { kind: 'vocab'; mode: 'srs' | 'all'; section: Section; words: VocabWord[]; label: string }
  | { kind: 'parse'; items: ParseItem[]; label: string };

/** Why the session ended, for the summary and for analytics. */
type EndReason = 'done' | 'time' | 'early';

/** The plan as steps. Vocabulary is due cards only. */
export function planSteps(plan: GreekTodayPlan): Step[] {
  const steps: Step[] = [];
  const due = (plan.sections.find((s) => s.id === 'vocab')?.items ?? []).map((i) => i.payload.word);
  if (due.length) {
    steps.push({ kind: 'vocab', mode: 'srs', section: 'vocab', words: due, label: 'Vocabulary' });
  }

  const drill = plan.drill?.payload;
  if (drill) {
    const label = `Drill: ${DRILL_LABELS[drill.kind]}`;
    if (drill.kind === 'parse') steps.push({ kind: 'parse', items: drill.items, label });
    if (drill.kind === 'mixed') {
      steps.push({ kind: 'vocab', mode: 'all', section: 'drill', words: drill.words, label });
    }
  }
  return steps;
}

/** The estimate for a step's first item, for the clock. */
function firstItemSeconds(step: Step): number {
  return step.kind === 'vocab' ? SECONDS.vocab : SECONDS.parseItem;
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
  const cardRef = useRef<VocabWord | null>(null);
  const [outOfTime, setOutOfTime] = useState(false);

  const onEvent = (event: FlashcardSessionEvent) => {
    const word = cardRef.current;
    if (!word) return;
    if (event.type === 'reviewed') {
      onOutcome(step.section, vocabSrsKey(word), event.result === 'correct');
      posthog.capture('flashcard_reviewed', {
        result: event.result,
        grade: event.grade,
        interval_days: event.intervalDays,
        source: 'today',
      });
    } else if (event.type === 'drilled') {
      if (event.firstAttempt)
        onOutcome(step.section, vocabSrsKey(word), event.result === 'correct');
    } else {
      return;
    }
    if (!canStart(SECONDS.vocab)) setOutOfTime(true);
  };

  const { card, flipped, flip, revealed, review, drill, sessionDone, srsStore, index, queue } =
    useFlashcardSession<VocabWord, boolean>({
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
      <VocabCard
        card={card}
        direction="gr-en"
        answerMode="flip"
        flipped={flipped}
        revealed={revealed}
        onFlip={flip}
        showPartOfSpeech={showPartOfSpeech}
        back={card.gloss}
      />
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

const parseItemId = (item: ParseItem) => `${item.paradigmLabel}|${item.form}`;

function ParsePart({
  step,
  onOutcome,
  canStart,
  onDone,
}: PartProps & { step: Extract<Step, { kind: 'parse' }> }) {
  const [at, setAt] = useState(0);
  const [answer, setAnswer] = useState<ParseAnswer>(emptyAnswer());
  const [result, setResult] = useState<ReturnType<typeof gradeAnswer> | null>(null);
  const item = step.items[at];
  const isLast = at + 1 >= step.items.length;

  const submit = () => {
    const graded = gradeAnswer(item, answer);
    setResult(graded);
    onOutcome('drill', parseItemId(item), graded.allCorrect);
    // The shared log: the next session reads it to ask about what is missed.
    // (Aggregate totals are per focus passage, and this is no passage's.)
    logAttempts([{ concept: parseFormConcept(item), correct: graded.allCorrect }]);
  };

  const next = () => {
    if (isLast) return onDone('done');
    if (!canStart(SECONDS.parseItem)) return onDone('time');
    setAt(at + 1);
    setAnswer(emptyAnswer());
    setResult(null);
  };

  return result ? (
    <ParseFeedback item={item} answer={answer} result={result} onNext={next} isLast={isLast} />
  ) : (
    <ParseQuestion
      item={item}
      index={at}
      total={step.items.length}
      answer={answer}
      onChange={setAnswer}
      onSubmit={submit}
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
      {step.kind === 'parse' && <ParsePart key={at} step={step} {...props} />}
    </div>
  );
}

/** "1 card", "3 cards". */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function drillDetail(plan: GreekTodayPlan): string {
  const drill = plan.drill?.payload;
  if (!drill) return 'None today';
  const label = DRILL_LABELS[drill.kind];
  return drill.kind === 'parse'
    ? `${label}, ${count(drill.items.length, 'form')}`
    : `${label}, ${count(drill.words.length, 'word')}`;
}

function WeakPassageHint({ passage }: { passage: WeakPassage }) {
  return (
    <p className="text-sm text-text-muted" data-testid="weak-passage">
      Parsing in{' '}
      <a href={`/focus/${passage.id}`} className="text-primary underline">
        {passage.label}
      </a>{' '}
      is at {Math.round(passage.accuracy * 100)}%. A passage drill there would help.
    </p>
  );
}

function PlanPreview({ plan, weak }: { plan: GreekTodayPlan; weak: WeakPassage | null }) {
  const vocab = plan.sections.find((s) => s.id === 'vocab')?.items.length ?? 0;
  const waiting = plan.leftOut.due;

  return (
    <div className="space-y-2">
      <ol className="space-y-2 text-sm">
        <li className="flex justify-between gap-3">
          <span className="font-semibold text-text">1. Vocabulary</span>
          <span className="text-text-muted text-right">
            {vocab ? `${count(vocab, 'card')} due` : 'Nothing due'}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="font-semibold text-text">2. Drill</span>
          <span className="text-text-muted text-right">{drillDetail(plan)}</span>
        </li>
      </ol>
      {vocab === 0 && (
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
          ` ${waiting} due ${waiting === 1 ? 'card waits' : 'cards wait'} for tomorrow; a longer budget fits more.`}
      </p>
      {weak && <WeakPassageHint passage={weak} />}
    </div>
  );
}

type Phase =
  | { name: 'pick' }
  | { name: 'run'; plan: GreekTodayPlan; steps: Step[] }
  | {
      name: 'summary';
      plan: GreekTodayPlan;
      summary: SessionSummary;
      reason: EndReason;
      streak: number;
      dueTomorrow: number;
      weak: WeakPassage | null;
    };

const END_NOTES: Record<EndReason, string> = {
  done: 'Everything planned is done.',
  time: 'Time was up, so the rest waits for tomorrow.',
  early: 'Ended early.',
};

/** The plan from what is stored now. */
function planFor(budget: TimeBudget): GreekTodayPlan {
  return buildGreekPlan({ budget, store: loadSRSStore(), attempts: loadAttempts() });
}

function currentWeakPassage(): WeakPassage | null {
  return weakestPassage(loadFocusPassages(), loadParseHistoryStore(), loadAttempts());
}

function TodaySessionInner() {
  const hydrated = useHydrated();
  const [budget, setBudget] = useStoredState(loadBudget, DEFAULT_BUDGET, saveBudget);
  const [streakData, setStreakData] = useStoredState(loadStudyStreak, emptyStudyStreak());
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  // Bumped after a session, so the preview is rebuilt from the updated stores.
  const [version, setVersion] = useState(0);
  const clock = useRef(createActiveClock());
  const outcomes = useRef<Outcome[]>([]);

  const preview = useMemo(
    () =>
      hydrated && phase.name === 'pick'
        ? { plan: planFor(budget), weak: currentWeakPassage() }
        : null,
    // `version` rebuilds it after a session.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above
    [hydrated, budget, phase.name, version],
  );

  const start = useCallback((plan: GreekTodayPlan) => {
    outcomes.current = [];
    clock.current = createActiveClock();
    clock.current.start();
    setPhase({ name: 'run', plan, steps: planSteps(plan) });
    posthog.capture('today_started', {
      budget: plan.budget,
      vocab: plan.sections.find((s) => s.id === 'vocab')?.items.length ?? 0,
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
    start(planFor(requested));
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
        weak: currentWeakPassage(),
      });
      posthog.capture('today_finished', {
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
    const drillKind: DrillKind | undefined = phase.plan.drill?.payload.kind;
    const rows = (['vocab', 'drill'] as const)
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
        {phase.weak && <WeakPassageHint passage={phase.weak} />}
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
          <PlanPreview plan={preview.plan} weak={preview.weak} />
        ) : (
          <p className="text-sm text-text-muted">Planning today’s session…</p>
        )}
        <button
          type="button"
          disabled={!preview}
          onClick={() => preview && start(preview.plan)}
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
