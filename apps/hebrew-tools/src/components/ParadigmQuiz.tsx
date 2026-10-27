/**
 * ParadigmQuiz — write a Hebrew verb paradigm out from memory.
 *
 * Three phases, as greek.tools' quiz: pick a table, fill in its blanks, see
 * what was right. The tables, the grading and the blanking all live in
 * `src/lib/paradigm-quiz.ts`; this file is the page.
 *
 * Four things here are pedagogy or iPad behaviour rather than plumbing:
 *
 * - **The default is the whole table blank** (`quiz-settings.ts`). The
 *   exercise is reproducing a table, as a Section Exam asks for.
 * - **Next goes down a column, not across a row.** Both layouts list PGNs down
 *   the side in textbook order, so a column is one verb's paradigm in the order
 *   it is recited. Tab still follows the DOM; Enter and the keypad's Next key
 *   follow the paradigm.
 * - **With the keypad open, the fields ask for no system keyboard**
 *   (`inputMode="none"`). Otherwise every tap on a cell raises the iPad
 *   keyboard over the keypad the student is trying to use. A hardware keyboard
 *   still types through the mapping either way.
 * - **Every checked form moves its own SRS card** (`paradigm-srs.ts`, which
 *   has the grade mapping and the repeat rules). The select screen reads the
 *   same store to say what is due, and "Due forms" blanks exactly that.
 * - **A pointing error is shown in both marking modes.** Lenient marking only
 *   decides the score (`countsAsCorrect`); the cell still says "dagesh" or
 *   "vowels", because a student who got the consonants right still needs to
 *   know which mark was off.
 */

import ToggleSwitch from '@tools/shared/components/ToggleSwitch';
import { useStoredState } from '@tools/shared/use-stored-state';
import posthog from 'posthog-js';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SUFFIX_RULES } from '../data/pronominal-suffixes';
import { loadSRSStore, loadStats, type SRSCard, saveSRSStore, saveStats } from '../data/srs';
import {
  ALL_CATEGORIES,
  buildTableModels,
  type Category,
  type CellResult,
  categoryTabLabel,
  countsAsCorrect,
  type Density,
  getQuizCells,
  gradeCell,
  type QuizCell,
  type TableModel,
} from '../lib/paradigm-quiz';
import {
  type BlankMode,
  blankForReview,
  recordAttempt,
  type TableProgress,
  tableProgress,
} from '../lib/paradigm-srs';
import { defaultQuizSettings, loadQuizSettings, saveQuizSettings } from '../lib/quiz-settings';
import { useHebrewInput } from '../lib/use-hebrew-input';
import ErrorBoundary from './ErrorBoundary';
import HebrewKeypad from './HebrewKeypad';
import { Hebrew, Prose } from './HebrewRuns';

// ─── Types ────────────────────────────────────────────────────────────────────

type InputMap = Record<number, string>; // cell.index → raw value

type Phase =
  | { name: 'select' }
  | { name: 'quiz'; table: TableModel; cells: QuizCell[]; mode: BlankMode }
  | {
      name: 'results';
      table: TableModel;
      cells: QuizCell[];
      mode: BlankMode;
      results: Record<number, CellResult>;
      /** Cards the attempt moved — see `recordAttempt`. */
      scheduled: SRSCard[];
      peeked: boolean;
    };

/** What the keypad needs from whichever cell it is typing into. */
interface CellHandle {
  insert: (text: string) => void;
  backspace: () => void;
  focus: () => void;
}

// ─── Labels and styles ────────────────────────────────────────────────────────

const MODES: BlankMode[] = ['easy', 'medium', 'hard', 'due'];

const MODE_LABELS: Record<BlankMode, { name: string; desc: string }> = {
  easy: { name: 'Easy', desc: 'A quarter of the cells blank, due forms first' },
  medium: { name: 'Medium', desc: 'Half of the cells blank, due forms first' },
  hard: { name: 'Full table', desc: 'Every cell blank, as on an exam' },
  due: { name: 'Due forms', desc: 'Only the forms your review schedule asks for' },
};

const RESULT_STYLES: Record<CellResult, { bg: string; border: string; text: string }> = {
  correct: { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46' },
  'dagesh-only': { bg: '#FEF3C7', border: '#FCD34D', text: '#78350F' },
  'nikud-only': { bg: '#FEF3C7', border: '#FCD34D', text: '#78350F' },
  wrong: { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B' },
};

/** What a pointing error names, under the cell. */
const POINTING_NOTES: Partial<Record<CellResult, string>> = {
  'dagesh-only': 'dagesh',
  'nikud-only': 'vowels',
};

const ACCENT = 'var(--color-primary, #15803D)';

const HEBREW_FIELD =
  'w-full min-w-[5.5rem] text-center text-xl leading-tight rounded-md border-2 px-1.5 py-1';

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

/**
 * Blank cells in the order a student recites them: down each column in turn.
 * See the note on Next at the top of the file.
 */
export function recitationOrder(cells: QuizCell[]): QuizCell[] {
  return cells
    .filter((c) => c.isBlank)
    .sort((a, b) => a.colIndex - b.colIndex || a.rowIndex - b.rowIndex);
}

function cellLabel(table: TableModel, cell: QuizCell): string {
  return `${table.rows[cell.rowIndex].label} ${table.cols[cell.colIndex]}`;
}

// ─── Cell input ───────────────────────────────────────────────────────────────

interface CellInputProps {
  index: number;
  label: string;
  value: string;
  noSystemKeyboard: boolean;
  /** The answer, shown in place of the input while the student holds Peek. */
  peek?: string;
  onChange: (index: number, raw: string) => void;
  onFocus: (index: number) => void;
  onNext: (index: number) => void;
  register: (index: number, handle: CellHandle | null) => void;
}

function CellInput({
  index,
  label,
  value,
  noSystemKeyboard,
  peek,
  onChange,
  onFocus,
  onNext,
  register,
}: CellInputProps) {
  const input = useHebrewInput({ value, onChange: (raw) => onChange(index, raw) });
  const { insert, backspace, ref } = input;

  useEffect(() => {
    register(index, {
      insert,
      backspace,
      focus: () => {
        ref.current?.focus();
        ref.current?.scrollIntoView?.({ block: 'nearest' });
      },
    });
    return () => register(index, null);
  }, [index, register, insert, backspace, ref]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onNext(index);
      return;
    }
    input.onKeyDown(e);
  };

  // Peeking swaps the value rather than the element, so the field keeps focus
  // and the caret is where it was when the student lets go.
  return (
    <input
      ref={ref}
      type="text"
      dir="rtl"
      lang="he"
      value={peek ?? input.display}
      readOnly={peek !== undefined}
      onKeyDown={handleKeyDown}
      onChange={input.onChange}
      onFocus={() => onFocus(index)}
      inputMode={noSystemKeyboard ? 'none' : 'text'}
      enterKeyHint="next"
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      aria-label={`Answer for ${label}`}
      // The bottom margin keeps a field clear of the keypad pinned below it.
      className={`${HEBREW_FIELD} scroll-mb-64 focus:outline-none focus:border-primary ${
        peek === undefined ? 'bg-bg border-accent/60' : 'bg-accent/15 border-accent/40'
      }`}
      style={{ color: 'var(--color-hebrew)', fontFamily: 'var(--font-hebrew)' }}
    />
  );
}

// ─── Select phase ─────────────────────────────────────────────────────────────

interface SelectorProps {
  tables: TableModel[];
  store: Record<string, SRSCard>;
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

// ─── Quiz table ───────────────────────────────────────────────────────────────

interface QuizTableProps {
  table: TableModel;
  cells: QuizCell[];
  inputs: InputMap;
  results: Record<number, CellResult> | null;
  strict: boolean;
  peeking: boolean;
  noSystemKeyboard: boolean;
  onInputChange: (index: number, raw: string) => void;
  onFocusCell: (index: number) => void;
  onNext: (index: number) => void;
  register: (index: number, handle: CellHandle | null) => void;
}

function ResultCell({
  answer,
  input,
  result,
  strict,
}: {
  answer: string;
  input: string;
  result: CellResult;
  strict: boolean;
}) {
  const style = RESULT_STYLES[result];
  const note = POINTING_NOTES[result];
  return (
    <div
      className="rounded-md px-1.5 py-1 text-center [&_[lang=he]]:text-inherit"
      style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.text }}
    >
      {result === 'correct' ? (
        <Hebrew className="text-xl leading-tight">{answer}</Hebrew>
      ) : (
        <span className="flex flex-col items-center leading-tight">
          <span className="line-through opacity-70 text-base">
            {input ? <Hebrew>{input}</Hebrew> : '—'}
          </span>
          <Hebrew className="text-xl font-bold">{answer}</Hebrew>
        </span>
      )}
      {note && (
        <span className="block text-[0.6875rem] font-semibold mt-0.5">
          {note}
          {!strict && ' · not counted'}
        </span>
      )}
    </div>
  );
}

function QuizTable({
  table,
  cells,
  inputs,
  results,
  strict,
  peeking,
  noSystemKeyboard,
  onInputChange,
  onFocusCell,
  onNext,
  register,
}: QuizTableProps) {
  const byIndex = useMemo(() => new Map(cells.map((c) => [c.index, c])), [cells]);

  return (
    <div className="overflow-x-auto rounded-xl shadow-sm border border-primary/10 bg-bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-primary/5">
            <th scope="col" className="px-2 sm:px-3 py-2 w-12">
              <span className="sr-only">Person, gender, number</span>
            </th>
            {table.cols.map((col) => (
              <th
                key={col}
                scope="col"
                className="px-2 sm:px-3 py-2 text-center text-xs font-semibold text-text-muted"
              >
                <Prose>{col}</Prose>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={row.label} className="border-t border-primary/5">
              <th
                scope="row"
                className="px-2 sm:px-3 py-2 text-left text-xs font-semibold text-text-muted"
              >
                {row.label}
              </th>
              {row.answers.map((answer, colIndex) => {
                const index = rowIndex * table.cols.length + colIndex;
                const cell = byIndex.get(index);
                const key = table.cols[colIndex];
                if (answer === null || !cell) {
                  return (
                    <td key={key} className="px-2 py-1.5 text-center text-text-muted">
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">no form</span>
                    </td>
                  );
                }
                if (!cell.isBlank) {
                  return (
                    <td key={key} className="px-2 py-1.5 text-center">
                      <Hebrew className="text-xl leading-tight">{answer}</Hebrew>
                    </td>
                  );
                }
                const result = results?.[index];
                return (
                  <td key={key} className="px-1.5 sm:px-2 py-1.5">
                    {result ? (
                      <ResultCell
                        answer={answer}
                        input={(inputs[index] ?? '').trim()}
                        result={result}
                        strict={strict}
                      />
                    ) : (
                      <CellInput
                        index={index}
                        label={cellLabel(table, cell)}
                        value={inputs[index] ?? ''}
                        noSystemKeyboard={noSystemKeyboard}
                        peek={peeking ? answer : undefined}
                        onChange={onInputChange}
                        onFocus={onFocusCell}
                        onNext={onNext}
                        register={register}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Peek ─────────────────────────────────────────────────────────────────────

function PeekButton({ onShow, onHide }: { onShow: () => void; onHide: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onShow();
      }}
      onPointerUp={onHide}
      onPointerLeave={onHide}
      onPointerCancel={onHide}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onShow();
        }
      }}
      onKeyUp={onHide}
      onBlur={onHide}
      className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted border border-dashed border-accent select-none"
      style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
    >
      Hold to peek
    </button>
  );
}

// ─── Score ────────────────────────────────────────────────────────────────────

/** What the attempt did to the review schedule, in a sentence. */
export function scheduleNote(scheduled: SRSCard[], peeked: boolean): string {
  if (peeked) {
    return 'You peeked, so the forms you got right keep their place in your review schedule. Misses come back tomorrow.';
  }
  if (scheduled.length === 0) {
    return 'You already reviewed these forms today, so this attempt leaves your review schedule as it was.';
  }
  const soon = scheduled.filter((c) => c.interval <= 1).length;
  const later = scheduled.length - soon;
  const forms = (n: number) => `${n} ${n === 1 ? 'form' : 'forms'}`;
  const parts = [
    soon > 0 && `${forms(soon)} ${soon === 1 ? 'comes' : 'come'} back tomorrow`,
    later > 0 && `${forms(later)} later`,
  ];
  return `Saved to your review schedule: ${parts.filter(Boolean).join(', ')}.`;
}

function ScoreSummary({
  results,
  strict,
  scheduled,
  peeked,
}: {
  results: Record<number, CellResult>;
  strict: boolean;
  scheduled: SRSCard[];
  peeked: boolean;
}) {
  const values = Object.values(results);
  const total = values.length;
  const right = values.filter((r) => countsAsCorrect(r, strict)).length;
  const pointing = values.filter((r) => r === 'dagesh-only' || r === 'nikud-only').length;
  const pct = total === 0 ? 0 : Math.round((right / total) * 100);
  const color = pct >= 90 ? '#059669' : pct >= 70 ? '#D97706' : '#DC2626';

  return (
    <div
      className="rounded-xl p-4 bg-bg-card border border-primary/10 shadow-sm"
      aria-live="polite"
    >
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-4xl font-extrabold" style={{ color }}>
          {right}/{total}
        </span>
        <span className="text-xl font-semibold" style={{ color }}>
          {pct}%
        </span>
        {pointing > 0 && (
          <span className="text-sm px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-900">
            {pointing} pointing {pointing === 1 ? 'slip' : 'slips'}
            {strict ? '' : ' (not counted)'}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {right === total && pointing === 0
          ? 'Every form exactly right.'
          : 'Each miss shows what you wrote, struck through, above the form in the table.'}
      </p>
      <p className="mt-1 text-xs text-text-muted">{scheduleNote(scheduled, peeked)}</p>
    </div>
  );
}

function Legend() {
  const items: [CellResult, string][] = [
    ['correct', 'Correct'],
    ['nikud-only', 'Right consonants, pointing off'],
    ['wrong', 'Wrong consonants'],
  ];
  return (
    <div className="flex gap-4 flex-wrap text-xs text-text-muted">
      {items.map(([result, label]) => (
        <span key={result} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded"
            style={{
              background: RESULT_STYLES[result].bg,
              border: `1px solid ${RESULT_STYLES[result].border}`,
            }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const EMPTY_STORE: Record<string, SRSCard> = {};

function ParadigmQuizInner() {
  const tables = useMemo(() => buildTableModels(), []);
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [inputs, setInputs] = useState<InputMap>({});
  const [peeking, setPeeking] = useState(false);
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
  // too. Saved explicitly on submit, which reads the store fresh.
  const [store, setStore] = useStoredState<Record<string, SRSCard>>(loadSRSStore, EMPTY_STORE);
  const peekedRef = useRef(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const handles = useRef(new Map<number, CellHandle>());

  // A touch screen starts with the keypad open. Read after mount: the page is
  // prerendered, and the server has no pointer to ask about.
  useEffect(() => {
    setKeypadOpen(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);

  const order = useMemo(
    () => (phase.name === 'select' ? [] : recitationOrder(phase.cells)),
    [phase],
  );

  const register = useCallback((index: number, handle: CellHandle | null) => {
    if (handle) handles.current.set(index, handle);
    else handles.current.delete(index);
  }, []);

  const handleInputChange = useCallback((index: number, raw: string) => {
    setInputs((prev) => ({ ...prev, [index]: raw }));
  }, []);

  const focusCell = useCallback((index: number) => {
    setActiveIndex(index);
    handles.current.get(index)?.focus();
  }, []);

  // Start on the first blank. Cells register in their own effects, which run
  // before this one, so the handle is there to focus.
  useEffect(() => {
    if (phase.name !== 'quiz') return;
    const first = order[0];
    if (first) focusCell(first.index);
  }, [phase, order, focusCell]);

  const handleNext = useCallback(
    (index: number) => {
      const at = order.findIndex((c) => c.index === index);
      const next = order[at + 1];
      if (next) focusCell(next.index);
    },
    [order, focusCell],
  );

  /** The cell the keypad types into: the focused one, or else the first blank. */
  const target = (): CellHandle | undefined => {
    const index = activeIndex ?? order[0]?.index;
    if (index === undefined) return undefined;
    if (activeIndex === null) setActiveIndex(index);
    return handles.current.get(index);
  };

  const start = useCallback((table: TableModel, m: BlankMode) => {
    setInputs({});
    setPeeking(false);
    peekedRef.current = false;
    setActiveIndex(null);
    const cells = blankForReview(getQuizCells(table), m, loadSRSStore());
    setPhase({ name: 'quiz', table, cells, mode: m });
    posthog.capture('hebrew_paradigm_quiz_started', { table: table.id, mode: m });
  }, []);

  const peek = (on: boolean) => {
    if (on) peekedRef.current = true;
    setPeeking(on);
  };

  const submit = () => {
    if (phase.name !== 'quiz') return;
    const results: Record<number, CellResult> = {};
    for (const cell of phase.cells) {
      if (cell.isBlank) results[cell.index] = gradeCell(inputs[cell.index] ?? '', cell.answer);
    }
    const peeked = peekedRef.current;
    // Read the store fresh rather than from state: a sync pull or another tab
    // may have written to it since this page loaded.
    const outcome = recordAttempt(
      loadSRSStore(),
      loadStats(),
      phase.cells.filter((c) => c.isBlank).map((c) => ({ id: c.id, result: results[c.index] })),
      { strict, peeked },
    );
    saveSRSStore(outcome.store);
    saveStats(outcome.stats);
    setStore(outcome.store);

    const values = Object.values(results);
    posthog.capture('hebrew_paradigm_quiz_submitted', {
      table: phase.table.id,
      correct: values.filter((r) => countsAsCorrect(r, strict)).length,
      total: values.length,
      strict,
      peeked,
    });
    setPeeking(false);
    setPhase({ ...phase, name: 'results', results, scheduled: outcome.scheduled, peeked });
  };

  const backToSelect = () => {
    setPhase({ name: 'select' });
    setInputs({});
  };

  if (phase.name === 'select') {
    return (
      <ParadigmSelector
        tables={tables}
        store={store}
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
  const results = phase.name === 'results' ? phase.results : null;
  const blanks = order.length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-primary">
            <Prose>{table.label}</Prose>
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {MODE_LABELS[phase.mode].name} — {blanks} blank{blanks === 1 ? '' : 's'}
            </span>
            <ToggleSwitch
              checked={strict}
              onChange={() => setStrict(!strict)}
              label="Strict pointing"
              accent={ACCENT}
            />
          </div>
        </div>
        <button type="button" onClick={backToSelect} className="text-sm underline text-text-muted">
          ← Choose another table
        </button>
      </div>

      {phase.name === 'results' && (
        <ScoreSummary
          results={phase.results}
          strict={strict}
          scheduled={phase.scheduled}
          peeked={phase.peeked}
        />
      )}

      <QuizTable
        table={table}
        cells={cells}
        inputs={inputs}
        results={results}
        strict={strict}
        peeking={peeking}
        noSystemKeyboard={keypadOpen}
        onInputChange={handleInputChange}
        onFocusCell={setActiveIndex}
        onNext={handleNext}
        register={register}
      />

      {table.layout === 'verb' && table.category === 'qatal' && (
        <p className="text-xs text-text-muted">
          The qatal has one third-person plural, the 3cp, written on the 3m row.
        </p>
      )}

      {table.category === 'suffixes' && (
        <ul className="text-xs text-text-muted space-y-1 list-disc ps-4">
          {SUFFIX_RULES.map((rule) => (
            <li key={rule.id}>
              <Prose>{rule.text}</Prose>
            </li>
          ))}
        </ul>
      )}

      {results && <Legend />}

      {phase.name === 'quiz' ? (
        <>
          <div className="flex gap-3 flex-wrap items-center">
            <button
              type="button"
              onClick={submit}
              className="flex-1 min-w-40 px-6 py-2.5 rounded-xl font-bold text-sm bg-coral text-white"
            >
              Check answers
            </button>
            <PeekButton onShow={() => peek(true)} onHide={() => peek(false)} />
            <ToggleSwitch
              checked={keypadOpen}
              onChange={() => setKeypadOpen(!keypadOpen)}
              label="Keypad"
              accent={ACCENT}
            />
          </div>
          {keypadOpen ? (
            <div className="sticky bottom-0 -mx-4 sm:mx-0 px-2 sm:px-3 py-2 bg-bg/95 backdrop-blur border-t sm:border sm:rounded-xl border-primary/10 shadow-lg">
              <HebrewKeypad
                onInsert={(text) => target()?.insert(text)}
                onBackspace={() => target()?.backspace()}
                onNext={() => {
                  const index = activeIndex ?? order[0]?.index;
                  if (index !== undefined) handleNext(index);
                }}
              />
            </div>
          ) : (
            <p className="text-xs text-text-muted">
              Type with the{' '}
              <a href="/keyboard" className="underline">
                phonetic mapping
              </a>{' '}
              — <kbd className="px-1 rounded bg-gray-100 font-mono">q</kbd> → ק,{' '}
              <kbd className="px-1 rounded bg-gray-100 font-mono">A</kbd> → qamets,{' '}
              <kbd className="px-1 rounded bg-gray-100 font-mono">:</kbd> → sheva,{' '}
              <kbd className="px-1 rounded bg-gray-100 font-mono">.</kbd> → dagesh. Enter moves down
              the column.
            </p>
          )}
        </>
      ) : (
        <div className="flex gap-3 flex-wrap">
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
        </div>
      )}
    </div>
  );
}

export default function ParadigmQuiz() {
  return (
    <ErrorBoundary component="ParadigmQuiz">
      <ParadigmQuizInner />
    </ErrorBoundary>
  );
}
