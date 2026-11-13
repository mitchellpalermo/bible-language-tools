import ChapterPicker from '@tools/shared/components/ChapterPicker';
import {
  chapterStats,
  TEXTBOOK_IDS,
  TEXTBOOKS,
  type TextbookId,
  wordsInChapters,
} from '../data/textbooks';

// The textbook row on /flashcards (#228): one chip per textbook, and under the
// active one the chapter picker. Which books there are comes from
// `TEXTBOOK_IDS`; nothing here names one.
//
// A chip is a toggle, like the My Decks chips beside it: tapping the active
// textbook goes back to the whole vocabulary.

// Derived from static data, so computed once rather than on every render.
const CHAPTER_STATS = Object.fromEntries(
  TEXTBOOK_IDS.map((id) => [id, chapterStats(id)]),
) as Record<TextbookId, ReturnType<typeof chapterStats>>;

const BOOK_SIZE = Object.fromEntries(
  TEXTBOOK_IDS.map((id) => [id, wordsInChapters(id, [], ['vocabulary']).length]),
) as Record<TextbookId, number>;

export interface TextbookDecksProps {
  /** The textbook being studied, or null. */
  active: TextbookId | null;
  /** Selected chapters of the active textbook. Empty means every chapter. */
  chapters: readonly number[];
  onTextbookChange: (textbook: TextbookId | null) => void;
  onChaptersChange: (chapters: number[]) => void;
  /** Words the session draws from: the chapters, after the part-of-speech filter. */
  wordCount: number;
}

export default function TextbookDecks({
  active,
  chapters,
  onTextbookChange,
  onChaptersChange,
  wordCount,
}: TextbookDecksProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider shrink-0">
          Textbook
        </span>
        {TEXTBOOK_IDS.map((id) => {
          const on = active === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => onTextbookChange(on ? null : id)}
              aria-pressed={on}
              title={`${TEXTBOOKS[id].title} · ${TEXTBOOKS[id].authors}`}
              className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
                on
                  ? 'bg-grape text-white border-grape'
                  : 'border-indigo-100 text-text-muted hover:border-grape/40 hover:text-text'
              }`}
            >
              {TEXTBOOKS[id].shortTitle}
              <span className={`ml-1 text-xs ${on ? 'text-white/70' : 'text-text-muted'}`}>
                ({BOOK_SIZE[id]})
              </span>
            </button>
          );
        })}
      </div>

      {active !== null && (
        <ChapterPicker
          textbook={TEXTBOOKS[active]}
          chapters={CHAPTER_STATS[active]}
          selected={chapters}
          onChange={onChaptersChange}
          wordCount={wordCount}
          accent="var(--color-grape, #7C3AED)"
        />
      )}
    </>
  );
}
