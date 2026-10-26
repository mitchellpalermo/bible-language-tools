import { type CSSProperties, type RefObject, useEffect, useId, useRef, useState } from 'react';
import {
  isResetConfirmed,
  RESET_CONFIRM_WORD,
  type ResetDeps,
  type ResetOutcome,
  resetSrsProgress,
  retryServerReset,
} from '../reset-progress';

// The account page's "Danger zone": erasing every SRS review schedule.
//
// Three steps stand between the student and the erase, on purpose: open the
// panel, type the confirmation word, press the button. The panel names exactly
// what goes and what stays, because the store is shared — a hebrew.tools reset
// takes the handwriting and paradigm schedules with the flashcards — and the
// old `confirm()` said none of that. Each app passes its own lists.
//
// Styled inline on fallback-bearing tokens, never Tailwind utilities, for the
// reasons at the top of GradeButtons.tsx.

const CORAL = 'var(--color-coral, #F43F5E)';
const TEXT = 'var(--color-text, #1E1B4B)';
const MUTED = 'var(--color-text-muted, #6B7280)';
const CARD = 'var(--color-bg-card, #FFFFFF)';
const JADE = 'var(--color-jade, #059669)';

const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const baseButton: CSSProperties = {
  font: 'inherit',
  borderRadius: '0.75rem',
  padding: '0.625rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  lineHeight: 1.25,
  cursor: 'pointer',
};

const outlineDanger: CSSProperties = {
  ...baseButton,
  border: `2px solid ${tint(CORAL, 35)}`,
  background: 'transparent',
  color: CORAL,
};

const neutralButton: CSSProperties = {
  ...baseButton,
  border: `2px solid ${tint(MUTED, 30)}`,
  background: 'transparent',
  color: TEXT,
};

const paragraph: CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.875rem',
  lineHeight: 1.5,
  color: TEXT,
};

export interface ResetProgressProps extends Pick<ResetDeps, 'clearLocal' | 'clearServer'> {
  /** From the server's session, never the auth hint cookie. */
  signedIn: boolean;
  /** Everything that loses its review schedule, one line each. */
  erases: readonly string[];
  /** What the reset leaves alone, one short phrase each. */
  keeps: readonly string[];
}

type Phase = 'idle' | 'confirming' | 'working';

/** "a", "a and b", "a, b and c". */
export function joinPhrases(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export default function ResetProgress({
  signedIn,
  erases,
  keeps,
  clearLocal,
  clearServer,
}: ResetProgressProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState('');
  const [outcome, setOutcome] = useState<ResetOutcome | null>(null);
  const [retrying, setRetrying] = useState(false);

  const openRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // Where focus goes after the next render. Set by the handler that caused the
  // render, so a mount never steals focus from the rest of the page.
  const focusNext = useRef<'open' | 'input' | 'result' | null>(null);

  const ids = useId();
  const titleId = `${ids}-title`;
  const hintId = `${ids}-hint`;
  const inputId = `${ids}-input`;

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'open') openRef.current?.focus();
    if (target === 'input') inputRef.current?.focus();
    if (target === 'result') resultRef.current?.focus();
  });

  const confirmed = isResetConfirmed(typed);

  function open() {
    setOutcome(null);
    setTyped('');
    setPhase('confirming');
    focusNext.current = 'input';
  }

  function cancel() {
    setTyped('');
    setPhase('idle');
    focusNext.current = 'open';
  }

  async function erase() {
    if (!confirmed) return;
    setPhase('working');
    const result = await resetSrsProgress({ clearLocal, signedIn, clearServer });
    setOutcome(result);
    setTyped('');
    setPhase('idle');
    focusNext.current = 'result';
  }

  async function retry() {
    setRetrying(true);
    const server = await retryServerReset(clearServer);
    setRetrying(false);
    setOutcome({ local: 'cleared', server });
    focusNext.current = 'result';
  }

  return (
    <div
      style={{
        border: `2px solid ${tint(CORAL, 30)}`,
        borderRadius: '1rem',
        padding: '1rem',
        background: CARD,
      }}
    >
      <h2 style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 700, color: CORAL }}>
        Danger zone
      </h2>
      <p style={{ ...paragraph, color: MUTED }}>
        Erase every SRS (spaced repetition) review schedule{' '}
        {signedIn ? 'on this device and your account' : 'in this browser'} and start over. Your{' '}
        {joinPhrases(keeps)} are kept.
      </p>

      {outcome && <ResultMessage outcome={outcome} resultRef={resultRef} />}
      {outcome?.server === 'failed' && (
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          style={{ ...neutralButton, marginBottom: '0.75rem', opacity: retrying ? 0.6 : 1 }}
        >
          {retrying ? 'Trying again…' : 'Try erasing the account copy again'}
        </button>
      )}

      {phase === 'idle' ? (
        <button type="button" ref={openRef} onClick={open} style={outlineDanger}>
          Reset SRS progress…
        </button>
      ) : (
        // A fieldset is a group to assistive tech; the heading names it.
        <fieldset
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && phase === 'confirming') cancel();
          }}
          style={{
            border: 0,
            borderTop: `1px solid ${tint(CORAL, 25)}`,
            padding: '0.875rem 0 0',
            margin: '0.25rem 0 0',
            minWidth: 0,
          }}
        >
          <h3
            id={titleId}
            style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: TEXT }}
          >
            Erase all SRS progress?
          </h3>
          <p style={paragraph}>Every card starts over as new. The review schedules erased are:</p>
          <ul
            style={{
              ...paragraph,
              paddingLeft: '1.25rem',
              listStyle: 'disc',
              display: 'grid',
              gap: '0.25rem',
            }}
          >
            {erases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p style={paragraph}>
            <strong>Kept:</strong> your {joinPhrases(keeps)}.
          </p>
          <p style={paragraph}>
            {signedIn
              ? 'The copy saved to your account is erased too. Other devices you study on keep their own copy and will sync it back the next time they are used, so reset each of them as well.'
              : 'This affects this browser only. You are not signed in, so there is no account copy to erase.'}
          </p>
          <p style={{ ...paragraph, fontWeight: 700, color: CORAL }}>This cannot be undone.</p>

          <label
            htmlFor={inputId}
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: TEXT,
              marginBottom: '0.375rem',
            }}
          >
            Type {RESET_CONFIRM_WORD} to confirm
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void erase();
              }
            }}
            disabled={phase === 'working'}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={hintId}
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: `2px solid ${confirmed ? CORAL : tint(MUTED, 35)}`,
              background: CARD,
              color: TEXT,
              font: 'inherit',
              fontSize: '1rem',
              letterSpacing: '0.08em',
            }}
          />
          <p
            id={hintId}
            style={{
              ...paragraph,
              fontSize: '0.75rem',
              color: MUTED,
              margin: '0.375rem 0 0.875rem',
            }}
          >
            The erase button stays off until the word matches.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => void erase()}
              disabled={!confirmed || phase === 'working'}
              style={{
                ...baseButton,
                border: `2px solid ${CORAL}`,
                background: CORAL,
                color: '#FFFFFF',
                opacity: confirmed && phase !== 'working' ? 1 : 0.4,
                cursor: confirmed && phase !== 'working' ? 'pointer' : 'not-allowed',
              }}
            >
              {phase === 'working' ? 'Erasing…' : 'Erase SRS progress'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={phase === 'working'}
              style={neutralButton}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

function ResultMessage({
  outcome,
  resultRef,
}: {
  outcome: ResetOutcome;
  resultRef: RefObject<HTMLDivElement | null>;
}) {
  const box = (color: string): CSSProperties => ({
    ...paragraph,
    padding: '0.625rem 0.75rem',
    borderRadius: '0.5rem',
    border: `1px solid ${tint(color, 35)}`,
    background: tint(color, 8),
    outline: 'none',
  });

  if (outcome.local === 'failed') {
    return (
      <div ref={resultRef} tabIndex={-1} role="alert" style={box(CORAL)}>
        Nothing was erased. This browser would not let the site change its saved data — check that
        site data is not blocked, then try again.
      </div>
    );
  }

  return (
    <div ref={resultRef} tabIndex={-1}>
      <p role="status" style={box(JADE)}>
        {outcome.server === 'cleared'
          ? 'SRS progress erased, in this browser and on your account. Every card is new again.'
          : 'SRS progress erased in this browser. Every card is new again.'}
      </p>
      {outcome.server === 'failed' && (
        <p role="alert" style={box(CORAL)}>
          Your account's copy could not be erased, so the next sync would bring the old schedules
          back to this browser. Studying is not affected; try again when you are online.
        </p>
      )}
    </div>
  );
}
