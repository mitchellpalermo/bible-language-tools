// The workload guard's panel (#190, #203): today's review estimate, the
// suggestion to pause or resume new cards, the one-tap toggle, and the limit.
// Both apps draw it on /flashcards and on Today's Session.
//
// Styled inline on fallback-bearing tokens, never Tailwind utilities, for the
// reasons at the top of GradeButtons.tsx. The accent is passed in.

import { useId, useMemo } from 'react';
import type { SRSStore } from '../use-flashcard-session';
import { useHydrated } from '../use-stored-state';
import type { Workload } from '../use-workload';
import { countDue, estimateWorkload, LIMIT_CHOICES, workloadAdvice } from '../workload';

const TEXT = 'var(--color-text, #1F2937)';
const MUTED = 'var(--color-text-muted, #6B7280)';
const CARD = 'var(--color-bg-card, #FFFFFF)';

export interface WorkloadGuardProps {
  /** `useWorkload`'s result. */
  workload: Pick<
    Workload,
    'pauseNew' | 'limitMinutes' | 'pace' | 'setPauseNew' | 'setLimitMinutes'
  >;
  /**
   * The whole SRS store, not the open deck: every due card is owed today,
   * whichever deck it is studied through. Pass the store the page holds, so
   * the estimate comes down as cards are reviewed.
   */
  srsStore: SRSStore;
  /** Which store keys are flashcards. Defaults to all of them. */
  countsCard?: (key: string) => boolean;
  accent: string;
}

/** "about 14 minutes", "about 1 minute", "under a minute". */
export function describeMinutes(seconds: number): string {
  if (seconds < 60) return 'under a minute';
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function WorkloadGuard({ workload, srsStore, countsCard, accent }: WorkloadGuardProps) {
  const { pauseNew, limitMinutes, pace, setPauseNew, setLimitMinutes } = workload;
  const limitId = useId();
  const due = useMemo(() => countDue(srsStore, countsCard), [srsStore, countsCard]);
  const estimate = estimateWorkload(due, pace, limitMinutes);
  const hydrated = useHydrated();
  // Everything here comes from storage, so nothing is drawn until hydration
  // is over: the server cannot know the student's pile.
  if (!hydrated) return null;

  const advice = workloadAdvice(estimate, pauseNew);
  const { seconds } = estimate;
  // The limit list always holds the stored value, even one no longer offered.
  const limits = (LIMIT_CHOICES as readonly number[]).includes(limitMinutes)
    ? LIMIT_CHOICES
    : [...LIMIT_CHOICES, limitMinutes].sort((a, b) => a - b);
  const urgent = advice !== null;

  return (
    <section
      aria-label="Review workload"
      data-testid="workload-guard"
      style={{
        border: `2px solid color-mix(in srgb, ${accent} ${urgent ? 45 : 15}%, transparent)`,
        background: CARD,
        borderRadius: '1rem',
        padding: '0.75rem 1rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem 1rem',
        fontSize: '0.875rem',
        color: TEXT,
      }}
    >
      <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
        <p style={{ margin: 0 }}>
          {due === 0 ? (
            'No reviews due today.'
          ) : (
            <>
              Today’s reviews: <strong>{describeMinutes(seconds)}</strong> ({due}{' '}
              {due === 1 ? 'card' : 'cards'}).
            </>
          )}
        </p>
        {/* Polite, not role="status": the flashcard's own mark is the page's status. */}
        <p
          aria-live="polite"
          data-testid="workload-advice"
          style={{ margin: '0.25rem 0 0', color: MUTED }}
        >
          {advice === 'pause' &&
            `That is past your ${limitMinutes}-minute limit. Pausing new cards lets it come down without skipping a review.`}
          {advice === 'resume' &&
            `New cards are paused, and today’s reviews are back under your ${limitMinutes}-minute limit.`}
          {advice === null && pauseNew && 'New cards are paused until you resume them.'}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <label
          htmlFor={limitId}
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: MUTED }}
        >
          Limit
          <select
            id={limitId}
            value={limitMinutes}
            onChange={(e) => setLimitMinutes(Number(e.target.value))}
            style={{
              padding: '0.25rem 0.375rem',
              borderRadius: '0.5rem',
              border: '1px solid #D1D5DB',
              background: CARD,
              color: TEXT,
              fontSize: '0.875rem',
            }}
          >
            {limits.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={pauseNew}
          onClick={() => setPauseNew(!pauseNew)}
          style={{
            padding: '0.5rem 0.875rem',
            borderRadius: '0.5rem',
            border: `2px solid ${accent}`,
            background: urgent ? accent : CARD,
            color: urgent ? '#FFFFFF' : accent,
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          {pauseNew ? 'Resume new cards' : 'Pause new cards'}
        </button>
      </div>
    </section>
  );
}
