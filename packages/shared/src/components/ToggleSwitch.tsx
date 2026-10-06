// An on/off switch with a label, shared by both apps.
//
// STYLED WITHOUT TAILWIND, DELIBERATELY — same reasoning as GradeButtons.
// Neither app declares an `@source` for packages/shared, so Tailwind never
// scans this file and a utility class here emits no CSS. Everything visual is
// inline, and every token carries a literal fallback, because a token an app
// *declares* is not necessarily a token an app *emits*.
//
// The accent is a required prop rather than a defaulted one: `--color-primary`
// is cobalt in greek-tools and forest green in hebrew-tools, so there is no
// default that is right for both, and a wrong-but-plausible default is the kind
// of thing that ships.

// Track geometry. The knob's travel is whatever is left over, so the three
// constants cannot drift apart.
const TRACK_W = 34;
const TRACK_H = 20;
const KNOB = 16;
const PAD = (TRACK_H - KNOB) / 2;
const TRAVEL = TRACK_W - KNOB - PAD * 2;

/**
 * The off-state track is a literal grey rather than a token.
 *
 * It is the absence of the accent, not a colour either app has an opinion
 * about, and `--color-text-muted` is a text colour — borrowing it here would
 * make the track as dark as the label beside it.
 */
const TRACK_OFF = '#D1D5DB';

/**
 * The track colour, exported so it can be tested directly.
 *
 * happy-dom's CSS parser discards a `var()` from any colour property, so the
 * accent is unobservable through the rendered DOM — asserting on it there would
 * be asserting on the renderer. The one thing worth pinning about this
 * component's colour (that an app's accent reaches the track at all, rather than
 * silently resolving to nothing) is therefore pinned here instead.
 */
export function trackColor(checked: boolean, accent: string): string {
  return checked ? accent : TRACK_OFF;
}

/** How far the knob slides. Exported for the same reason. */
export const KNOB_TRAVEL = TRAVEL;

export default function ToggleSwitch({
  checked,
  onChange,
  label,
  accent,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  /** The app's accent, token-with-fallback: `var(--color-grape, #7C3AED)`. */
  accent: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.25rem 0.125rem',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '0.875rem',
        fontWeight: 600,
        lineHeight: 1.25,
        color: checked ? 'var(--color-text, #1F2937)' : 'var(--color-text-muted, #6B7280)',
        transition: 'color 160ms ease',
      }}
    >
      {label}
      {/* The track is decoration: the button already carries the role, the
          state and the accessible name, so nothing here is exposed again. */}
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          flexShrink: 0,
          width: `${TRACK_W}px`,
          height: `${TRACK_H}px`,
          borderRadius: `${TRACK_H / 2}px`,
          backgroundColor: trackColor(checked, accent),
          transition: 'background-color 160ms ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: `${PAD}px`,
            left: `${PAD}px`,
            width: `${KNOB}px`,
            height: `${KNOB}px`,
            borderRadius: '50%',
            backgroundColor: '#fff',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
            transform: checked ? `translateX(${TRAVEL}px)` : 'translateX(0)',
            transition: 'transform 160ms ease',
          }}
        />
      </span>
    </button>
  );
}
