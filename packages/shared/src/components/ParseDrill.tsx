// The pieces of a parsing drill both apps draw the same way (#82): the progress
// bar, a field's choices, a field's mark after checking, the verdict, the
// settings chips, the session-length picker and the results screen.
//
// greek.tools' `/parse` had these in Tailwind; hebrew.tools' `/parse` needed the
// same ones, so they moved here and both apps use them. What a form looks like
// (Greek or Hebrew type, direction, font) and which fields a form has stay in
// each app.
//
// Styled inline on fallback-bearing tokens, never Tailwind utilities, for the
// reasons at the top of GradeButtons.tsx: Tailwind does not scan this package,
// and a token one app never uses resolves to nothing there. Inline styles have
// no :hover or :focus, so a select keeps the browser's own focus ring.

import type { CSSProperties, ReactNode } from 'react';
import {
  type ParseFieldResults,
  type ParseProperty,
  percent,
  propertyAccuracy,
  SESSION_LENGTHS,
  type SessionLength,
  type SessionResults,
  scoreColor,
} from '../parse-drill';

const ACCENT = 'var(--color-accent, #F59E0B)';
const CARD = 'var(--color-bg-card, #FFFFFF)';
const TEXT = 'var(--color-text, #1F2937)';
const MUTED = 'var(--color-text-muted, #6B7280)';

/**
 * Right and wrong, in the shades the greek.tools feedback rows have always used,
 * plus a border: hebrew.tools' page background is the same green-50 as a right
 * row, which without one does not show at all.
 */
export const MARK_COLORS = {
  right: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', tick: '#16A34A' },
  wrong: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', given: '#EF4444', tick: '#DC2626' },
} as const;

const CAPTION: CSSProperties = {
  fontSize: '0.75rem',
  lineHeight: '1rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.025em',
  color: MUTED,
};

// ─── Progress ─────────────────────────────────────────────────────────────────

/** "4 / 10" beside a bar filled to the forms already answered. */
export function ParseProgress({ index, total }: { index: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div
        style={{
          flex: 1,
          height: '0.375rem',
          background: CARD,
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <div
          data-testid="parse-progress"
          style={{
            height: '100%',
            borderRadius: '9999px',
            width: `${total > 0 ? (index / total) * 100 : 0}%`,
            background: ACCENT,
            transition: 'width 300ms',
          }}
        />
      </div>
      <span style={{ fontSize: '0.875rem', color: MUTED, whiteSpace: 'nowrap' }}>
        {index + 1} / {total}
      </span>
    </div>
  );
}

// ─── A field's choices ────────────────────────────────────────────────────────

export interface ParseSelectProps<T extends string> {
  label: string;
  value: T | '';
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  /** Defaults to the label, lower-cased — what the label's `htmlFor` points at. */
  id?: string;
  /** For the caller's grid placement (`col-span-2`). Styled by the caller's CSS. */
  className?: string;
}

/** One field of the parse, answered by picking from its choices. */
export function ParseSelect<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  id = label.toLowerCase(),
  className,
}: ParseSelectProps<T>) {
  return (
    <div className={className}>
      <label htmlFor={id} style={{ ...CAPTION, display: 'block', marginBottom: '0.25rem' }}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          width: '100%',
          borderRadius: '0.5rem',
          border: `1px solid ${CARD}`,
          background: CARD,
          padding: '0.5rem 0.75rem',
          fontSize: '0.875rem',
          lineHeight: '1.25rem',
          color: TEXT,
          appearance: 'none',
        }}
      >
        <option value="">— select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels[opt]}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── After checking ───────────────────────────────────────────────────────────

export interface ParseFeedbackRowProps {
  property: string;
  correct: boolean;
  /** What the student chose, as a label; `—` for nothing. */
  given: ReactNode;
  /** The answer, as a label. Shown only on a miss. */
  expected: ReactNode;
}

/**
 * One field's mark. A right answer shows what was chosen; a miss strikes it
 * through and names the answer beside it, so every miss says what was right.
 */
export function ParseFeedbackRow({ property, correct, given, expected }: ParseFeedbackRowProps) {
  const tone = correct ? MARK_COLORS.right : MARK_COLORS.wrong;
  return (
    <div
      data-correct={correct}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        borderRadius: '0.5rem',
        padding: '0.625rem 1rem',
        fontSize: '0.875rem',
        background: tone.bg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <span style={{ fontWeight: 600, color: tone.text }}>{property}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'right' }}>
        {correct ? (
          <span style={{ color: MARK_COLORS.right.text, fontWeight: 500 }}>{given}</span>
        ) : (
          <>
            <span style={{ color: MARK_COLORS.wrong.given, textDecoration: 'line-through' }}>
              {given}
            </span>
            <span style={{ color: MARK_COLORS.wrong.text, fontWeight: 600 }}>{expected}</span>
          </>
        )}
        <span style={{ color: tone.tick }}>{correct ? '✓' : '✗'}</span>
      </div>
    </div>
  );
}

/** The verdict under the rows. */
export function ParseVerdict({ correct }: { correct: boolean }) {
  const tone = correct ? MARK_COLORS.right : MARK_COLORS.wrong;
  return (
    <div
      role="status"
      style={{
        borderRadius: '0.75rem',
        padding: '0.75rem 1.25rem',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '0.875rem',
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
      }}
    >
      {correct ? 'Correct!' : 'Not quite — review the corrections above.'}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const chipStyle = (active: boolean): CSSProperties => ({
  padding: '0.375rem 0.75rem',
  borderRadius: '9999px',
  fontSize: '0.875rem',
  fontWeight: 500,
  border: `2px solid ${active ? ACCENT : CARD}`,
  background: active ? ACCENT : CARD,
  color: active ? '#FFFFFF' : MUTED,
  cursor: 'pointer',
});

/** A choice that stays on until tapped again: which forms a session may ask. */
export function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} style={chipStyle(active)}>
      {label}
    </button>
  );
}

/** Forms per session: 10, 20 or 30. */
export function SessionLengthPicker({
  value,
  onChange,
}: {
  value: SessionLength;
  onChange: (length: SessionLength) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {SESSION_LENGTHS.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          style={{
            ...chipStyle(value === n),
            borderRadius: '0.5rem',
            padding: '0.5rem 1rem',
            fontWeight: 600,
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

const ACTION: CSSProperties = {
  flex: 1,
  padding: '0.75rem 0',
  borderRadius: '0.75rem',
  fontSize: '1rem',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
};

export interface ParseResultsProps {
  sessionResults: SessionResults;
  /** The fields to break the score down by, in the order a parse is given. */
  properties: readonly ParseProperty[];
  onRetry: () => void;
  onChangeSettings: () => void;
  /** The second button's text. A screen with no settings (greek.tools' /daily) names what it does instead. */
  changeSettingsLabel?: string;
  onReviewMissed?: () => void;
  isReview?: boolean;
}

/** The end of a session: the score, then how each field went. */
export function ParseResults({
  sessionResults,
  properties,
  onRetry,
  onChangeSettings,
  changeSettingsLabel = 'Change Settings',
  onReviewMissed,
  isReview = false,
}: ParseResultsProps) {
  const { results, total } = sessionResults;
  const correct = results.filter((r: ParseFieldResults) => r.allCorrect).length;
  const missed = total - correct;
  const pct = percent(correct, total);

  return (
    <div style={{ maxWidth: '32rem', margin: '0 auto', display: 'grid', gap: '2rem' }}>
      <div
        style={{
          textAlign: 'center',
          padding: '2rem 0',
          background: CARD,
          borderRadius: '1rem',
        }}
      >
        <p style={{ ...CAPTION, letterSpacing: '0.1em', fontWeight: 400, marginBottom: '0.5rem' }}>
          {isReview ? `Review: Missed Verbs (${total})` : 'Session Score'}
        </p>
        <p
          style={{
            fontSize: '3.75rem',
            lineHeight: 1,
            fontWeight: 800,
            marginBottom: '0.25rem',
            color: scoreColor(pct),
          }}
        >
          {correct}/{total}
        </p>
        <p style={{ fontSize: '1.125rem', color: MUTED }}>{pct}% correct</p>
      </div>

      <section>
        <h2
          style={{
            ...CAPTION,
            fontSize: '0.875rem',
            lineHeight: '1.25rem',
            marginBottom: '0.75rem',
          }}
        >
          Accuracy by Property
        </h2>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {propertyAccuracy(results, properties).map((p) => (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', width: '6rem', color: MUTED }}>{p.label}</span>
              <div
                style={{
                  flex: 1,
                  height: '0.5rem',
                  background: CARD,
                  borderRadius: '9999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: '9999px',
                    width: `${p.pct}%`,
                    background: scoreColor(p.pct),
                    transition: 'width 500ms',
                  }}
                />
              </div>
              <span
                style={{ fontSize: '0.875rem', fontWeight: 600, width: '4rem', textAlign: 'right' }}
              >
                {p.correct}/{p.asked}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onRetry}
          style={{ ...ACTION, background: ACCENT, color: '#FFFFFF' }}
        >
          Try Again
        </button>
        <button
          type="button"
          onClick={onChangeSettings}
          style={{ ...ACTION, background: CARD, color: TEXT }}
        >
          {changeSettingsLabel}
        </button>
      </div>
      {onReviewMissed && missed > 0 && (
        <button
          type="button"
          onClick={onReviewMissed}
          style={{
            ...ACTION,
            width: '100%',
            background: 'transparent',
            border: `2px solid ${MARK_COLORS.wrong.given}`,
            color: MARK_COLORS.wrong.tick,
          }}
        >
          Review Missed ({missed})
        </button>
      )}
    </div>
  );
}
