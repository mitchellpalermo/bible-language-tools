// The verse on reveal (#267): one place in the deck's own text where the card's
// word occurs, with the word highlighted, a count ("1 of 38 in Galatians") and
// arrows to step through the rest. Shared by both apps; each draws the verse
// itself (`renderVerse`), since a Greek verse and a pointed Hebrew one with its
// morphemes and ketiv/qere are nothing alike.
//
// Rules from the issue, which are pedagogy rather than plumbing:
// - It is part of the answer. The app renders this only once the card is
//   revealed, never on the front.
// - Stepping changes only what is shown. Nothing here grades, schedules or
//   logs, and the app keys this component by card so the next card starts on
//   its first occurrence again.
// - Past `COMMON_WORD_THRESHOLD` occurrences the verse starts folded: a verse
//   with καί in it says nothing about καί. "Show a verse" opens it.
//
// STYLED INLINE ON FALLBACK-BEARING TOKENS, never Tailwind utilities, for the
// reasons at the top of GradeButtons.tsx. The accent is passed in.

import { type CSSProperties, type ReactNode, useState } from 'react';
import { type Occurrence, startsFolded } from '../deck-source';

export interface SourceVerseProps {
  /** Every occurrence of the card's word in the deck's source, in reading order. Renders nothing when empty. */
  occurrences: readonly Occurrence[];
  /** What the count is "in": the book, or the passage's reference for a passage deck. */
  sourceLabel: string;
  /** The card's word, for the folded line ("καί occurs 211 times in Galatians"). */
  headword: ReactNode;
  /** The verse, with the occurrence's word highlighted. */
  renderVerse: (occurrence: Occurrence) => ReactNode;
  /** "Galatians 2:16". */
  reference: (occurrence: Occurrence) => string;
  /** The reader at that verse. */
  readerHref: (occurrence: Occurrence) => string;
  /** The app's accent, token-with-fallback. */
  accent: string;
}

const MUTED = 'var(--color-text-muted, #6B7280)';
const TEXT = 'var(--color-text, #1F2937)';

export default function SourceVerse({
  occurrences,
  sourceLabel,
  headword,
  renderVerse,
  reference,
  readerHref,
  accent,
}: SourceVerseProps) {
  const count = occurrences.length;
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(() => !startsFolded(count));
  if (count === 0) return null;

  const frame: CSSProperties = {
    marginTop: 12,
    padding: '12px 16px',
    borderRadius: 12,
    border: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`,
    background: `color-mix(in srgb, ${accent} 4%, transparent)`,
    textAlign: 'left',
  };
  const button: CSSProperties = {
    padding: '4px 10px',
    borderRadius: 8,
    border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
    background: 'transparent',
    color: accent,
    font: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  };

  if (!open) {
    return (
      <div style={{ ...frame, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, color: MUTED }}>
          {headword} occurs {count} times in {sourceLabel}.
        </span>
        <button type="button" onClick={() => setOpen(true)} style={button}>
          Show a verse
        </button>
      </div>
    );
  }

  const occurrence = occurrences[Math.min(at, count - 1)];
  const disabled = (off: boolean): CSSProperties =>
    off ? { ...button, opacity: 0.35, cursor: 'default' } : button;

  return (
    <figure style={{ ...frame, margin: '12px 0 0' }} aria-label="In the text">
      <div style={{ color: TEXT }}>{renderVerse(occurrence)}</div>
      <figcaption
        style={{
          marginTop: 8,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          fontSize: 13,
          color: MUTED,
        }}
      >
        <a
          href={readerHref(occurrence)}
          style={{ color: accent, fontWeight: 600, textDecoration: 'none' }}
        >
          {reference(occurrence)}
        </a>
        {count === 1 ? (
          <span>1 of 1 in {sourceLabel}</span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              aria-label="Previous occurrence"
              disabled={at === 0}
              onClick={() => setAt((i) => Math.max(0, i - 1))}
              style={disabled(at === 0)}
            >
              &larr;
            </button>
            <span aria-live="polite">
              {at + 1} of {count} in {sourceLabel}
            </span>
            <button
              type="button"
              aria-label="Next occurrence"
              disabled={at >= count - 1}
              onClick={() => setAt((i) => Math.min(count - 1, i + 1))}
              style={disabled(at >= count - 1)}
            >
              &rarr;
            </button>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
