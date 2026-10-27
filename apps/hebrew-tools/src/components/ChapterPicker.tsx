import { useId, useMemo, useState } from 'react';
import {
  type ChapterStat,
  describeChapters,
  type Textbook,
  type TextbookId,
} from '../data/textbooks';

// A row of chips does not survive a 30-chapter textbook: Garrett & DeRouchie
// alone would put 30 targets in the deck bar, and the frequency filter and study
// mode would be pushed off the first screen on a phone.
//
// So the picker collapses. Closed, it is one button stating the current
// selection ("Ch. 1–8 · 94 words"), which is the only thing a returning student
// needs to read. Open, it is a numbered grid — dense enough to see the whole
// book at once, and tappable per chapter — plus the three moves that actually
// come up in practice: study everything, study up to where the course is now,
// or drill just the chapter being learned.
//
// An empty selection means "all chapters", not "no chapters". A student who has
// never touched the picker should get the whole book, and there is no state in
// which the deck is silently empty because nothing is ticked.

export interface ChapterPickerProps {
  textbook: Textbook;
  chapters: ChapterStat[];
  /** Selected chapter numbers. Empty means every chapter. */
  selected: number[];
  onChange: (chapters: number[]) => void;
  /** Words the current selection yields, after category filtering. */
  wordCount: number;
}

export default function ChapterPicker({
  textbook,
  chapters,
  selected,
  onChange,
  wordCount,
}: ChapterPickerProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const summary = describeChapters(textbook.id as TextbookId, selected);

  // The chapter the range shortcuts act on: the furthest one selected, which is
  // the one a student just extended their selection to.
  const pivot = selected.length > 0 ? Math.max(...selected) : null;

  const toggle = (chapter: number) => {
    const next = new Set(selectedSet);
    if (next.has(chapter)) next.delete(chapter);
    else next.add(chapter);
    onChange([...next].sort((a, b) => a - b));
  };

  return (
    <div className="rounded-2xl border-2 border-primary/10 bg-bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold text-text-muted uppercase tracking-wider">
            {textbook.shortTitle}
          </span>
          <span className="block text-sm font-semibold text-text truncate">
            {summary}{' '}
            <span className="text-text-muted font-normal">
              &middot; {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-primary transition-transform ${open ? 'rotate-180' : ''}`}
        >
          &#9662;
        </span>
      </button>

      {open && (
        <div id={panelId} className="px-4 pb-4 space-y-3 border-t-2 border-primary/5 pt-3">
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
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
                  className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'border-primary/10 text-text-muted hover:border-primary/40 hover:text-text'
                  }`}
                >
                  {chapter}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="px-3 py-1.5 rounded-full text-sm border-2 border-primary/10 text-text-muted hover:border-primary/40 hover:text-text transition-colors font-medium"
            >
              All chapters
            </button>
            {pivot !== null && (
              <>
                <button
                  type="button"
                  onClick={() => onChange(chapters.map((c) => c.chapter).filter((c) => c <= pivot))}
                  className="px-3 py-1.5 rounded-full text-sm border-2 border-primary/10 text-text-muted hover:border-primary/40 hover:text-text transition-colors font-medium"
                >
                  Through {textbook.unitLabel} {pivot}
                </button>
                <button
                  type="button"
                  onClick={() => onChange([pivot])}
                  className="px-3 py-1.5 rounded-full text-sm border-2 border-primary/10 text-text-muted hover:border-primary/40 hover:text-text transition-colors font-medium"
                >
                  Only {textbook.unitLabel} {pivot}
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-text-muted">
            {textbook.title} &middot; {textbook.authors}
          </p>
        </div>
      )}
    </div>
  );
}
