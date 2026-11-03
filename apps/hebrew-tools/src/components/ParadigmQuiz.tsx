/**
 * ParadigmQuiz — write a Hebrew verb paradigm out from memory.
 *
 * Three phases, as greek.tools' quiz: pick a table, fill in its blanks, see
 * what was right. The tables, the grading and the blanking all live in
 * `src/lib/paradigm-quiz.ts`; this file is the page.
 *
 * Filling in and checking a table is `ParadigmAttempt`, which Today's Session
 * hosts too; this file is the picker and the settings. Things to know:
 *
 * - **The default is the whole table blank** (`quiz-settings.ts`). The
 *   exercise is reproducing a table, as a Section Exam asks for.
 * - **The select screen reads the SRS store to say what is due**, and "Due
 *   forms" blanks exactly that.
 * - **The Suffix ladder tab is the same quiz on ordered tables** (#186). Every
 *   mode works on every rung; only a clean Full-table write counts toward the
 *   next one (`lib/suffix-ladder.ts`), and a locked rung can be opened anyway.
 */

import { LadderRungList } from '@tools/shared/components/Ladder';
import ToggleSwitch from '@tools/shared/components/ToggleSwitch';
import { type LadderProgress, rungStates } from '@tools/shared/ladder';
import { useStoredState } from '@tools/shared/use-stored-state';
import posthog from 'posthog-js';
import { useCallback, useMemo, useState } from 'react';
import { loadSRSStore, type SRSCard } from '../data/srs';
import { LADDER_RUNG_IDS } from '../data/suffix-ladder';
import {
  ALL_CATEGORIES,
  buildTableModels,
  type Category,
  categoryTabLabel,
  type Density,
  getQuizCells,
  type QuizCell,
  type TableModel,
} from '../lib/paradigm-quiz';
import {
  type BlankMode,
  blankForReview,
  type TableProgress,
  tableProgress,
} from '../lib/paradigm-srs';
import { defaultQuizSettings, loadQuizSettings, saveQuizSettings } from '../lib/quiz-settings';
import { loadLadderProgress } from '../lib/suffix-ladder';
import ErrorBoundary from './ErrorBoundary';
import { Prose } from './HebrewRuns';
import ParadigmAttempt from './ParadigmAttempt';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | { name: 'select' }
  /** `attempt` counts up, so Try again remounts a fresh `ParadigmAttempt`. */
  | { name: 'attempt'; table: TableModel; cells: QuizCell[]; mode: BlankMode; attempt: number };

// ─── Labels and styles ────────────────────────────────────────────────────────

const MODES: BlankMode[] = ['easy', 'medium', 'hard', 'due'];

const MODE_LABELS: Record<BlankMode, { name: string; desc: string }> = {
  easy: { name: 'Easy', desc: 'A quarter of the cells blank, due forms first' },
  medium: { name: 'Medium', desc: 'Half of the cells blank, due forms first' },
  hard: { name: 'Full table', desc: 'Every cell blank, as on an exam' },
  due: { name: 'Due forms', desc: 'Only the forms your review schedule asks for' },
};

const ACCENT = 'var(--color-primary, #15803D)';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "9 forms · 2 due · 3 new", or what is true when one of those is zero. */
export function progressText({ total, fresh, due }: TableProgress): string {
  if (fresh === total) return `${total} forms · not started`;
  const parts = [`${total} forms`];
  if (due > 0) parts.push(`${due} due`);
  if (fresh > 0) parts.push(`${fresh} new`);
  if (due === 0 && fresh === 0) parts.push('nothing due');
  return parts.join(' · ');
}

// ─── Select phase ─────────────────────────────────────────────────────────────

interface SelectorProps {
  tables: TableModel[];
  store: Record<string, SRSCard>;
  ladder: LadderProgress;
  mode: BlankMode;
  onModeChange: (mode: BlankMode) => void;
  strict: boolean;
  onStrictChange: (strict: boolean) => void;
  onStart: (table: TableModel) => void;
}

/** "Summary table" over its columns, or a verb's root, class and gloss. */
function TableCardText({ table }: { table: TableModel }) {
  if (table.layout === 'summary') {
    return (
      <>
        <span className="block font-semibold text-sm">
          {table.detail ?? 'All classes side by side'}
        </span>
        <span className="block text-xs text-text-muted mt-0.5">
          <Prose>{table.cols.join(' · ')}</Prose>
        </span>
      </>
    );
  }
  const title = table.label.split(' — ')[1] ?? table.label;
  return (
    <>
      <span className="block font-semibold text-sm">
        <Prose>{title}</Prose>
      </span>
      {table.detail && <span className="block text-xs text-text-muted mt-0.5">{table.detail}</span>}
    </>
  );
}

function ParadigmSelector({
  tables,
  store,
  ladder,
  mode,
  onModeChange,
  strict,
  onStrictChange,
  onStart,
}: SelectorProps) {
  const [category, setCategory] = useState<Category>('qatal');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const shown = tables.filter((t) => t.category === category);
  const selected = shown.find((t) => t.id === selectedId) ?? null;
  const progress = useMemo(
    () => new Map(tables.map((t) => [t.id, tableProgress(t, store)])),
    [tables, store],
  );
  const selectedProgress = selected ? progress.get(selected.id) : undefined;
  const nothingDue =
    mode === 'due' &&
    selectedProgress !== undefined &&
    selectedProgress.due + selectedProgress.fresh === 0;

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Table group" className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={category === id}
            onClick={() => {
              setCategory(id);
              setSelectedId(null);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              category === id
                ? 'bg-primary text-white'
                : 'bg-primary/10 text-text-muted hover:bg-primary/15'
            }`}
          >
            {categoryTabLabel(id)}
          </button>
        ))}
      </div>

      {category === 'ladder' ? (
        <LadderRungList
          rungs={shown.map((table) => ({
            id: table.id,
            title: <Prose>{table.label.split(' — ')[1] ?? table.label}</Prose>,
            detail: table.detail,
            meta: progressText(progress.get(table.id) as TableProgress),
          }))}
          states={rungStates(LADDER_RUNG_IDS, ladder)}
          selectedId={selectedId}
          onSelect={setSelectedId}
          accent={ACCENT}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shown.map((table) => {
            const isSelected = table.id === selectedId;
            return (
              <button
                key={table.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedId(isSelected ? null : table.id)}
                className={`text-left rounded-xl p-4 shadow-sm border-2 transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-primary/10 bg-bg-card hover:border-primary/25'
                }`}
              >
                <span className={`block ${isSelected ? 'text-text' : 'text-primary'}`}>
                  <TableCardText table={table} />
                </span>
                <span className="block text-xs text-text-muted mt-2">
                  {progressText(progress.get(table.id) as TableProgress)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-xl p-4 space-y-4 bg-bg-card border border-primary/10 shadow-sm">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Difficulty
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {MODES.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={mode === d}
                onClick={() => onModeChange(d)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition-colors border ${
                  mode === d
                    ? 'bg-primary text-white border-primary'
                    : 'bg-bg text-text border-primary/10 hover:border-primary/25'
                }`}
              >
                <span className="block font-semibold">{MODE_LABELS[d].name}</span>
                <span className="block text-xs opacity-75 mt-0.5">{MODE_LABELS[d].desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-primary/10" />

        <div className="space-y-1">
          <ToggleSwitch
            checked={strict}
            onChange={() => onStrictChange(!strict)}
            label="Strict pointing"
            accent={ACCENT}
          />
          <p className="text-xs text-text-muted">
            {strict
              ? 'A wrong vowel or a missing dagesh counts against you.'
              : 'Right consonants count as right. A pointing slip is still marked on the cell.'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => selected && onStart(selected)}
        disabled={!selected || nothingDue}
        className="w-full py-3 rounded-xl font-bold text-base transition-colors bg-coral text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        {!selected ? 'Choose a table to begin' : nothingDue ? 'Nothing due in this table' : 'Start'}
      </button>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const EMPTY_STORE: Record<string, SRSCard> = {};
const EMPTY_LADDER: LadderProgress = {};

function ParadigmQuizInner() {
  const tables = useMemo(() => buildTableModels(), []);
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  // Read after hydration, and saved by the setter rather than by an effect:
  // the page is prerendered, and an effect would write the defaults over the
  // student's settings on mount (ADR 006).
  const [settings, setSettings] = useStoredState(
    loadQuizSettings,
    defaultQuizSettings,
    saveQuizSettings,
  );
  const { accentStrict: strict, density } = settings;
  const setStrict = useCallback(
    (on: boolean) => setSettings((s) => ({ ...s, accentStrict: on })),
    [setSettings],
  );
  const setDensity = useCallback(
    (d: Density) => setSettings((s) => ({ ...s, density: d })),
    [setSettings],
  );
  // "Due forms" is a choice for this visit, not a saved difficulty: the shared
  // settings shape holds a density, and greek.tools has no schedule to read.
  const [dueOnly, setDueOnly] = useState(false);
  const mode: BlankMode = dueOnly ? 'due' : density;
  // What is due drives each table's progress line, so it waits for hydration
  // too. The attempt saves the store itself and hands back the new one.
  const [store, setStore] = useStoredState<Record<string, SRSCard>>(loadSRSStore, EMPTY_STORE);
  // Which rungs are open. Saved by the attempt, on a clean write.
  const [ladder, setLadder] = useStoredState<LadderProgress>(loadLadderProgress, EMPTY_LADDER);

  const start = useCallback((table: TableModel, m: BlankMode) => {
    const cells = blankForReview(getQuizCells(table), m, loadSRSStore());
    setPhase((prev) => ({
      name: 'attempt',
      table,
      cells,
      mode: m,
      attempt: prev.name === 'attempt' ? prev.attempt + 1 : 0,
    }));
    posthog.capture('hebrew_paradigm_quiz_started', { table: table.id, mode: m });
  }, []);

  const backToSelect = () => setPhase({ name: 'select' });

  if (phase.name === 'select') {
    return (
      <ParadigmSelector
        tables={tables}
        store={store}
        ladder={ladder}
        mode={mode}
        onModeChange={(m) => {
          setDueOnly(m === 'due');
          if (m !== 'due') setDensity(m);
        }}
        strict={strict}
        onStrictChange={setStrict}
        onStart={(table) => start(table, mode)}
      />
    );
  }

  const { table, cells } = phase;
  return (
    <ParadigmAttempt
      key={phase.attempt}
      table={table}
      cells={cells}
      modeName={MODE_LABELS[phase.mode].name}
      strict={strict}
      onStrictChange={setStrict}
      source="paradigms"
      onSubmitted={(attempt) => {
        setStore(attempt.store);
        if (attempt.ladder?.clean) setLadder(attempt.ladder.progress);
      }}
      headerAction={
        <button type="button" onClick={backToSelect} className="text-sm underline text-text-muted">
          ← Choose another table
        </button>
      }
      resultsActions={
        <>
          <button
            type="button"
            onClick={() => start(table, phase.mode)}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-white"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={backToSelect}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-bg-card text-primary border border-primary/15"
          >
            Another table
          </button>
        </>
      }
    />
  );
}

export default function ParadigmQuiz() {
  return (
    <ErrorBoundary component="ParadigmQuiz">
      <ParadigmQuizInner />
    </ErrorBoundary>
  );
}
