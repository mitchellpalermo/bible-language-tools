// The answer row for the drill modes (Study All, Endless): Missed / Got it.
//
// Drill reviews never write the SRS schedule, so the four SM-2 grades and their
// interval previews have nothing to say there. What a drill *can* do with an
// answer is decide whether the card comes back this round. That is a yes/no
// question, so the row has two buttons, and a miss re-queues the card a few
// cards later (`requeueMissed` in `../flashcard-session`).
//
// Styled inline on fallback-bearing tokens, never Tailwind utilities, for the
// same reasons spelled out at the top of GradeButtons.tsx.

export type DrillResult = 'missed' | 'got-it';

/** Each button's colour token, with its literal fallback. Exported for its test. */
export const DRILL_COLORS: Record<DrillResult, string> = {
  missed: 'var(--color-coral, #F43F5E)',
  'got-it': 'var(--color-jade, #059669)',
};

const LABEL: Record<DrillResult, string> = {
  missed: 'Missed',
  'got-it': 'Got it',
};

/** What each button does, for the tooltip and the screen reader. */
const HINT: Record<DrillResult, string> = {
  missed: 'Comes back a few cards later',
  'got-it': 'Done for this round',
};

/** Missed first, matching Again's place at the left of the SRS grade row. */
export const DRILL_RESULTS: readonly DrillResult[] = ['missed', 'got-it'];

export default function DrillButtons({
  onAnswer,
  disabled = false,
}: {
  onAnswer: (result: DrillResult) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '0.5rem',
      }}
    >
      {DRILL_RESULTS.map((result, i) => {
        const color = DRILL_COLORS[result];
        return (
          <button
            key={result}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(result)}
            title={`${HINT[result]} (${i + 1})`}
            aria-keyshortcuts={String(i + 1)}
            aria-label={`${LABEL[result]} — ${HINT[result]}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.125rem',
              padding: '0.75rem 0.5rem',
              borderRadius: '0.75rem',
              border: `2px solid color-mix(in srgb, ${color} 30%, transparent)`,
              background: `color-mix(in srgb, ${color} 10%, transparent)`,
              color,
              fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'background-color 150ms',
            }}
          >
            <span style={{ fontSize: '0.875rem', lineHeight: 1.2 }}>{LABEL[result]}</span>
            <span style={{ fontSize: '0.6875rem', opacity: 0.75 }}>{HINT[result]}</span>
          </button>
        );
      })}
    </div>
  );
}
