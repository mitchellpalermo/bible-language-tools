/**
 * ParadigmAttempt — one paradigm table, filled in from memory and checked.
 *
 * The half of the paradigm quiz that is not choosing a table: the blanks, the
 * keypad, Peek, marking, and what a checked attempt writes. /paradigms hosts it
 * after its table picker, and Today's Session (#184) hosts it for the due forms
 * and the drill slot, so a form is scheduled and logged the same way wherever
 * it is written.
 *
 * Things here that are pedagogy or iPad behaviour rather than plumbing:
 *
 * - **Next goes down a column, not across a row.** Both layouts list PGNs down
 *   the side in textbook order, so a column is one verb's paradigm in the order
 *   it is recited. Tab still follows the DOM; Enter and the keypad's Next key
 *   follow the paradigm.
 * - **With the keypad open, the fields ask for no system keyboard**
 *   (`inputMode="none"`). Otherwise every tap on a cell raises the iPad
 *   keyboard over the keypad the student is trying to use. A hardware keyboard
 *   still types through the mapping either way.
 * - **Every checked form moves its own SRS card** (`paradigm-srs.ts`, which
 *   has the grade mapping and the repeat rules).
 * - **A pointing error is shown in both marking modes.** Lenient marking only
 *   decides the score (`countsAsCorrect`); the cell still says "dagesh" or
 *   "vowels", because a student who got the consonants right still needs to
 *   know which mark was off.
 * - **Only a clean Full-table write of a rung counts toward the next one**
 *   (`lib/suffix-ladder.ts`).
 */

import ToggleSwitch from '@tools/shared/components/ToggleSwitch';
import posthog from 'posthog-js';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SUFFIX_RULES } from '../data/pronominal-suffixes';
import { loadSRSStore, loadStats, type SRSCard, saveSRSStore, saveStats } from '../data/srs';
import { ladderRungs } from '../data/suffix-ladder';
import { logAttempts } from '../lib/attempt-log';
import {
  type CellResult,
  countsAsCorrect,
  gradeCell,
  type QuizCell,
  type TableModel,
} from '../lib/paradigm-quiz';
import { recordAttempt } from '../lib/paradigm-srs';
import {
  type LadderOutcome,
  ladderNote,
  ladderOutcome,
  loadLadderProgress,
  saveLadderProgress,
} from '../lib/suffix-ladder';
import { useHebrewInput } from '../lib/use-hebrew-input';
import HebrewKeypad from './HebrewKeypad';
import { affixText, Hebrew, Prose } from './HebrewRuns';

// ─── Types ────────────────────────────────────────────────────────────────────

type InputMap = Record<number, string>; // cell.index → raw value

/** What the keypad needs from whichever cell it is typing into. */
interface CellHandle {
  insert: (text: string) => void;
  backspace: () => void;
  focus: () => void;
}

// ─── Labels and styles ────────────────────────────────────────────────────────

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
        <Hebrew className="text-xl leading-tight">{affixText(answer)}</Hebrew>
      ) : (
        <span className="flex flex-col items-center leading-tight">
          <span className="line-through opacity-70 text-base">
            {input ? <Hebrew>{affixText(input)}</Hebrew> : '—'}
          </span>
          <Hebrew className="text-xl font-bold">{affixText(answer)}</Hebrew>
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
                      <Hebrew className="text-xl leading-tight">{affixText(answer)}</Hebrew>
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

// ─── The attempt ──────────────────────────────────────────────────────────────

/** What a checked attempt did, for the page that hosts it. */
export interface SubmittedAttempt {
  /** The SRS store after the attempt, already saved. */
  store: Record<string, SRSCard>;
  results: Record<number, CellResult>;
  /** Blanks that count as right under the marking in force. */
  right: number;
  total: number;
  peeked: boolean;
  /** What the attempt did on the ladder, for a rung's table. Saved when clean. */
  ladder?: LadderOutcome;
}

export interface ParadigmAttemptProps {
  table: TableModel;
  /** The table's cells with the blanks already chosen (`blankForReview`). */
  cells: QuizCell[];
  /** What chose the blanks, for the badge: "Full table", "Due forms". */
  modeName: string;
  strict: boolean;
  onStrictChange: (strict: boolean) => void;
  /** Top right: the way back out, if the host has one. */
  headerAction?: ReactNode;
  /** Under the results: what to do next. The host decides. */
  resultsActions: ReactNode;
  onSubmitted?: (attempt: SubmittedAttempt) => void;
  /** Where the attempt was taken, for analytics. */
  source: 'paradigms' | 'session';
}

/**
 * One table, filled in and checked. Every checked form moves its SRS card,
 * every unaided answer goes to the attempt log, and a rung's table reports to
 * the ladder — wherever the attempt is taken, so a form written in Today's
 * Session counts exactly as it would on /paradigms.
 *
 * The host remounts it (a new `key`) for a fresh attempt; nothing here resets
 * itself.
 */
export default function ParadigmAttempt({
  table,
  cells,
  modeName,
  strict,
  onStrictChange,
  headerAction,
  resultsActions,
  onSubmitted,
  source,
}: ParadigmAttemptProps) {
  const [inputs, setInputs] = useState<InputMap>({});
  const [peeking, setPeeking] = useState(false);
  const [checked, setChecked] = useState<SubmittedAttempt | null>(null);
  const [scheduled, setScheduled] = useState<SRSCard[]>([]);
  const peekedRef = useRef(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const handles = useRef(new Map<number, CellHandle>());

  // A touch screen starts with the keypad open. Read after mount: the page is
  // prerendered, and the server has no pointer to ask about.
  useEffect(() => {
    setKeypadOpen(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);

  const order = useMemo(() => recitationOrder(cells), [cells]);

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
    const first = order[0];
    if (first) focusCell(first.index);
  }, [order, focusCell]);

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

  const peek = (on: boolean) => {
    if (on) peekedRef.current = true;
    setPeeking(on);
  };

  const submit = () => {
    if (checked) return;
    const results: Record<number, CellResult> = {};
    for (const cell of cells) {
      if (cell.isBlank) results[cell.index] = gradeCell(inputs[cell.index] ?? '', cell.answer);
    }
    const peeked = peekedRef.current;
    // Read the store fresh rather than from state: a sync pull or another tab
    // may have written to it since this page loaded.
    const outcome = recordAttempt(
      loadSRSStore(),
      loadStats(),
      cells.filter((c) => c.isBlank).map((c) => ({ id: c.id, result: results[c.index] })),
      { strict, peeked },
    );
    saveSRSStore(outcome.store);
    saveStats(outcome.stats);

    // Every unaided answer goes to the attempt log for the mastery map (#187).
    // A peeked attempt is not unaided recall, so none of it is logged.
    if (!peeked) {
      logAttempts(
        cells
          .filter((c) => c.isBlank && c.id)
          .map((c) => ({
            concept: `paradigm/${c.id}`,
            correct: countsAsCorrect(results[c.index], strict),
          })),
      );
    }

    let ladder: LadderOutcome | undefined;
    if (table.rung) {
      ladder = ladderOutcome(loadLadderProgress(), table.rung, cells, results, peeked);
      if (ladder.clean) saveLadderProgress(ladder.progress);
    }

    const values = Object.values(results);
    const right = values.filter((r) => countsAsCorrect(r, strict)).length;
    posthog.capture('hebrew_paradigm_quiz_submitted', {
      table: table.id,
      correct: right,
      total: values.length,
      strict,
      peeked,
      source,
    });
    const attempt: SubmittedAttempt = {
      store: outcome.store,
      results,
      right,
      total: values.length,
      peeked,
      ladder,
    };
    setPeeking(false);
    setScheduled(outcome.scheduled);
    setChecked(attempt);
    onSubmitted?.(attempt);
  };

  const results = checked?.results ?? null;
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
              {modeName} — {blanks} blank{blanks === 1 ? '' : 's'}
            </span>
            <ToggleSwitch
              checked={strict}
              onChange={() => onStrictChange(!strict)}
              label="Strict pointing"
              accent={ACCENT}
            />
          </div>
        </div>
        {headerAction}
      </div>

      {checked && (
        <ScoreSummary
          results={checked.results}
          strict={strict}
          scheduled={scheduled}
          peeked={checked.peeked}
        />
      )}

      {checked?.ladder && (
        <p
          className={`text-sm font-semibold ${checked.ladder.clean ? 'text-jade' : 'text-text-muted'}`}
          aria-live="polite"
        >
          {ladderNote(checked.ladder)}
        </p>
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

      {table.rung && (
        <ul className="text-xs text-text-muted space-y-1 list-disc ps-4">
          {ladderRungs
            .find((r) => r.id === table.rung)
            ?.notes.map((note) => (
              <li key={note}>
                <Prose>{note}</Prose>
              </li>
            ))}
        </ul>
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

      {!checked ? (
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
        <div className="flex gap-3 flex-wrap">{resultsActions}</div>
      )}
    </div>
  );
}
