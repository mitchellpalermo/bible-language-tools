// The chapter picker for a textbook deck. Shared by both apps (#109, #228).
//
// A row of chips does not survive a 30-chapter textbook: it would put 30
// targets in the deck bar, and the filters and study mode would be pushed off
// the first screen on a phone.
//
// So the picker collapses. Closed, it is one button stating the current
// selection ("Ch. 1–8 · 94 words"), which is the only thing a returning student
// needs to read. Open, it is a numbered grid, dense enough to see the whole
// book at once and tappable per chapter, plus the three moves that come up in
// practice: study everything, study up to where the course is now, or drill
// just the chapter being learned.
//
// An empty selection means "all chapters", not "no chapters". A student who has
// never touched the picker should get the whole book, and there is no state in
// which the deck is silently empty because nothing is ticked.
//
// STYLED INLINE ON FALLBACK-BEARING TOKENS, never Tailwind utilities, for the
// reasons at the top of GradeButtons.tsx: neither app scans packages/shared, so
// a utility class here emits no CSS. The accent is a required prop because
// each app has its own.

import { type CSSProperties, useId, useMemo, useState } from 'react';
import { describeChapters, type Textbook } from '../textbooks';

export interface ChapterPickerProps {
  textbook: Textbook;
  /** The book's chapters, ascending, with how many words each holds. */
  chapters: readonly { chapter: number; total: number }[];
  /** Selected chapter numbers. Empty means every chapter. */
  selected: readonly number[];
  onChange: (chapters: number[]) => void;
  /** Words the current selection yields, after any other filter the app applies. */
  wordCount: number;
  /** The app's accent, token-with-fallback: `var(--color-primary, #15803D)`. */
  accent: string;
}

const TEXT = 'var(--color-text, #1F2937)';
const MUTED = 'var(--color-text-muted, #6B7280)';
const CARD = 'var(--color-bg-card, #FFFFFF)';

/** The accent at a tenth strength: the resting border, as on the page's other chips. */
export function faint(accent: string, percent = 10): string {
  return `color-mix(in srgb, ${accent} ${percent}%, transparent)`;
}

/** A chip's colours. Exported because happy-dom drops `var()` from a rendered style. */
export function chipColors(active: boolean, accent: string) {
  return active
    ? { background: accent, color: '#fff', borderColor: accent }
    : { background: 'transparent', color: MUTED, borderColor: faint(accent) };
}

const label: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: MUTED,
};

export default function ChapterPicker({
  textbook,
  chapters,
  selected,
  onChange,
  wordCount,
  accent,
}: ChapterPickerProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const summary = describeChapters(textbook.unitLabel, selected);

  // The chapter the range shortcuts act on: the furthest one selected, which is
  // the one a student just extended their selection to.
  const pivot = selected.length > 0 ? Math.max(...selected) : null;

  const toggle = (chapter: number) => {
    const next = new Set(selectedSet);
    if (next.has(chapter)) next.delete(chapter);
    else next.add(chapter);
    onChange([...next].sort((a, b) => a - b));
  };

  const shortcut: CSSProperties = {
    padding: '6px 12px',
    borderRadius: 9999,
    border: `2px solid ${faint(accent)}`,
    background: 'transparent',
    color: MUTED,
    font: 'inherit',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        borderRadius: 16,
        border: `2px solid ${faint(accent)}`,
        background: CARD,
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          font: 'inherit',
          cursor: 'pointer',
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={label}>{textbook.shortTitle}</span>
          <span
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: TEXT,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {summary}{' '}
            <span style={{ color: MUTED, fontWeight: 400 }}>
              &middot; {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: accent,
            transition: 'transform 150ms',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        >
          &#9662;
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          style={{
            padding: '12px 16px 16px',
            borderTop: `2px solid ${faint(accent, 5)}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* As many columns as fit a finger: six on a phone, more on a tablet. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(2.75rem, 1fr))',
              gap: 6,
            }}
          >
            {chapters.map(({ chapter, total }) => {
              const active = selectedSet.has(chapter);
              return (
                <button
                  type="button"
                  key={chapter}
                  onClick={() => toggle(chapter)}
                  aria-pressed={active}
                  aria-label={`${textbook.unitLabel} ${chapter} — ${total} words`}
                  title={`${total} words`}
                  style={{
                    padding: '8px 0',
                    minHeight: 40,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderStyle: 'solid',
                    font: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    ...chipColors(active, accent),
                  }}
                >
                  {chapter}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" onClick={() => onChange([])} style={shortcut}>
              All chapters
            </button>
            {pivot !== null && (
              <>
                <button
                  type="button"
                  onClick={() => onChange(chapters.map((c) => c.chapter).filter((c) => c <= pivot))}
                  style={shortcut}
                >
                  Through {textbook.unitLabel} {pivot}
                </button>
                <button type="button" onClick={() => onChange([pivot])} style={shortcut}>
                  Only {textbook.unitLabel} {pivot}
                </button>
              </>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
            {textbook.title} &middot; {textbook.authors}
          </p>
        </div>
      )}
    </div>
  );
}
