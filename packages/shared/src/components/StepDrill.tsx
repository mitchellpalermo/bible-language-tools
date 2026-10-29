// The visible half of `../step-drill`: the row of steps and the rule feedback.
//
// Styled inline on fallback-bearing tokens, never Tailwind utilities — Tailwind
// does not scan this package, and a bare token can resolve to nothing in the app
// that never uses it (see "Adding to shared" in the repo CLAUDE.md).

import type { ReactNode } from 'react';

const ACCENT = 'var(--color-grape, #7C3AED)';
const MISS = 'var(--color-coral, #F43F5E)';
const PASS = 'var(--color-jade, #059669)';
const MUTED = 'var(--color-text-muted, #6B7280)';
const TEXT = 'var(--color-text, #1E1B4B)';

export type StepStatus = 'done' | 'missed' | 'open' | 'locked' | 'skipped';

/** What a step shows as, from the drill state. Exported for its test. */
export function stepStatus(
  index: number,
  current: number,
  firstTry: boolean[],
  startAt: number,
): StepStatus {
  if (index < startAt) return 'skipped';
  if (index === current) return 'open';
  if (index > current) return 'locked';
  return firstTry[index - startAt] ? 'done' : 'missed';
}

/** Each status's colour token, with its literal fallback. Exported for its test. */
export const STATUS_COLOR: Record<StepStatus, string> = {
  done: PASS,
  missed: MISS,
  open: ACCENT,
  locked: MUTED,
  skipped: MUTED,
};

const STATUS_WORD: Record<StepStatus, string> = {
  done: 'done',
  missed: 'done after a miss',
  open: 'current step',
  locked: 'locked until the step before is right',
  skipped: 'skipped',
};

/** The numbered step row. Locked steps stay visible so the route is known. */
export function StepList({
  labels,
  current,
  firstTry,
  startAt = 0,
}: {
  labels: readonly string[];
  current: number;
  firstTry: boolean[];
  startAt?: number;
}) {
  return (
    <ol
      aria-label="Steps"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', listStyle: 'none', padding: 0 }}
    >
      {labels.map((label, i) => {
        const status = stepStatus(i, current, firstTry, startAt);
        const color = STATUS_COLOR[status];
        return (
          <li
            key={label}
            aria-current={status === 'open' ? 'step' : undefined}
            aria-label={`Step ${i + 1}, ${label}: ${STATUS_WORD[status]}`}
            data-status={status}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.625rem',
              borderRadius: '999px',
              border: `1.5px solid color-mix(in srgb, ${color} 40%, transparent)`,
              background:
                status === 'open' ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
              color,
              fontSize: '0.8125rem',
              fontWeight: status === 'open' ? 700 : 500,
              opacity: status === 'locked' || status === 'skipped' ? 0.6 : 1,
              textDecoration: status === 'skipped' ? 'line-through' : undefined,
            }}
          >
            <span aria-hidden="true">
              {status === 'done' ? '✓' : status === 'missed' ? '✗' : i + 1}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export interface FeedbackRule {
  id: string;
  /** A short name for the rule, the thing the student should remember. */
  name: string;
  /** The rule itself, in a sentence or two. May hold app markup (e.g. Hebrew runs). */
  text: ReactNode;
  /** Where the rule is taught. */
  href?: string;
}

/**
 * Why an answer was wrong, by rule. Never just "incorrect": each line names the
 * rule broken and links to where it is taught.
 */
export function RuleFeedback({
  rules,
  heading = 'Not quite',
  tone = 'miss',
  linkLabel = 'Review this rule',
}: {
  rules: FeedbackRule[];
  heading?: string;
  tone?: 'miss' | 'pass';
  linkLabel?: string;
}) {
  if (rules.length === 0) return null;
  const color = tone === 'miss' ? MISS : PASS;
  return (
    <section
      role="status"
      aria-label={heading}
      style={{
        borderLeft: `4px solid ${color}`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        color: TEXT,
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, color }}>{heading}</p>
      <ul style={{ margin: '0.5rem 0 0', padding: 0, listStyle: 'none' }}>
        {rules.map((rule) => (
          <li key={rule.id} style={{ marginTop: '0.375rem', fontSize: '0.875rem' }}>
            <strong>{rule.name}.</strong> {rule.text}
            {rule.href && (
              <>
                {' '}
                <a href={rule.href} style={{ color: ACCENT, fontWeight: 600 }}>
                  {linkLabel}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
