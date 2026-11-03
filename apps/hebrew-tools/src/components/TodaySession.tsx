/**
 * TodaySession — one daily session sized to a time budget (#184).
 *
 * The student picks 20, 45 or 90 minutes and taps Start. The session runs in
 * up to four parts — review words, review forms, new words, the drill — and
 * ends with a summary. What goes in each part, and why in that order, is
 * `lib/today-session.ts`; this file runs it.
 *
 * Things to know before changing it:
 *
 * - **Every part studies through the same code as its own page.** Words go
 *   through `useFlashcardSession` and `VocabCard`, forms through
 *   `ParadigmAttempt`, the accent drill through `AccentTrainer`. A form written
 *   here is scheduled, logged and counted toward the ladder exactly as it is on
 *   /paradigms; nothing here writes the SRS store itself.
 * - **The start screen is planned after hydration.** The plan reads the SRS
 *   store, which the prerendering server does not have, so the first render
 *   says "Planning…" on both sides (see "Hydration" in the repo CLAUDE.md).
 * - **Only a finished session extends the study streak.** Ending early keeps
 *   every review already graded, but the day is not counted.
 * - **The tally counts as it goes**, not at the end of a part, so a session
 *   ended early still reports what was done.
 */

import GradeButtons from '@tools/shared/components/GradeButtons';
import type { DailyStreakData } from '@tools/shared/daily';
import { currentStreak, SESSION_BUDGETS, type SessionBudget } from '@tools/shared/today-session';
import { type FlashcardStorage, useFlashcardSession } from '@tools/shared/use-flashcard-session';
import { useHydrated, useStoredState } from '@tools/shared/use-stored-state';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadSRSStore, loadStats, newCard, saveSRSStore, saveStats } from '../data/srs';
import { type HebrewVocabWord, vocabSrsKey } from '../data/vocabulary';
import { loadSelection } from '../lib/deck-selection';
import { loadFlashcardSettings } from '../lib/flashcard-settings';
import { loadQuizSettings, saveQuizSettings } from '../lib/quiz-settings';
import { loadLadderProgress } from '../lib/suffix-ladder';
import {
  buildSessionPlan,
  DEFAULT_BUDGET,
  DRILL_TITLES,
  type FormTable,
  formCells,
  formCount,
  loadBudget,
  loadStudyStreak,
  markStudiedToday,
  minutesText,
  type SessionPart,
  type SessionPlan,
  saveBudget,
  sessionDueTomorrow,
  sessionParts,
} from '../lib/today-session';
import AccentTrainer from './AccentTrainer';
import ErrorBoundary from './ErrorBoundary';
import ParadigmAttempt from './ParadigmAttempt';
import VocabCard from './VocabCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tally {
  reviewed: number;
  missed: number;
}

const NO_TALLY: Tally = { reviewed: 0, missed: 0 };
const NO_STREAK: DailyStreakData = { streak: 0, lastReadDate: '' };

type Stage =
  | { name: 'start' }
  | { name: 'running'; plan: SessionPlan; parts: SessionPart[]; part: number; startedAt: number }
  | { name: 'done'; finished: boolean; streak: number; dueTomorrow: number };

const STORAGE: FlashcardStorage = {
  loadStore: loadSRSStore,
  saveStore: saveSRSStore,
  loadStats,
  saveStats,
};

const PRIMARY_BUTTON =
  'px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-white hover:opacity-90 transition-opacity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the plan holds, one phrase per part. Exported for its test. */
export function planLines(plan: SessionPlan): string[] {
  const lines: string[] = [];
  if (plan.reviewWords.length > 0)
    lines.push(`${plural(plan.reviewWords.length, 'word')} to review`);
  const forms = formCount(plan.reviewForms);
  if (forms > 0) lines.push(`${plural(forms, 'form')} to review`);
  if (plan.newWords.length > 0) lines.push(plural(plan.newWords.length, 'new word'));
  if (plan.drill) lines.push(`Drill: ${DRILL_TITLES[plan.drill.kind]}`);
  return lines;
}

// ─── Parts ────────────────────────────────────────────────────────────────────

interface PartProps {
  onProgress: (delta: Tally) => void;
  onDone: () => void;
}

/** Words, graded on the SRS scale, in the planned order. */
function WordsPart({
  id,
  words,
  onProgress,
  onDone,
}: PartProps & { id: string; words: HebrewVocabWord[] }) {
  const [showPartOfSpeech] = useState(() => loadFlashcardSettings().showPartOfSpeech);
  const { card, index, queue, flipped, flip, review, sessionDone, srsStore } = useFlashcardSession({
    words,
    getKey: vocabSrsKey,
    studyMode: 'srs',
    restartKey: id,
    storage: STORAGE,
    dealAsGiven: true,
    onEvent: (event) => {
      if (event.type !== 'reviewed') return;
      onProgress({ reviewed: 1, missed: event.result === 'incorrect' ? 1 : 0 });
      posthog.capture('hebrew_flashcard_reviewed', {
        result: event.result,
        grade: event.grade,
        interval_days: event.intervalDays,
        source: 'session',
      });
    },
  });

  useEffect(() => {
    if (sessionDone) onDone();
  }, [sessionDone, onDone]);

  if (!card) return null;
  const key = vocabSrsKey(card);
  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Word {Math.min(index + 1, queue.length)} of {queue.length}
      </p>
      <VocabCard card={card} flipped={flipped} onFlip={flip} showPartOfSpeech={showPartOfSpeech} />
      {flipped && <GradeButtons card={srsStore[key] ?? newCard(key)} onGrade={review} />}
    </div>
  );
}

/** Tables, one after another, with the planned cells blank. */
function FormsPart({ tables, onProgress, onDone }: PartProps & { tables: FormTable[] }) {
  const [at, setAt] = useState(0);
  const [settings, setSettings] = useState(loadQuizSettings);
  const setStrict = (on: boolean) => {
    const next = { ...settings, accentStrict: on };
    saveQuizSettings(next);
    setSettings(next);
  };
  const current = tables[at];
  const cells = useMemo(() => formCells(current), [current]);
  const last = at === tables.length - 1;
  return (
    <div className="space-y-3">
      {tables.length > 1 && (
        <p className="text-xs text-text-muted">
          Table {at + 1} of {tables.length}
        </p>
      )}
      <ParadigmAttempt
        key={at}
        table={current.table}
        cells={cells}
        modeName="Today’s forms"
        strict={settings.accentStrict}
        onStrictChange={setStrict}
        source="session"
        onSubmitted={(attempt) =>
          onProgress({ reviewed: attempt.total, missed: attempt.total - attempt.right })
        }
        resultsActions={
          <button
            type="button"
            onClick={() => (last ? onDone() : setAt((i) => i + 1))}
            className={PRIMARY_BUTTON}
          >
            {last ? 'Continue' : 'Next table'}
          </button>
        }
      />
    </div>
  );
}

function Part({ part, ...props }: PartProps & { part: SessionPart }) {
  switch (part.kind) {
    case 'words':
      return <WordsPart id={part.id} words={part.words} {...props} />;
    case 'forms':
      return <FormsPart tables={part.tables} {...props} />;
    case 'accent':
      return (
        <AccentTrainer
          itemLimit={part.items}
          onComplete={({ done, clean }) => {
            props.onProgress({ reviewed: done, missed: done - clean });
            props.onDone();
          }}
        />
      );
  }
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function StartScreen({ onStart }: { onStart: (plan: SessionPlan) => void }) {
  const hydrated = useHydrated();
  const [budget, setBudget] = useStoredState<SessionBudget>(loadBudget, DEFAULT_BUDGET, saveBudget);
  const [streakData] = useStoredState(loadStudyStreak, NO_STREAK);
  const streak = currentStreak(streakData);
  // Planned only in the browser: the server has no store to plan from.
  const plan = useMemo(
    () =>
      hydrated
        ? buildSessionPlan({
            store: loadSRSStore(),
            budget,
            selection: loadSelection(),
            ladder: loadLadderProgress(),
          })
        : null,
    [hydrated, budget],
  );

  return (
    <section
      aria-labelledby="today-heading"
      className="bg-bg-card rounded-2xl shadow-sm border border-primary/10 p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="today-heading" className="text-xl font-bold text-primary">
          Today’s Session
        </h2>
        {streak > 0 && (
          <span className="text-sm text-text-muted">
            Study streak: <strong className="text-accent">{plural(streak, 'day')}</strong>
          </span>
        )}
      </div>
      <p className="text-sm text-text-muted">
        Due words and forms first, then new words, then a short drill.
      </p>

      <fieldset className="space-y-2">
        <legend className="text-xs font-bold text-text-muted uppercase tracking-wider">
          Time today
        </legend>
        <div className="flex flex-wrap gap-2">
          {SESSION_BUDGETS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={budget === b}
              onClick={() => setBudget(b)}
              className={`px-4 py-1.5 rounded-full text-sm border-2 font-medium transition-colors ${
                budget === b
                  ? 'bg-primary text-white border-primary'
                  : 'border-primary/10 text-text-muted hover:border-primary/40 hover:text-text'
              }`}
            >
              {b} min
            </button>
          ))}
        </div>
      </fieldset>

      {plan ? (
        <div aria-live="polite" className="text-sm">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-text">
            {planLines(plan).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-xs text-text-muted mt-1">
            {minutesText(plan.seconds)} of your {budget}
          </p>
        </div>
      ) : (
        <p className="text-sm text-text-muted">Planning today’s session…</p>
      )}

      <button
        type="button"
        disabled={!plan}
        onClick={() => plan && onStart(plan)}
        className="w-full py-3 rounded-xl font-bold text-base bg-coral text-white disabled:bg-gray-200 disabled:text-gray-400"
      >
        Start
      </button>
    </section>
  );
}

function SummaryScreen({
  tally,
  finished,
  streak,
  dueTomorrow,
  onAgain,
}: {
  tally: Tally;
  finished: boolean;
  streak: number;
  dueTomorrow: number;
  onAgain: () => void;
}) {
  return (
    <section
      aria-labelledby="summary-heading"
      className="bg-bg-card rounded-2xl shadow-sm border border-primary/10 p-5 sm:p-6 space-y-4"
    >
      <h2 id="summary-heading" className="text-xl font-bold text-primary">
        {finished ? 'Session complete' : 'Session ended'}
      </h2>
      <dl className="grid grid-cols-3 gap-3 text-center">
        {(
          [
            ['Reviewed', tally.reviewed],
            ['Missed', tally.missed],
            ['Due tomorrow', dueTomorrow],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-primary/5 py-3">
            <dt className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              {label}
            </dt>
            <dd className="text-2xl font-extrabold text-text mt-1">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-text-muted" role="status">
        {finished
          ? `Study streak: ${plural(streak, 'day')}.`
          : 'What you reviewed is saved. Finish a whole session to count the day toward your streak.'}
        {tally.missed > 0 && ' The words and forms you missed come back tomorrow.'}
      </p>
      <button type="button" onClick={onAgain} className={PRIMARY_BUTTON}>
        Back to Study
      </button>
    </section>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function TodaySessionInner() {
  const [stage, setStage] = useState<Stage>({ name: 'start' });
  const [tally, setTally] = useState<Tally>(NO_TALLY);
  // The running count, updated as each answer lands. A part reports its last
  // answer and finishes in the same tick, so `end` reads this rather than
  // state, which would not have caught up yet.
  const tallyRef = useRef(tally);
  const root = useRef<HTMLDivElement>(null);

  const onProgress = useCallback((delta: Tally) => {
    const t = tallyRef.current;
    tallyRef.current = { reviewed: t.reviewed + delta.reviewed, missed: t.missed + delta.missed };
    setTally(tallyRef.current);
  }, []);

  const end = useCallback(
    (finished: boolean) => {
      if (stage.name !== 'running') return;
      const streak = finished ? markStudiedToday().streak : 0;
      const dueTomorrow = sessionDueTomorrow(loadSRSStore());
      posthog.capture('hebrew_session_completed', {
        budget: stage.plan.budget,
        finished,
        reviewed: tallyRef.current.reviewed,
        missed: tallyRef.current.missed,
        minutes: Math.round((Date.now() - stage.startedAt) / 60000),
      });
      setStage({ name: 'done', finished, streak, dueTomorrow });
    },
    [stage],
  );

  const onDone = useCallback(() => {
    if (stage.name !== 'running') return;
    if (stage.part + 1 < stage.parts.length) setStage({ ...stage, part: stage.part + 1 });
    else end(true);
  }, [stage, end]);

  // Each new part starts at the top of the session, not wherever the last
  // part's buttons left the page.
  const partNumber = stage.name === 'running' ? stage.part : -1;
  useEffect(() => {
    if (partNumber > 0) root.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [partNumber]);

  const start = (plan: SessionPlan) => {
    tallyRef.current = NO_TALLY;
    setTally(NO_TALLY);
    setStage({ name: 'running', plan, parts: sessionParts(plan), part: 0, startedAt: Date.now() });
    posthog.capture('hebrew_session_started', {
      budget: plan.budget,
      planned_minutes: Math.ceil(plan.seconds / 60),
      review_words: plan.reviewWords.length,
      review_forms: formCount(plan.reviewForms),
      new_words: plan.newWords.length,
      drill: plan.drill?.kind ?? 'none',
    });
  };

  if (stage.name === 'start') return <StartScreen onStart={start} />;
  if (stage.name === 'done') {
    return (
      <SummaryScreen
        tally={tally}
        finished={stage.finished}
        streak={stage.streak}
        dueTomorrow={stage.dueTomorrow}
        onAgain={() => setStage({ name: 'start' })}
      />
    );
  }

  const current = stage.parts[stage.part];
  return (
    <div ref={root} className="space-y-5 scroll-mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol aria-label="Session parts" className="flex flex-wrap gap-2 text-xs font-semibold">
          {stage.parts.map((p, i) => (
            <li
              key={p.id}
              aria-current={i === stage.part ? 'step' : undefined}
              className={`px-3 py-1 rounded-full ${
                i === stage.part
                  ? 'bg-primary text-white'
                  : i < stage.part
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 text-text-muted'
              }`}
            >
              {p.title}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => end(false)}
          className="text-sm underline text-text-muted"
        >
          End session
        </button>
      </div>
      <Part key={stage.part} part={current} onProgress={onProgress} onDone={onDone} />
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
