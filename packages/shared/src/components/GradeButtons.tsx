import { GRADE_QUALITY, nextSRS, type ReviewGrade, type SRSCard } from '../srs';

// The four-grade answer row, shared by both apps' flashcards.
//
// STYLED WITHOUT TAILWIND, DELIBERATELY. Neither app declares an `@source` for
// packages/shared, so Tailwind's content detection never scans this file and a
// utility class here emits no CSS. The existing shared components get away with
// utilities only because the same classes happen to appear inside an app; that
// is luck, not a contract, and a four-colour button row has no such luck to
// draw on. Everything visual is therefore inline, on the design tokens both
// apps define (see each app's global.css).

/**
 * Tokens shared by greek.tools and hebrew.tools, each with a literal fallback.
 *
 * `primary` is deliberately unused: it is green in hebrew-tools, where it would
 * collide with `jade`.
 *
 * EVERY TOKEN NEEDS ITS FALLBACK. Tailwind 4 tree-shakes theme variables that
 * no utility class references, so a token an app *declares* is not necessarily
 * a token an app *emits*: hebrew-tools defines `--color-grape` in global.css and
 * uses it nowhere, so it resolves to the empty string at runtime and the Easy
 * button rendered with no tint, no border and inherited text. The fallback is
 * what makes this component independent of which utilities an app happens to
 * use — the same reason it avoids Tailwind classes outright.
 */
const GRADE_COLOR: Record<ReviewGrade, string> = {
  again: 'var(--color-coral, #F43F5E)',
  hard: 'var(--color-accent, #F59E0B)',
  good: 'var(--color-jade, #059669)',
  easy: 'var(--color-grape, #7C3AED)',
};

const GRADE_LABEL: Record<ReviewGrade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

/** What each button means, for the tooltip and the screen reader. */
const GRADE_HINT: Record<ReviewGrade, string> = {
  again: 'Missed it — back to one day',
  hard: 'Recalled it, but with effort',
  good: 'Recalled it normally',
  easy: 'Effortless — schedule it further out',
};

const ORDER: ReviewGrade[] = ['again', 'hard', 'good', 'easy'];

/** One decimal, but only when it says something — "2.5" and "3", never "3.0". */
function trim(value: number): string {
  return value < 10 ? String(Number(value.toFixed(1))) : String(Math.round(value));
}

/**
 * "6d" / "2.9wk" / "3.3mo" — the interval a grade would buy, the way Anki
 * previews it on the buttons themselves. Days only: the scheduler has no
 * sub-day step (see `nextSRS`), so there is never a "10m" to show.
 *
 * The decimal is load-bearing rather than decoration. Rounded to whole months,
 * Good and Easy on a mature card both read "3mo" — 75 days against 98 — and a
 * preview that cannot tell two grades apart is worse than no preview, because
 * it actively suggests the choice does not matter.
 */
export function formatInterval(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 30) return `${trim(days / 7)}wk`;
  if (days < 365) return `${trim(days / 30)}mo`;
  return `${trim(days / 365)}y`;
}

export default function GradeButtons({
  card,
  onGrade,
  disabled = false,
}: {
  /** The card being answered. Absent for a card with no SRS history yet, in
   *  which case the buttons render without interval previews. */
  card?: SRSCard;
  onGrade: (grade: ReviewGrade) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '0.5rem',
      }}
    >
      {ORDER.map((grade, i) => {
        const color = GRADE_COLOR[grade];
        const preview = card ? formatInterval(nextSRS(card, GRADE_QUALITY[grade]).interval) : null;
        return (
          <button
            key={grade}
            type="button"
            disabled={disabled}
            onClick={() => onGrade(grade)}
            title={`${GRADE_HINT[grade]} (${i + 1})`}
            aria-keyshortcuts={String(i + 1)}
            aria-label={`${GRADE_LABEL[grade]} — ${GRADE_HINT[grade]}`}
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
            <span style={{ fontSize: '0.875rem', lineHeight: 1.2 }}>{GRADE_LABEL[grade]}</span>
            {preview && (
              <span
                style={{ fontSize: '0.6875rem', opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}
              >
                {preview}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
