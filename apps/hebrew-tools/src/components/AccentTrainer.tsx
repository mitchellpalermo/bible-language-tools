/**
 * AccentTrainer — how an ending moves the accent and changes the stem's
 * vowels, worked one step at a time (#185).
 *
 * A noun and an ending are shown; the student divides the new form into
 * syllables, marks the accent, labels the pretonic and distant syllables, then
 * types the form with full pointing. Each step is checked before the next
 * unlocks (`@tools/shared/step-drill`), and a miss names the rule it broke.
 *
 * Things to know before changing it:
 *
 * - **Steps 1–3 show the bare letters.** The pointed form is step 4's answer,
 *   so the syllable chips are drawn from `letters()`, never from the item's
 *   pointed syllables. The pointed syllables appear only once the item is done.
 * - **The first render is the empty state on server and client alike.** The
 *   queue is dealt from the SRS store in an effect, the same reason the
 *   Flashcards pages deal in an effect (see "Hydration" in the repo CLAUDE.md).
 * - **Only a step's first try is logged and scored.** The second try comes
 *   with the feedback in view.
 */

import { RuleFeedback, StepList } from '@tools/shared/components/StepDrill';
import ToggleSwitch from '@tools/shared/components/ToggleSwitch';
import {
  canSkipScaffold,
  initialStepDrill,
  isCleanPass,
  pushHistory,
  type StepDrillAction,
  type StepDrillState,
  stepDrillReducer,
} from '@tools/shared/step-drill';
import { useStoredState } from '@tools/shared/use-stored-state';
import posthog from 'posthog-js';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  ENDING_KIND_LABELS,
  POSITION_LABELS,
  positionOf,
  SHIFT_RULES,
  type ShiftItem,
  type ShiftRuleId,
} from '../data/accent-shift';
import { loadSRSStore, loadStats, saveSRSStore, saveStats } from '../data/srs';
import {
  buildQueue,
  checkAccent,
  checkForm,
  checkPositions,
  checkSyllables,
  expectedPositions,
  type FormCheck,
  formConcepts,
  letters,
  loadScaffoldHistory,
  type PositionLabel,
  recordItem,
  SCAFFOLD_STEPS,
  STEP_CONCEPTS,
  STEP_LABELS,
  type StepCheck,
  saveScaffoldHistory,
  syllableGaps,
} from '../lib/accent-shift';
import { logAttempts } from '../lib/attempt-log';
import { useHebrewInput } from '../lib/use-hebrew-input';
import ErrorBoundary from './ErrorBoundary';
import HebrewKeypad from './HebrewKeypad';
import { Hebrew, Prose } from './HebrewRuns';

const ACCENT = 'var(--color-primary, #15803D)';
const STEP_COUNT = STEP_LABELS.length;
const FORM_STEP = STEP_COUNT - 1;

const HEBREW_STYLE = { fontFamily: 'var(--font-hebrew)' } as const;

/** Split bare letters into syllables at the chosen gaps (1-based, after letter g). */
function chunk(chars: string[], gaps: ReadonlySet<number>): string[] {
  const out: string[] = [];
  let current = '';
  chars.forEach((c, i) => {
    current += c;
    if (gaps.has(i + 1) || i === chars.length - 1) {
      out.push(current);
      current = '';
    }
  });
  return out;
}

function feedbackRules(ids: string[]) {
  return ids.map((id) => {
    const rule = SHIFT_RULES[id as ShiftRuleId];
    return { id, name: rule.name, text: <Prose>{rule.text}</Prose>, href: rule.href };
  });
}

// ─── Steps ────────────────────────────────────────────────────────────────────

/** Step 1: tap the gaps between letters to divide the word. */
function SyllableStep({
  chars,
  gaps,
  onToggle,
}: {
  chars: string[];
  gaps: ReadonlySet<number>;
  onToggle: (gap: number) => void;
}) {
  return (
    <div>
      <p className="text-sm text-text-muted mb-3">
        Tap between letters to divide the new form into syllables.
      </p>
      <div dir="rtl" className="flex items-center justify-center flex-wrap gap-y-2">
        {chars.map((c, i) => {
          const gap = i + 1;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: letters repeat; position is the identity
            <span key={i} className="flex items-center">
              <span lang="he" className="text-4xl text-hebrew px-1" style={HEBREW_STYLE}>
                {c}
              </span>
              {gap < chars.length && (
                <button
                  type="button"
                  aria-pressed={gaps.has(gap)}
                  aria-label={`Divide after letter ${gap}`}
                  onClick={() => onToggle(gap)}
                  className={`mx-0.5 h-12 w-6 rounded-md transition-colors flex items-center justify-center ${
                    gaps.has(gap) ? 'bg-primary/15' : 'hover:bg-primary/5'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`block h-9 w-0.5 rounded ${gaps.has(gap) ? 'bg-primary' : 'bg-primary/15'}`}
                  />
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** A syllable shown as bare letters, for steps 2 and 3. */
function SyllableChip({
  text,
  accented,
  pressed,
  onClick,
  label,
}: {
  text: string;
  accented: boolean;
  pressed?: boolean;
  onClick?: () => void;
  label: string;
}) {
  const body = (
    <span lang="he" className="text-3xl text-hebrew" style={HEBREW_STYLE}>
      {text}
      {accented && (
        <span aria-hidden="true" className="text-coral text-xl align-top">
          ´
        </span>
      )}
    </span>
  );
  const base =
    'min-w-16 px-3 py-2 rounded-xl border-2 flex items-center justify-center transition-colors';
  if (!onClick) {
    return <span className={`${base} border-primary/15 bg-bg-card`}>{body}</span>;
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`${base} ${pressed ? 'border-coral bg-coral/10' : 'border-primary/15 bg-bg-card hover:border-primary/40'}`}
    >
      {body}
    </button>
  );
}

function PositionStep({
  syllables,
  accent,
  positions,
  onChoose,
}: {
  syllables: string[];
  accent: number;
  positions: (PositionLabel | null)[];
  onChoose: (index: number, position: PositionLabel) => void;
}) {
  return (
    <div>
      <p className="text-sm text-text-muted mb-3">
        Label each syllable before the accent: pretonic or distant.
      </p>
      <div dir="rtl" className="flex justify-center flex-wrap gap-3">
        {syllables.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: syllables are positional
          <div key={i} className="flex flex-col items-center gap-2">
            <SyllableChip text={s} accented={i === accent} label={`Syllable ${i + 1}`} />
            {i === accent ? (
              <span className="text-xs font-semibold text-coral" dir="ltr">
                Accented
              </span>
            ) : (
              <div className="flex gap-1" dir="ltr">
                {(Object.keys(POSITION_LABELS) as PositionLabel[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={positions[i] === p}
                    aria-label={`Syllable ${i + 1}: ${POSITION_LABELS[p]}`}
                    onClick={() => onChoose(i, p)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      positions[i] === p
                        ? 'bg-primary text-white border-primary'
                        : 'border-primary/20 text-primary hover:bg-primary/5'
                    }`}
                  >
                    {POSITION_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface KeypadTarget {
  insert: (text: string) => void;
  backspace: () => void;
}

/**
 * The typing hook lives here, not in the page: it attaches its Android
 * `beforeinput` listener when it mounts, so it must mount with the field.
 * The keypad sits outside, and reaches the field through `register`.
 */
function FormStep({
  value,
  onChange,
  onSubmit,
  keypadOpen,
  register,
}: {
  value: string;
  onChange: (raw: string) => void;
  onSubmit: () => void;
  keypadOpen: boolean;
  register: (target: KeypadTarget | null) => void;
}) {
  const input = useHebrewInput({ value, onChange });
  const { ref, insert, backspace } = input;
  useEffect(() => {
    register({ insert, backspace });
    return () => register(null);
  }, [register, insert, backspace]);
  // Focus on arrival, so typing can start at once.
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
      return;
    }
    input.onKeyDown(e);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Type the new form with full pointing.</p>
      <input
        ref={ref}
        type="text"
        dir="rtl"
        lang="he"
        value={input.display}
        onKeyDown={handleKeyDown}
        onChange={input.onChange}
        inputMode={keypadOpen ? 'none' : 'text'}
        enterKeyHint="done"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="The new form, pointed"
        className="w-full text-center text-3xl py-3 px-4 rounded-xl border-2 border-accent/60 bg-bg focus:outline-none focus:border-primary"
        style={{ color: 'var(--color-hebrew)', ...HEBREW_STYLE }}
      />
    </div>
  );
}

/** The finished item: the pointed form, syllable by syllable, with each rule. */
function Breakdown({ item }: { item: ShiftItem }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">How each syllable changed</caption>
      <thead>
        <tr className="text-left text-text-muted">
          <th className="font-medium py-1 pr-3">Syllable</th>
          <th className="font-medium py-1 pr-3">Position</th>
          <th className="font-medium py-1">Rule</th>
        </tr>
      </thead>
      <tbody>
        {item.syllables.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: syllables are positional
          <tr key={i} className="border-t border-primary/10">
            <td className="py-1.5 pr-3">
              <Hebrew className="text-2xl">{s.text}</Hebrew>
            </td>
            <td className="py-1.5 pr-3 capitalize">{positionOf(i, item.accent)}</td>
            <td className="py-1.5">
              <a href={SHIFT_RULES[s.rule].href} className="text-primary hover:underline">
                {SHIFT_RULES[s.rule].name}
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── The page ─────────────────────────────────────────────────────────────────

interface Answers {
  gaps: Set<number>;
  accent: number | null;
  positions: (PositionLabel | null)[];
  typed: string;
}

const EMPTY_ANSWERS: Answers = { gaps: new Set(), accent: null, positions: [], typed: '' };

function AccentTrainerInner() {
  const [queue, setQueue] = useState<ShiftItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [speedMode, setSpeedMode] = useState(false);
  const startAt = speedMode ? SCAFFOLD_STEPS : 0;
  const [drill, setDrill] = useState<StepDrillState>(() => initialStepDrill(0));
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [formCheck, setFormCheck] = useState<FormCheck | null>(null);
  const [history, setHistory] = useStoredState(loadScaffoldHistory, [], saveScaffoldHistory);
  const [tally, setTally] = useState({ done: 0, clean: 0 });
  const [keypadOpen, setKeypadOpen] = useState(false);
  const stepOpenedAt = useRef(Date.now());
  // The form field's insert/backspace, for the keypad rendered outside it.
  const keypadTarget = useRef<KeypadTarget | null>(null);
  const registerKeypad = useCallback((target: KeypadTarget | null) => {
    keypadTarget.current = target;
  }, []);

  // Dealt after mount: the server has no store, and the first render must match.
  useEffect(() => {
    setQueue(buildQueue(loadSRSStore()));
    setKeypadOpen(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);

  const item = queue?.[index % (queue?.length || 1)];
  const canSkip = canSkipScaffold(history);
  const done = drill.step >= STEP_COUNT;

  if (!queue || !item) {
    return <p className="text-text-muted">Loading the drill…</p>;
  }

  const chars = letters(item.form);
  const studentSyllables = chunk(chars, drill.step > 0 ? syllableGaps(item) : answers.gaps);

  function apply(action: StepDrillAction, check?: StepCheck) {
    if (!item) return;
    const step = drill.step;
    // The first try at a step is the one that counts, so it is the one logged.
    if (!drill.missedOpenStep) {
      const correct = action.type === 'answer' && action.correct;
      const ms = Date.now() - stepOpenedAt.current;
      if (step === FORM_STEP) {
        const fc = check as FormCheck | undefined;
        logAttempts(
          fc
            ? formConcepts(item, fc).map((a) => ({ ...a, ms }))
            : item.syllables.map((s) => ({
                concept: `accent-shift/${s.rule}`,
                correct: false,
                ms,
              })),
        );
      } else {
        logAttempts([{ concept: STEP_CONCEPTS[step], correct, ms }]);
      }
    }

    const next = stepDrillReducer(drill, action);
    setDrill(next);
    if (next.step !== step) stepOpenedAt.current = Date.now();
    if (next.step >= STEP_COUNT) finish(next);
  }

  function finish(state: StepDrillState) {
    if (!item) return;
    const clean = isCleanPass(state, STEP_COUNT);
    const { store, stats } = recordItem(loadSRSStore(), loadStats(), item.id, clean);
    saveSRSStore(store);
    saveStats(stats);
    if (!speedMode) setHistory(pushHistory(history, state.firstTry.slice(0, SCAFFOLD_STEPS)));
    setTally((t) => ({ done: t.done + 1, clean: t.clean + (clean ? 1 : 0) }));
    posthog.capture('hebrew_accent_item_completed', {
      item: item.id,
      clean,
      speed_mode: speedMode,
    });
  }

  function check() {
    if (!item) return;
    let result: StepCheck;
    switch (drill.step) {
      case 0:
        result = checkSyllables(item, answers.gaps);
        break;
      case 1:
        result = checkAccent(item, answers.accent);
        break;
      case 2:
        result = checkPositions(item, answers.positions);
        break;
      default: {
        const fc = checkForm(item, answers.typed);
        setFormCheck(fc);
        result = fc;
      }
    }
    apply({ type: 'answer', correct: result.correct, rules: result.rules }, result);
  }

  /** "Show me": fill in this step's answer and move on, scored as a miss. */
  function reveal() {
    if (!item) return;
    setAnswers((a) => {
      switch (drill.step) {
        case 0:
          return { ...a, gaps: syllableGaps(item) };
        case 1:
          return { ...a, accent: item.accent };
        case 2:
          return { ...a, positions: expectedPositions(item) };
        default:
          return { ...a, typed: item.form };
      }
    });
    apply({ type: 'reveal' });
  }

  function nextItem(mode = speedMode) {
    setIndex((i) => i + 1);
    setAnswers({ ...EMPTY_ANSWERS, gaps: new Set() });
    setFormCheck(null);
    setDrill(initialStepDrill(mode ? SCAFFOLD_STEPS : 0));
    stepOpenedAt.current = Date.now();
  }

  function toggleSpeedMode() {
    const mode = !speedMode;
    setSpeedMode(mode);
    // Switching mid-item restarts it, so no item is half-scaffolded.
    setAnswers({ ...EMPTY_ANSWERS, gaps: new Set() });
    setFormCheck(null);
    setDrill(initialStepDrill(mode ? SCAFFOLD_STEPS : 0));
    stepOpenedAt.current = Date.now();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepList
          labels={STEP_LABELS}
          current={drill.step}
          firstTry={drill.firstTry}
          startAt={startAt}
        />
        {(canSkip || speedMode) && (
          <ToggleSwitch
            checked={speedMode}
            onChange={toggleSpeedMode}
            label="Speed mode"
            accent={ACCENT}
            title="Skip steps 1–3 and type the form straight away"
          />
        )}
      </div>
      {!canSkip && !speedMode && (
        <p className="text-xs text-text-muted -mt-4">
          Speed mode skips steps 1–3. It unlocks at 90% right first time on those steps, over your
          last 20.
        </p>
      )}

      <section
        aria-label="The noun and its ending"
        className="bg-bg-card rounded-2xl shadow-sm border border-primary/10 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2 text-center">
          <div>
            <Hebrew className="text-4xl">{item.base}</Hebrew>
            <p className="text-xs text-text-muted mt-1">{item.baseGloss}</p>
          </div>
          <span className="text-2xl text-text-muted" aria-hidden="true">
            +
          </span>
          <div>
            <Hebrew className="text-4xl">{item.ending}</Hebrew>
            <p className="text-xs text-text-muted mt-1">{ENDING_KIND_LABELS[item.endingKind]}</p>
          </div>
          <span className="text-2xl text-text-muted" aria-hidden="true">
            →
          </span>
          <div>
            <p className="text-lg font-semibold text-primary">“{item.gloss}”</p>
          </div>
        </div>
      </section>

      {!done && (
        <section
          aria-label={`Step ${drill.step + 1}: ${STEP_LABELS[drill.step]}`}
          className="space-y-4"
        >
          {drill.step === 0 && (
            <SyllableStep
              chars={chars}
              gaps={answers.gaps}
              onToggle={(gap) =>
                setAnswers((a) => {
                  const gaps = new Set(a.gaps);
                  if (gaps.has(gap)) gaps.delete(gap);
                  else gaps.add(gap);
                  return { ...a, gaps };
                })
              }
            />
          )}
          {drill.step === 1 && (
            <div>
              <p className="text-sm text-text-muted mb-3">
                Tap the syllable that takes the accent.
              </p>
              <div dir="rtl" className="flex justify-center flex-wrap gap-3">
                {studentSyllables.map((s, i) => (
                  <SyllableChip
                    // biome-ignore lint/suspicious/noArrayIndexKey: syllables are positional
                    key={i}
                    text={s}
                    accented={answers.accent === i}
                    pressed={answers.accent === i}
                    label={`Accent on syllable ${i + 1}`}
                    onClick={() => setAnswers((a) => ({ ...a, accent: i }))}
                  />
                ))}
              </div>
            </div>
          )}
          {drill.step === 2 && (
            <PositionStep
              syllables={studentSyllables}
              accent={item.accent}
              positions={answers.positions}
              onChoose={(i, p) =>
                setAnswers((a) => {
                  const positions = [...a.positions];
                  positions[i] = p;
                  return { ...a, positions };
                })
              }
            />
          )}
          {drill.step === FORM_STEP && (
            <FormStep
              value={answers.typed}
              onChange={(typed) => setAnswers((a) => ({ ...a, typed }))}
              onSubmit={check}
              keypadOpen={keypadOpen}
              register={registerKeypad}
            />
          )}

          <RuleFeedback rules={feedbackRules(drill.feedback)} heading="Not quite — try again" />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={check}
              className="flex-1 min-w-40 px-6 py-2.5 rounded-xl font-bold text-sm bg-coral text-white"
            >
              Check
            </button>
            {drill.missedOpenStep && (
              <button
                type="button"
                onClick={reveal}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm border border-primary/20 text-primary hover:bg-primary/5"
              >
                Show me
              </button>
            )}
            {drill.step === FORM_STEP && (
              <ToggleSwitch
                checked={keypadOpen}
                onChange={() => setKeypadOpen(!keypadOpen)}
                label="Keypad"
                accent={ACCENT}
              />
            )}
          </div>
          {/* Inline, not pinned: the field is the only thing on this step, and
              a pinned keypad covers it on a phone. */}
          {drill.step === FORM_STEP && keypadOpen && (
            <HebrewKeypad
              onInsert={(text) => keypadTarget.current?.insert(text)}
              onBackspace={() => keypadTarget.current?.backspace()}
            />
          )}
        </section>
      )}

      {done && (
        <section aria-label="Result" className="space-y-4">
          <div className="text-center">
            <Hebrew className="text-5xl">{item.form}</Hebrew>
            <p className="mt-2 font-semibold" role="status">
              {isCleanPass(drill, STEP_COUNT) ? (
                <span className="text-jade">Every step right first time.</span>
              ) : (
                <span className="text-coral">Done. This one comes back for review tomorrow.</span>
              )}
            </p>
            {formCheck?.result === 'dagesh-only' && (
              <p className="text-sm text-text-muted mt-1">
                Accepted, but check the dagesh against the form above.
              </p>
            )}
          </div>
          <Breakdown item={item} />
          <button
            type="button"
            onClick={() => nextItem()}
            className="w-full px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-white"
          >
            Next word
          </button>
        </section>
      )}

      <p className="text-xs text-text-muted" aria-live="polite">
        This session: {tally.done} done, {tally.clean} right first time.
      </p>
    </div>
  );
}

export default function AccentTrainer() {
  return (
    <ErrorBoundary component="AccentTrainer">
      <AccentTrainerInner />
    </ErrorBoundary>
  );
}
