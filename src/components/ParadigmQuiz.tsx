/**
 * ParadigmQuiz — three-phase interactive quiz for Greek paradigm tables.
 *
 * Phases:
 *   1. Select  — pick a paradigm, difficulty, and grading options
 *   2. Quiz    — fill in the blanked cells using Beta Code keyboard input
 *   3. Results — see score, per-cell color coding, and retry options
 *
 * Grading options:
 *   - accentStrict: when false (default) accent errors are treated as correct;
 *     when true, accent errors are marked wrong (yellow).
 */

import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { verbParadigms } from '../data/grammar';
import {
  applyFinalSigma,
  checkAnswer,
  processGreekInput,
  processGreekKey,
  translateGreekInput,
} from '../lib/greek-input';
import {
  ALL_CATEGORIES,
  applyDensity,
  buildTableModels,
  CATEGORY_LABELS,
  type Category,
  type CellResult,
  type Density,
  getQuizCells,
  type QuizCell,
  type TableModel,
} from '../lib/paradigm-quiz';
import { loadQuizSettings, saveQuizSettings } from '../lib/quiz-settings';
import ErrorBoundary from './ErrorBoundary';
import type { Mood } from './grammar/VerbParadigmGrid';
import VerbParadigmGrid from './grammar/VerbParadigmGrid';

// ---------------------------------------------------------------------------
// BetaCodeReference — data tables
// ---------------------------------------------------------------------------

/** Lowercase letter rows for the keyboard reference chart (Greek-alphabet order). */
const LETTER_ROWS: [string, string][][] = [
  [
    ['a', 'α'],
    ['b', 'β'],
    ['g', 'γ'],
    ['d', 'δ'],
    ['e', 'ε'],
    ['z', 'ζ'],
  ],
  [
    ['h', 'η'],
    ['q', 'θ'],
    ['i', 'ι'],
    ['k', 'κ'],
    ['l', 'λ'],
    ['m', 'μ'],
  ],
  [
    ['n', 'ν'],
    ['c', 'ξ'],
    ['o', 'ο'],
    ['p', 'π'],
    ['r', 'ρ'],
    ['s', 'σ'],
  ],
  [
    ['t', 'τ'],
    ['u', 'υ'],
    ['f', 'φ'],
    ['x', 'χ'],
    ['y', 'ψ'],
    ['w', 'ω'],
  ],
];

/** Diacritic / punctuation entries with a concrete Greek example. */
const DIACRITIC_ENTRIES: { key: string; name: string; example: string }[] = [
  { key: ')', name: 'smooth breathing', example: 'ἀ' },
  { key: '(', name: 'rough breathing', example: 'ἁ' },
  { key: '/', name: 'acute accent', example: 'ά' },
  { key: '\\', name: 'grave accent', example: 'ὰ' },
  { key: '=', name: 'circumflex', example: 'ᾶ' },
  { key: '|', name: 'iota subscript', example: 'ᾳ' },
  { key: ':', name: 'ano teleia', example: '·' },
  { key: '?', name: 'question mark', example: ';' },
];

// ---------------------------------------------------------------------------
// Phase types
// ---------------------------------------------------------------------------

type Phase =
  | { name: 'select' }
  | { name: 'quiz'; table: TableModel; cells: QuizCell[]; density: Density }
  | { name: 'results'; table: TableModel; cells: QuizCell[]; inputs: InputMap; density: Density };

type InputMap = Record<number, string>; // cell.index → raw text

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DENSITY_LABELS: Record<Density, string> = {
  easy: 'Easy (25%)',
  medium: 'Medium (50%)',
  hard: 'Full Recall',
};

const DENSITY_DESCS: Record<Density, string> = {
  easy: 'A quarter of the cells are blank.',
  medium: 'Half of the cells are blank.',
  hard: 'Every cell is blank — full recall from memory.',
};

/** Raw result styles — used when accentStrict is on, or for non-accent results. */
const RESULT_STYLES: Record<CellResult, { bg: string; border: string; text: string }> = {
  correct: { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
  'accent-only': { bg: '#fef3c7', border: '#fcd34d', text: '#78350f' },
  wrong: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
};

/**
 * Resolve the display result for a cell, taking the accent-strict setting into account.
 * When accentStrict is off, accent-only errors count as correct.
 */
function resolveDisplayResult(raw: CellResult, accentStrict: boolean): CellResult {
  return !accentStrict && raw === 'accent-only' ? 'correct' : raw;
}

// ---------------------------------------------------------------------------
// BetaCodeReference — expandable keyboard mapping shown during quiz
// ---------------------------------------------------------------------------

function BetaCodeReference() {
  return (
    <details
      open
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid #e5e7eb', background: 'var(--color-bg-card)' }}
    >
      <summary
        className="px-4 py-3 cursor-pointer text-xs font-semibold uppercase tracking-wider select-none"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Beta Code Reference
      </summary>
      <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Letters */}
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Letters
          </div>
          <div
            className="grid gap-y-1.5"
            style={{ gridTemplateColumns: 'repeat(6, minmax(2.5rem, auto))', columnGap: '0.5rem' }}
          >
            {LETTER_ROWS.flat().map(([key, greek]) => (
              <div key={key} className="flex items-center gap-1 text-xs">
                <kbd
                  className="px-1 rounded font-mono text-xs"
                  style={{
                    background: '#f3f4f6',
                    color: 'var(--color-text)',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {key}
                </kbd>
                <span style={{ color: 'var(--color-greek)', fontFamily: 'var(--font-greek)' }}>
                  {greek}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Diacritics & Punctuation */}
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Diacritics &amp; Punctuation
          </div>
          <div className="space-y-1.5">
            {DIACRITIC_ENTRIES.map(({ key, name, example }) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <kbd
                  className="px-1.5 rounded font-mono text-xs min-w-[1.75rem] text-center"
                  style={{
                    background: '#f3f4f6',
                    color: 'var(--color-text)',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {key}
                </kbd>
                <span style={{ color: 'var(--color-text-muted)' }}>{name}</span>
                <span
                  className="ml-auto font-greek"
                  style={{ color: 'var(--color-greek)', fontFamily: 'var(--font-greek)' }}
                >
                  {example}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// CellInput — single Greek-keyboard-enabled input for a blank cell
// ---------------------------------------------------------------------------

interface CellInputProps {
  cellIndex: number;
  value: string;
  onChange: (cellIndex: number, raw: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

function CellInput({ cellIndex, value, onChange, autoFocus, disabled }: CellInputProps) {
  const displayValue = applyFinalSigma(value);

  const inputRef = useRef<HTMLInputElement>(null);
  // Flag set by onKeyDown when it handles a key. Prevents the beforeinput
  // listener from double-inserting on platforms (e.g. iOS Safari) that fire
  // both events for the same keystroke even after keydown.preventDefault().
  const keyHandledRef = useRef(false);
  // Tracks the display value we expect after our last insert. onChange skips
  // when it matches — prevents Android IME echo-backs from doubling the word.
  const lastHandledRef = useRef('');

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      keyHandledRef.current = false;
      // append is non-null whenever a Greek key is pressed (processGreekKey contract).
      const { append } = processGreekKey(e.key, e.ctrlKey || e.metaKey);
      if (append !== null) {
        e.preventDefault();
        const next = value + append;
        lastHandledRef.current = applyFinalSigma(next);
        onChange(cellIndex, next);
        keyHandledRef.current = true;
      }
    },
    [cellIndex, value, onChange],
  );

  // Android soft keyboards fire keydown with key="Unidentified", so onKeyDown
  // is a no-op. The native beforeinput event carries the actual character in
  // InputEvent.data on all platforms. We use a native listener (not React's
  // onBeforeInput prop, which is a synthetic composite event from keypress/
  // textInput, not the native beforeinput) so it fires correctly on Android.
  // The keyHandledRef guard ensures onKeyDown and this handler are mutually
  // exclusive — safe even if a browser fires both after keydown.preventDefault().
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      if (keyHandledRef.current) {
        keyHandledRef.current = false;
        return;
      }
      const ie = e as unknown as InputEvent;
      if (ie.inputType !== 'insertText' || !ie.data) return;
      // Multi-char data means the Android IME is committing a buffered word.
      if (ie.data.length > 1) {
        e.preventDefault();
        const next = value + translateGreekInput(ie.data!);
        lastHandledRef.current = applyFinalSigma(next);
        onChange(cellIndex, next);
        return;
      }
      const { preventDefault, append } = processGreekInput(ie.data);
      if (preventDefault) {
        e.preventDefault();
        const next = value + append!;
        lastHandledRef.current = applyFinalSigma(next);
        onChange(cellIndex, next);
      }
    };
    el.addEventListener('beforeinput', handler);
    return () => el.removeEventListener('beforeinput', handler);
  }, [cellIndex, value, onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onKeyDown={handleKeyDown}
      onChange={(e) => {
        if (e.target.value === lastHandledRef.current) return;
        onChange(cellIndex, translateGreekInput(e.target.value));
      }}
      disabled={disabled}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      className="w-full text-center text-base rounded border-2 px-1 py-0.5 focus:outline-none transition-colors"
      style={{
        color: 'var(--color-greek)',
        fontFamily: 'var(--font-greek)',
        borderColor: 'var(--color-accent)',
        background: 'var(--color-bg)',
        minWidth: '5rem',
      }}
      aria-label={`Answer for cell ${cellIndex}`}
    />
  );
}

// ---------------------------------------------------------------------------
// AccentToggle — shared pill toggle used in both select and quiz phases
// ---------------------------------------------------------------------------

interface AccentToggleProps {
  accentStrict: boolean;
  onChange: (value: boolean) => void;
  /** Compact layout for the quiz/results header */
  compact?: boolean;
}

function AccentToggle({ accentStrict, onChange, compact }: AccentToggleProps) {
  if (compact) {
    return (
      <button
        onClick={() => onChange(!accentStrict)}
        className="flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-colors"
        style={
          accentStrict
            ? { background: 'rgba(30,58,95,0.12)', color: 'var(--color-primary)' }
            : { background: 'rgba(0,0,0,0.05)', color: 'var(--color-text-muted)' }
        }
        aria-pressed={accentStrict}
        title={
          accentStrict
            ? 'Accent checking on — click to relax'
            : 'Accent checking off — click to enable'
        }
      >
        <span>{accentStrict ? 'Accents: on' : 'Accents: off'}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Accent Checking
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {accentStrict
            ? 'Accents required — wrong accent = marked incorrect'
            : 'Relaxed — right letters, any accentuation = correct'}
        </div>
      </div>
      {/* Toggle switch */}
      <button
        role="switch"
        aria-checked={accentStrict}
        onClick={() => onChange(!accentStrict)}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2"
        style={{
          background: accentStrict ? 'var(--color-primary)' : '#d1d5db',
        }}
        aria-label={`Accent checking ${accentStrict ? 'on' : 'off'}`}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: accentStrict ? 'translateX(1.25rem)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParadigmSelector — phase 1
// ---------------------------------------------------------------------------

interface ParadigmSelectorProps {
  accentStrict: boolean;
  onToggleAccent: (value: boolean) => void;
  density: Density;
  onDensityChange: (d: Density) => void;
  onStart: (table: TableModel, density: Density) => void;
}

function ParadigmSelector({
  accentStrict,
  onToggleAccent,
  density,
  onDensityChange,
  onStart,
}: ParadigmSelectorProps) {
  const tables = useMemo(() => buildTableModels(), []);
  const [activeCategory, setActiveCategory] = useState<Category>('noun');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeMood, setActiveMood] = useState<Mood>('indicative');

  const filtered = tables.filter((t) => t.category === activeCategory);
  const selected = filtered.find((t) => t.id === selectedId) ?? null;

  // Split verb tables into grid-eligible (standard λύω conjugations) and supplemental
  const verbGridIds = useMemo(() => new Set(verbParadigms.map((p) => `verb-${p.id}`)), []);
  const supplementalVerbs = filtered.filter((t) => !verbGridIds.has(t.id));

  const handleStart = () => {
    if (!selected) return;
    onStart(selected, density);
  };

  // Settings card (shared between both layout columns)
  const settingsCard = (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{ background: 'var(--color-bg-card)', border: '1px solid #e5e7eb' }}
    >
      {/* Difficulty */}
      <div className="space-y-2">
        <div
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Difficulty
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['easy', 'medium', 'hard'] as Density[]).map((d) => (
            <button
              key={d}
              onClick={() => onDensityChange(d)}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left"
              style={
                density === d
                  ? { background: 'var(--color-primary)', color: '#fff' }
                  : {
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      border: '1px solid #e5e7eb',
                    }
              }
            >
              <div className="font-semibold">{DENSITY_LABELS[d].split(' (')[0]}</div>
              <div className="text-xs opacity-70 mt-0.5">{DENSITY_DESCS[d].split('.')[0]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #e5e7eb' }} />

      {/* Accent toggle */}
      <AccentToggle accentStrict={accentStrict} onChange={onToggleAccent} />
    </div>
  );

  // Paradigm card list (non-verb categories, or supplemental verb tables)
  const paradigmCards = (tablesToShow: typeof filtered) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {tablesToShow.map((table) => {
        const isSelected = table.id === selectedId;
        const totalCells = table.rows.reduce(
          (sum, row) => sum + row.answers.filter((a) => a !== null).length,
          0,
        );
        return (
          <button
            key={table.id}
            onClick={() => setSelectedId(isSelected ? null : table.id)}
            className="text-left rounded-xl p-4 transition-all shadow-sm"
            style={{
              border: `2px solid ${isSelected ? 'var(--color-accent)' : '#e5e7eb'}`,
              background: isSelected ? 'rgba(245,158,11,0.08)' : 'var(--color-bg-card)',
            }}
          >
            <div
              className="font-semibold text-sm mb-0.5"
              style={{ color: isSelected ? 'var(--color-accent)' : 'var(--color-primary)' }}
            >
              {table.label}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {totalCells} cells
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setSelectedId(null);
            }}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors"
            style={
              activeCategory === cat
                ? { background: 'var(--color-primary)', color: '#fff' }
                : {
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid #e5e7eb',
                  }
            }
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Paradigm selection */}
      {activeCategory === 'verb' ? (
        <>
          {/* VerbParadigmGrid for standard λύω conjugations */}
          <VerbParadigmGrid
            paradigms={verbParadigms}
            selectedId={selectedId ? selectedId.replace(/^verb-/, '') : ''}
            onSelect={(id) => setSelectedId(`verb-${id}`)}
            activeMood={activeMood}
            onMoodChange={(mood) => {
              setActiveMood(mood);
              setSelectedId(null);
            }}
            showFormPreview
          />
          {/* Supplemental verb tables (infinitives, participles, contract, liquid) */}
          {supplementalVerbs.length > 0 && (
            <div className="space-y-2">
              <div
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Other Verb Paradigms
              </div>
              {paradigmCards(supplementalVerbs)}
            </div>
          )}
        </>
      ) : (
        paradigmCards(filtered)
      )}

      {/* Settings + start button */}
      <div className="space-y-4">
        {settingsCard}

        {/* Keyboard hint */}
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Inputs use Beta Code — type English letters to produce Greek (e.g.,{' '}
          <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono">l</kbd> → λ,{' '}
          <kbd className="px-1 py-0.5 rounded bg-gray-100 font-mono">/</kbd> → acute accent).
        </p>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!selected}
          className="w-full py-3 rounded-xl font-bold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            selected
              ? { background: 'var(--color-coral)', color: '#fff' }
              : { background: '#e5e7eb', color: '#9ca3af' }
          }
        >
          {selected ? `Start Quiz — ${selected.label}` : 'Select a paradigm to begin'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuizTable — phase 2 & 3
// ---------------------------------------------------------------------------

interface QuizTableProps {
  table: TableModel;
  cells: QuizCell[];
  inputs: InputMap;
  onInputChange: (cellIndex: number, raw: string) => void;
  submitted: boolean;
  results: Record<number, CellResult>;
  accentStrict: boolean;
}

function QuizTable({
  table,
  cells,
  inputs,
  onInputChange,
  submitted,
  results,
  accentStrict,
}: QuizTableProps) {
  const blankSet = useMemo(
    () => new Set(cells.filter((c) => c.isBlank).map((c) => c.index)),
    [cells],
  );

  const hasColGroups = !!table.colGroups;
  const numGroups = table.colGroups?.length ?? 0;
  const colsPerGroup = hasColGroups ? table.cols.length / numGroups : 0;

  let firstBlank = true;

  return (
    <div className="overflow-x-auto rounded-xl shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
      <table className="w-full text-sm">
        <thead>
          {hasColGroups && (
            <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
              <th className="px-3 py-2" style={{ width: '5rem' }} />
              {table.colGroups?.map((group, gi) => (
                <th
                  key={gi}
                  colSpan={colsPerGroup}
                  className="px-2 py-2 text-center font-semibold text-xs uppercase tracking-wider border-l"
                  style={{ color: 'var(--color-text-muted)', borderColor: '#e5e7eb' }}
                >
                  {group}
                </th>
              ))}
            </tr>
          )}
          <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
            <th
              className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)', width: '5rem' }}
            />
            {table.cols.map((col, ci) => (
              <th
                key={ci}
                className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              style={{
                background: rowIndex % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)',
              }}
            >
              <td
                className="px-3 py-2 font-semibold text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {row.label}
              </td>
              {row.answers.map((answer, colIndex) => {
                const idx = rowIndex * table.cols.length + colIndex;
                const isBlank = blankSet.has(idx);
                const rawResult = submitted ? results[idx] : undefined;

                if (answer === null) {
                  return (
                    <td
                      key={colIndex}
                      className="px-3 py-2 text-center"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      —
                    </td>
                  );
                }

                if (!isBlank) {
                  return (
                    <td
                      key={colIndex}
                      className="px-3 py-2 text-center font-greek text-base"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {answer}
                    </td>
                  );
                }

                // Blank cell — quiz input
                const shouldAutoFocus = !submitted && firstBlank;
                if (firstBlank) firstBlank = false;

                if (submitted && rawResult) {
                  const displayResult = resolveDisplayResult(rawResult, accentStrict);
                  const style = RESULT_STYLES[displayResult];
                  const userInput = applyFinalSigma((inputs[idx] ?? '').trim());
                  const wasAccentOnly = rawResult === 'accent-only';
                  return (
                    <td key={colIndex} className="px-2 py-1.5 text-center">
                      <div
                        className="rounded px-1.5 py-1 text-sm font-greek"
                        style={{
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          color: style.text,
                        }}
                      >
                        {displayResult === 'correct' ? (
                          <span>{answer}</span>
                        ) : (
                          <span>
                            <span className="line-through opacity-60">{userInput || '—'}</span>{' '}
                            <span className="font-semibold">{answer}</span>
                          </span>
                        )}
                      </div>
                      {/* Accent annotation: shown only when strict mode is ON */}
                      {wasAccentOnly && accentStrict && (
                        <div className="text-xs mt-0.5" style={{ color: style.text }}>
                          accent
                        </div>
                      )}
                      {/* Relaxed-mode annotation: shown when strict is OFF and accent was wrong */}
                      {wasAccentOnly && !accentStrict && (
                        <div className="text-xs mt-0.5" style={{ color: '#059669' }}>
                          accent relaxed
                        </div>
                      )}
                    </td>
                  );
                }

                return (
                  <td key={colIndex} className="px-2 py-1.5 text-center">
                    <CellInput
                      cellIndex={idx}
                      value={inputs[idx] ?? ''}
                      onChange={onInputChange}
                      autoFocus={shouldAutoFocus}
                      disabled={submitted}
                    />
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

// ---------------------------------------------------------------------------
// ScoreBadge
// ---------------------------------------------------------------------------

interface ScoreBadgeProps {
  correct: number;
  accentOnly: number;
  wrong: number;
  total: number;
  accentStrict: boolean;
}

function ScoreBadge({ correct, accentOnly, wrong, total, accentStrict }: ScoreBadgeProps) {
  const effectiveCorrect = accentStrict ? correct : correct + accentOnly;
  const pct = total === 0 ? 0 : Math.round((effectiveCorrect / total) * 100);
  const color = pct >= 90 ? '#059669' : pct >= 70 ? '#d97706' : '#dc2626';
  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <span className="text-4xl font-extrabold" style={{ color }}>
        {effectiveCorrect}/{total}
      </span>
      <span className="text-xl font-semibold" style={{ color }}>
        {pct}%
      </span>
      {accentStrict && accentOnly > 0 && (
        <span
          className="text-sm px-2 py-0.5 rounded-full font-medium"
          style={{ background: '#fef3c7', color: '#78350f' }}
        >
          +{accentOnly} accent {accentOnly === 1 ? 'error' : 'errors'}
        </span>
      )}
      {!accentStrict && accentOnly > 0 && (
        <span
          className="text-sm px-2 py-0.5 rounded-full font-medium"
          style={{ background: '#d1fae5', color: '#065f46' }}
        >
          {accentOnly} accent {accentOnly === 1 ? 'error' : 'errors'} (ignored)
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParadigmQuiz — root component
// ---------------------------------------------------------------------------

function ParadigmQuizInner() {
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [inputs, setInputs] = useState<InputMap>({});
  const [results, setResults] = useState<Record<number, CellResult>>({});
  // Settings persist to localStorage across sessions
  const [accentStrict, setAccentStrict] = useState(() => loadQuizSettings().accentStrict);
  const [density, setDensity] = useState<Density>(() => loadQuizSettings().density);

  useEffect(() => {
    saveQuizSettings({ accentStrict, density });
  }, [accentStrict, density]);

  const submitted = phase.name === 'results';

  const handleStart = useCallback((table: TableModel, density: Density) => {
    const allCells = getQuizCells(table);
    const cells = applyDensity(allCells, density);
    setInputs({});
    setResults({});
    setPhase({ name: 'quiz', table, cells, density });
    posthog.capture('paradigm_quiz_started', { quiz_type: table.label });
  }, []);

  const handleInputChange = useCallback((cellIndex: number, raw: string) => {
    setInputs((prev) => ({ ...prev, [cellIndex]: raw }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (phase.name !== 'quiz') return;
    const { table, cells, density } = phase;
    const newResults: Record<number, CellResult> = {};
    for (const cell of cells) {
      if (!cell.isBlank) continue;
      const userInput = inputs[cell.index] ?? '';
      newResults[cell.index] = checkAnswer(userInput, cell.answer);
    }
    const vals = Object.values(newResults);
    const correct = vals.filter((r) => r === 'correct').length;
    posthog.capture('paradigm_quiz_answered', {
      paradigm: table.label,
      correct,
      total: vals.length,
    });
    setResults(newResults);
    setPhase({ name: 'results', table, cells, density, inputs });
  }, [phase, inputs]);

  const handleRetry = useCallback(() => {
    if (phase.name !== 'results') return;
    handleStart(phase.table, phase.density);
  }, [phase, handleStart]);

  const handleNewParadigm = useCallback(() => {
    setPhase({ name: 'select' });
    setInputs({});
    setResults({});
  }, []);

  // Score computation — always from raw results; accentStrict affects display
  const score = useMemo(() => {
    if (phase.name !== 'results') return { correct: 0, accentOnly: 0, wrong: 0, total: 0 };
    const vals = Object.values(results);
    return {
      correct: vals.filter((r) => r === 'correct').length,
      accentOnly: vals.filter((r) => r === 'accent-only').length,
      wrong: vals.filter((r) => r === 'wrong').length,
      total: vals.length,
    };
  }, [phase, results]);

  // ── Select phase ──────────────────────────────────────────────────────────
  if (phase.name === 'select') {
    return (
      <ParadigmSelector
        accentStrict={accentStrict}
        onToggleAccent={setAccentStrict}
        density={density}
        onDensityChange={setDensity}
        onStart={handleStart}
      />
    );
  }

  // ── Quiz & Results phases ─────────────────────────────────────────────────
  const { table, cells, density: phaseDensity } = phase;
  const activeInputs = phase.name === 'results' ? phase.inputs : inputs;
  const blankCount = cells.filter((c) => c.isBlank).length;

  // Effective score counts accent-only as correct when not strict
  const effectiveCorrect = accentStrict ? score.correct : score.correct + score.accentOnly;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {table.label}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(30,58,95,0.1)', color: 'var(--color-primary)' }}
            >
              {DENSITY_LABELS[phaseDensity]} — {blankCount} blank{blankCount !== 1 ? 's' : ''}
            </span>
            {/* Accent toggle: compact pill in quiz/results header */}
            <AccentToggle accentStrict={accentStrict} onChange={setAccentStrict} compact />
          </div>
        </div>
        <button
          onClick={handleNewParadigm}
          className="text-sm underline"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Change paradigm
        </button>
      </div>

      {/* Score (results phase only) */}
      {phase.name === 'results' && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid #e5e7eb' }}
        >
          <ScoreBadge
            correct={score.correct}
            accentOnly={score.accentOnly}
            wrong={score.wrong}
            total={score.total}
            accentStrict={accentStrict}
          />
          <div className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {effectiveCorrect === score.total
              ? 'Perfect! Every cell correct.'
              : !accentStrict && score.accentOnly > 0
                ? 'Green = correct (accents ignored). Red = wrong form.'
                : score.accentOnly > 0
                  ? 'Yellow = correct letters, wrong accent. Red = wrong form.'
                  : 'Red = wrong form — correct answer shown.'}
          </div>
        </div>
      )}

      {/* Table */}
      <QuizTable
        table={table}
        cells={cells}
        inputs={activeInputs}
        onInputChange={handleInputChange}
        submitted={submitted}
        results={results}
        accentStrict={accentStrict}
      />

      {/* Legend (results phase) */}
      {phase.name === 'results' && (
        <div className="flex gap-4 flex-wrap text-xs">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ background: '#d1fae5', border: '1px solid #6ee7b7' }}
            />
            <span style={{ color: 'var(--color-text-muted)' }}>Correct</span>
          </span>
          {accentStrict && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded"
                style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}
              />
              <span style={{ color: 'var(--color-text-muted)' }}>Accent error</span>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded"
              style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}
            />
            <span style={{ color: 'var(--color-text-muted)' }}>Wrong</span>
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {phase.name === 'quiz' && (
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl font-bold text-sm transition-colors"
            style={{ background: 'var(--color-coral)', color: '#fff' }}
          >
            Submit Answers
          </button>
        )}
        {phase.name === 'results' && (
          <>
            <button
              onClick={handleRetry}
              className="px-6 py-2.5 rounded-xl font-bold text-sm transition-colors"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              Try Again
            </button>
            <button
              onClick={handleNewParadigm}
              className="px-6 py-2.5 rounded-xl font-bold text-sm transition-colors"
              style={{
                background: 'var(--color-bg-card)',
                color: 'var(--color-primary)',
                border: '1px solid #e5e7eb',
              }}
            >
              New Paradigm
            </button>
          </>
        )}
      </div>

      {/* Keyboard reference chart (quiz phase only) */}
      {phase.name === 'quiz' && <BetaCodeReference />}
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
