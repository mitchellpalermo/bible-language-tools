// The visible half of `../ladder`: the rungs, in order, with locked ones shown.
//
// Styled inline on fallback-bearing tokens, never Tailwind utilities — Tailwind
// does not scan this package, and a bare token can resolve to nothing in the app
// that never uses it (see "Adding to shared" in the repo CLAUDE.md). The accent
// is a prop for the same reason as ToggleSwitch's: each app's primary differs.

import type { ReactNode } from 'react';
import { CLEAN_WRITES_TO_UNLOCK, lockText, type RungState } from '../ladder';

const MUTED = 'var(--color-text-muted, #6B7280)';
const TEXT = 'var(--color-text, #1E1B4B)';
const CARD = 'var(--color-bg-card, #FFFFFF)';
const PASS = 'var(--color-jade, #059669)';

export interface LadderRung {
  id: string;
  title: ReactNode;
  /** A line under the title: what this rung adds. */
  detail?: ReactNode;
  /** A line at the foot of the card, e.g. what is due. */
  meta?: ReactNode;
}

/** What an open rung says about its own clean writes. Exported for its test. */
export function writesText(state: RungState, isLast: boolean): string {
  const n = state.cleanWrites;
  const writes = `${n} clean ${n === 1 ? 'write' : 'writes'}`;
  if (isLast) return writes;
  if (n >= CLEAN_WRITES_TO_UNLOCK) return `${writes} · next rung open`;
  return `${n} of ${CLEAN_WRITES_TO_UNLOCK} clean writes to open the next rung`;
}

/**
 * The ladder, top to bottom in the order it is climbed. An open rung is a
 * button that selects it. A locked rung is not: it says what opens it, and has
 * its own "Open anyway" button, so overriding the lock is a deliberate act and
 * not a stray tap on a card.
 */
export function LadderRungList({
  rungs,
  states,
  selectedId,
  onSelect,
  accent,
}: {
  rungs: readonly LadderRung[];
  /** One per rung, in the same order — `rungStates()`. */
  states: readonly RungState[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  accent: string;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: MUTED }}>
        Each rung opens after {CLEAN_WRITES_TO_UNLOCK} clean writes of the one before: a Full table
        with every form exactly right and no peeking. You can open a locked rung anyway.
      </p>
      <ol
        aria-label="Ladder rungs"
        style={{ display: 'grid', gap: '0.625rem', listStyle: 'none', margin: 0, padding: 0 }}
      >
        {rungs.map((rung, i) => {
          const state = states[i];
          const selected = rung.id === selectedId;
          const locked = !state.unlocked;
          const border = selected
            ? accent
            : `color-mix(in srgb, ${locked ? MUTED : accent} 20%, transparent)`;
          const body = (
            <>
              <span
                aria-hidden="true"
                style={{
                  flex: 'none',
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: locked ? MUTED : '#FFFFFF',
                  background: locked ? 'transparent' : accent,
                  border: locked ? `1.5px dashed ${MUTED}` : 'none',
                }}
              >
                {state.number}
              </span>
              <span style={{ display: 'block', minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9375rem' }}>
                  {rung.title}
                </span>
                {rung.detail && (
                  <span
                    style={{ display: 'block', fontSize: '0.8125rem', color: MUTED, marginTop: 2 }}
                  >
                    {rung.detail}
                  </span>
                )}
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    marginTop: '0.375rem',
                    color: !locked && state.cleanWrites >= CLEAN_WRITES_TO_UNLOCK ? PASS : MUTED,
                  }}
                >
                  {locked ? lockText(state) : writesText(state, i === rungs.length - 1)}
                </span>
                {rung.meta && (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: MUTED }}>
                    {rung.meta}
                  </span>
                )}
              </span>
            </>
          );
          const card = {
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            width: '100%',
            textAlign: 'left' as const,
            padding: '0.875rem 1rem',
            borderRadius: '0.75rem',
            border: `2px solid ${border}`,
            background: selected ? `color-mix(in srgb, ${accent} 8%, ${CARD})` : CARD,
            color: TEXT,
            font: 'inherit',
          };
          return (
            <li
              key={rung.id}
              data-locked={locked || undefined}
              aria-label={`Rung ${state.number}${locked ? ', locked' : ''}`}
            >
              {locked ? (
                <div style={{ ...card, opacity: selected ? 1 : 0.85, flexWrap: 'wrap' }}>
                  {body}
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(selected ? null : rung.id)}
                    style={{
                      alignSelf: 'center',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: `1.5px solid ${accent}`,
                      background: selected ? accent : 'transparent',
                      color: selected ? '#FFFFFF' : accent,
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {selected ? 'Opened' : 'Open anyway'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? null : rung.id)}
                  style={{ ...card, cursor: 'pointer' }}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
