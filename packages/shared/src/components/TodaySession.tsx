// The two pieces of Today's Session that look the same in both apps: the time
// budget picker and the end-of-session summary (#184). Each app passes its own
// accent and its own section labels.
//
// Styled inline on fallback-bearing tokens, never Tailwind utilities, for the
// reasons at the top of GradeButtons.tsx.

import { TIME_BUDGETS, type TimeBudget } from '../today';

const TEXT = 'var(--color-text, #1F2937)';
const MUTED = 'var(--color-text-muted, #6B7280)';
const CARD = 'var(--color-bg-card, #FFFFFF)';
const CORAL = 'var(--color-coral, #F43F5E)';

export function BudgetPicker({
  value,
  onChange,
  accent,
  label = 'Time budget',
}: {
  value: TimeBudget;
  onChange: (budget: TimeBudget) => void;
  accent: string;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}
    >
      {TIME_BUDGETS.map((budget) => {
        const active = budget === value;
        return (
          // A radio, not a pressed button: exactly one budget is always chosen.
          // biome-ignore lint/a11y/useSemanticElements: a styled radio row, keyboard-operable
          <button
            key={budget}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(budget)}
            style={{
              padding: '0.75rem 0.5rem',
              borderRadius: '0.75rem',
              border: `2px solid ${active ? accent : `color-mix(in srgb, ${accent} 20%, transparent)`}`,
              background: active ? accent : CARD,
              color: active ? '#FFFFFF' : TEXT,
              fontWeight: 700,
              cursor: 'pointer',
              lineHeight: 1.2,
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>{budget}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.8 }}> min</span>
          </button>
        );
      })}
    </div>
  );
}

export interface SummaryRow {
  label: string;
  reviewed: number;
  missed: number;
}

export function SessionSummaryCard({
  rows,
  reviewed,
  missed,
  dueTomorrow,
  streak,
  accent,
  note,
}: {
  rows: readonly SummaryRow[];
  reviewed: number;
  missed: number;
  /** Everything scheduled for tomorrow, from every section's store. */
  dueTomorrow: number;
  streak: number;
  accent: string;
  /** A sentence under the totals: why the session ended, say. */
  note?: string;
}) {
  const stat = (value: number, label: string, color = TEXT) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: MUTED, fontWeight: 600 }}>{label}</div>
    </div>
  );

  return (
    <section
      aria-label="Session summary"
      style={{
        background: CARD,
        borderRadius: '1rem',
        border: `2px solid color-mix(in srgb, ${accent} 15%, transparent)`,
        padding: '1.25rem',
        display: 'grid',
        gap: '1rem',
      }}
    >
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}
      >
        {stat(reviewed, 'reviewed', accent)}
        {stat(missed, 'missed', missed > 0 ? CORAL : TEXT)}
        {stat(dueTomorrow, 'due tomorrow')}
      </div>

      {rows.length > 0 && (
        <table
          style={{ width: '100%', fontSize: '0.875rem', color: TEXT, borderCollapse: 'collapse' }}
        >
          <thead>
            <tr style={{ color: MUTED, fontSize: '0.75rem', textAlign: 'left' }}>
              <th style={{ fontWeight: 600, paddingBottom: '0.25rem' }}>Part</th>
              <th style={{ fontWeight: 600, textAlign: 'right' }}>Reviewed</th>
              <th style={{ fontWeight: 600, textAlign: 'right' }}>Missed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                style={{ borderTop: `1px solid color-mix(in srgb, ${accent} 10%, transparent)` }}
              >
                <td style={{ padding: '0.375rem 0' }}>{row.label}</td>
                <td style={{ textAlign: 'right' }}>{row.reviewed}</td>
                <td style={{ textAlign: 'right' }}>{row.missed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ margin: 0, fontSize: '0.875rem', color: MUTED, textAlign: 'center' }}>
        Study streak:{' '}
        <strong style={{ color: accent }}>
          {streak} day{streak === 1 ? '' : 's'}
        </strong>
        {note ? <> &middot; {note}</> : null}
      </p>
    </section>
  );
}
