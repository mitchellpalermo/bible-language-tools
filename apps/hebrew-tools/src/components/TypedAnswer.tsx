// The typed-answer half of a vocabulary flashcard (#74): the field a gloss or a
// Hebrew word is typed into, and the mark it earns.
//
// A mark never answers the card. Check says how the typed text compares and
// reveals the back; the student then picks a grade (or Missed / Got it), with
// every button live. See "Drill modes answer Missed / Got it" in the repo
// CLAUDE.md.
//
// Hebrew is typed the way the paradigm quiz types it: a hardware keyboard goes
// through the phonetic mapping, and the on-screen keypad puts every letter and
// point one tap away. The keypad is the iPad's route. With it open the field
// is `inputMode="none"`, so a tap does not raise the system keyboard over it.

import ToggleSwitch from '@tools/shared/components/ToggleSwitch';
import { useEffect, useRef } from 'react';
import type { TypedMark } from '../lib/flashcard-answer';
import type { AnswerResult } from '../lib/hebrew-input';
import { useHebrewInput } from '../lib/use-hebrew-input';
import HebrewKeypad from './HebrewKeypad';

const ACCENT = 'var(--color-primary, #15803D)';

/** The typed-answer controls a card is given in Type mode. */
export interface TypedAnswerProps {
  /** The raw typed value. For Hebrew, final forms are applied on display. */
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** `null` until checked. */
  mark: TypedMark | null;
  /** Whether the answer is Hebrew, so the field types Hebrew. */
  hebrew: boolean;
  /** Changes with the card, so the field takes focus on each new one. */
  focusKey: string;
  keypadOpen: boolean;
  onToggleKeypad: () => void;
}

const FIELD =
  'flex-1 min-w-0 select-text px-3 py-2.5 border-2 border-primary/15 rounded-xl bg-bg-card focus:border-primary focus:outline-none';

const CHECK =
  'px-4 py-2.5 bg-primary text-white rounded-xl hover:opacity-90 text-sm font-semibold transition-opacity shadow-sm';

/**
 * Focus the field on every new card, so a typed session never needs a tap
 * between answers. The field unmounts while a mark is shown, so a new card is
 * usually a new mount; `focusKey` covers the case where it is not (Restart
 * session with an answer half typed).
 */
function useFocusOnCard(focusKey: string) {
  const ref = useRef<HTMLInputElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new card is the trigger
  useEffect(() => {
    ref.current?.focus();
  }, [focusKey]);
  return ref;
}

function GlossField({ value, onChange, onSubmit, focusKey }: TypedAnswerProps) {
  const ref = useFocusOnCard(focusKey);
  return (
    <div className="mt-6 flex flex-col sm:flex-row gap-2 w-full max-w-sm">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
        }}
        placeholder="Type the English gloss…"
        aria-label="Your answer in English"
        className={`${FIELD} text-base sm:text-sm`}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="button" onClick={onSubmit} className={CHECK}>
        Check
      </button>
    </div>
  );
}

function HebrewField({
  value,
  onChange,
  onSubmit,
  focusKey,
  keypadOpen,
  onToggleKeypad,
}: TypedAnswerProps) {
  const input = useHebrewInput({ value, onChange });
  const focusRef = useFocusOnCard(focusKey);

  return (
    <div className="mt-6 w-full space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm mx-auto">
        <input
          ref={(el) => {
            input.ref.current = el;
            focusRef.current = el;
          }}
          type="text"
          dir="rtl"
          lang="he"
          value={input.display}
          onChange={input.onChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
              return;
            }
            input.onKeyDown(e);
          }}
          inputMode={keypadOpen ? 'none' : 'text'}
          enterKeyHint="done"
          placeholder="Type the Hebrew word"
          aria-label="Your answer in Hebrew"
          className={`${FIELD} text-2xl placeholder:text-sm placeholder:font-sans`}
          style={{ color: 'var(--color-hebrew)', fontFamily: 'var(--font-hebrew)' }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button type="button" onClick={onSubmit} className={CHECK}>
          Check
        </button>
      </div>

      <div className="flex justify-center">
        <ToggleSwitch
          checked={keypadOpen}
          onChange={onToggleKeypad}
          label="Keypad"
          accent={ACCENT}
        />
      </div>
      {keypadOpen ? (
        <HebrewKeypad onInsert={input.insert} onBackspace={input.backspace} />
      ) : (
        <p className="text-xs text-text-muted">
          Type with the{' '}
          <a href="/keyboard" className="underline">
            phonetic mapping
          </a>
          : <kbd className="font-mono">S</kbd> <kbd className="font-mono">E</kbd>{' '}
          <kbd className="font-mono">m</kbd> types{' '}
          <span dir="rtl" lang="he" style={{ fontFamily: 'var(--font-hebrew)' }}>
            שֵׁם
          </span>
          . The last letter takes its final form by itself.
        </p>
      )}
    </div>
  );
}

/** The field for the answer still to be checked. */
export function TypedAnswerField(props: TypedAnswerProps) {
  return props.hebrew ? <HebrewField {...props} /> : <GlossField {...props} />;
}

// ─── The mark ─────────────────────────────────────────────────────────────────

const AMBER = { bg: '#FEF3C7', border: '#FCD34D', text: '#78350F' };

const MARK_HEADINGS: Record<AnswerResult, string> = {
  correct: 'Correct!',
  'dagesh-only': 'Right letters and vowels, dagesh off',
  'nikud-only': 'Right consonants, pointing off',
  wrong: 'Not quite',
};

function Quoted({ text, hebrew }: { text: string; hebrew: boolean }) {
  return hebrew ? (
    <span
      dir="rtl"
      lang="he"
      className="font-semibold text-xl"
      style={{
        fontFamily: 'var(--font-hebrew)',
        color: 'var(--color-hebrew)',
        unicodeBidi: 'isolate',
      }}
    >
      {text}
    </span>
  ) : (
    <span className="font-semibold text-text">{text}</span>
  );
}

/**
 * How the typed answer compared. A pointing or dagesh slip is its own tier,
 * amber rather than red, and shows what was typed beside the answer: the
 * difference is one mark, and it is easier to find side by side.
 */
export function TypedAnswerMark({ mark }: { mark: TypedMark }) {
  const near = mark.result === 'dagesh-only' || mark.result === 'nikud-only';
  const tone =
    mark.result === 'correct' ? 'var(--color-jade, #059669)' : 'var(--color-coral, #F43F5E)';

  return (
    <div
      role="status"
      data-result={mark.result}
      className={`mt-4 px-4 py-3 rounded-xl w-full max-w-sm text-center border-2 ${
        near
          ? ''
          : mark.result === 'correct'
            ? 'bg-jade/5 border-jade/30'
            : 'bg-coral/5 border-coral/30'
      }`}
      style={near ? { background: AMBER.bg, borderColor: AMBER.border } : undefined}
    >
      <p className="font-bold" style={{ color: near ? AMBER.text : tone }}>
        {MARK_HEADINGS[mark.result]}
      </p>
      {mark.result !== 'correct' && (
        <p className="text-text-muted text-sm mt-1" dir="ltr">
          {near && mark.typed.length > 0 && (
            <>
              You typed <Quoted text={mark.typed} hebrew={mark.hebrew} /> &middot;{' '}
            </>
          )}
          Answer: <Quoted text={mark.answer} hebrew={mark.hebrew} />
        </p>
      )}
    </div>
  );
}
