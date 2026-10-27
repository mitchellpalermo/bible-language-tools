import { useEffect, useState } from 'react';
import { type BookMeta, fetchBook, fetchBooks, type MorphBook } from '../data/morphgnt';
import { GNT_BOOKS } from '../lib/passage-deck';

export interface CrossChapterRange {
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

interface Props {
  value: CrossChapterRange;
  onChange: (range: CrossChapterRange) => void;
}

const DEFAULT_BOOK = 'REV';

export const DEFAULT_CROSS_CHAPTER_RANGE: CrossChapterRange = {
  book: DEFAULT_BOOK,
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 11,
};

export default function CrossChapterSelector({ value, onChange }: Props) {
  const [books, setBooks] = useState<BookMeta[]>([]);
  // Kept with the code it was loaded for, so a response that arrives after the
  // book has moved on can never be mistaken for the current book's data.
  const [loaded, setLoaded] = useState<{ code: string; data: MorphBook } | null>(null);

  useEffect(() => {
    fetchBooks().then(setBooks).catch(console.error);
  }, []);

  // A fetch for the previous book can still be in flight when the book changes
  // — the export page switches off the default book as soon as it reads `?ref=`.
  // Without this guard the slower response wins and the verse dropdowns end up
  // sized from the wrong book.
  useEffect(() => {
    let cancelled = false;

    fetchBook(value.book)
      .then((data) => {
        if (!cancelled) setLoaded({ code: value.book, data });
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [value.book]);

  const currentBook = books.find((b) => b.code === value.book);
  const chapterCount = currentBook?.chapters ?? 1;
  const bookData = loaded?.code === value.book ? loaded.data : null;

  function verseCount(chapter: number): number {
    if (!bookData) return 1;
    const ch = bookData[String(chapter)];
    return ch ? Object.keys(ch).length : 1;
  }

  function handleBookChange(code: string) {
    onChange({ book: code, startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 1 });
  }

  function handleStartChapterChange(ch: number) {
    const newEndCh = ch > value.endChapter ? ch : value.endChapter;
    const newEndVs =
      ch > value.endChapter
        ? verseCount(ch)
        : newEndCh === ch && value.endVerse < 1
          ? 1
          : value.endVerse;
    onChange({
      ...value,
      startChapter: ch,
      startVerse: 1,
      endChapter: newEndCh,
      endVerse: newEndVs,
    });
  }

  function handleStartVerseChange(vs: number) {
    const isSameChapter = value.startChapter === value.endChapter;
    const newEndVs = isSameChapter && value.endVerse < vs ? vs : value.endVerse;
    onChange({ ...value, startVerse: vs, endVerse: newEndVs });
  }

  function handleEndChapterChange(ch: number) {
    const newEndVs = verseCount(ch);
    onChange({ ...value, endChapter: ch, endVerse: newEndVs });
  }

  function handleEndVerseChange(vs: number) {
    onChange({ ...value, endVerse: vs });
  }

  const startVerseMax = verseCount(value.startChapter);
  const endVerseMax = verseCount(value.endChapter);
  const endVerseMin = value.startChapter === value.endChapter ? value.startVerse : 1;

  const selectClass =
    'w-full rounded-lg border border-bg-card bg-bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] appearance-none';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-text-muted mb-1';

  return (
    <div className="space-y-4">
      {/* Book */}
      <div>
        <label htmlFor="book" className={labelClass}>
          Book
        </label>
        <select
          id="book"
          value={value.book}
          onChange={(e) => handleBookChange(e.target.value)}
          className={selectClass}
        >
          {books.length === 0
            ? GNT_BOOKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))
            : books.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
        </select>
      </div>

      {/* Start */}
      <div>
        <p className={labelClass}>Start</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="start-chapter" className="block text-xs text-text-muted mb-1">
              Chapter
            </label>
            <select
              id="start-chapter"
              value={value.startChapter}
              onChange={(e) => handleStartChapterChange(Number(e.target.value))}
              className={selectClass}
            >
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="start-verse" className="block text-xs text-text-muted mb-1">
              Verse
            </label>
            <select
              id="start-verse"
              value={value.startVerse}
              onChange={(e) => handleStartVerseChange(Number(e.target.value))}
              className={selectClass}
            >
              {Array.from({ length: startVerseMax }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* End */}
      <div>
        <p className={labelClass}>End</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="end-chapter" className="block text-xs text-text-muted mb-1">
              Chapter
            </label>
            <select
              id="end-chapter"
              value={value.endChapter}
              onChange={(e) => handleEndChapterChange(Number(e.target.value))}
              className={selectClass}
            >
              {Array.from({ length: chapterCount }, (_, i) => i + 1)
                .filter((n) => n >= value.startChapter)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="end-verse" className="block text-xs text-text-muted mb-1">
              Verse
            </label>
            <select
              id="end-verse"
              value={value.endVerse}
              onChange={(e) => handleEndVerseChange(Number(e.target.value))}
              className={selectClass}
            >
              {Array.from({ length: endVerseMax }, (_, i) => i + 1)
                .filter((n) => n >= endVerseMin)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
