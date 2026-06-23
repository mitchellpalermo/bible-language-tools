import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { type BookMeta, fetchBook, fetchBooks } from '../data/morphgnt';
import { formatPassageRef } from '../lib/passage-deck';
import { buildTranslationPDF, extractVerses } from '../lib/pdf-export';
import type { CrossChapterRange } from './CrossChapterSelector';
import CrossChapterSelector, { DEFAULT_CROSS_CHAPTER_RANGE } from './CrossChapterSelector';
import ErrorBoundary from './ErrorBoundary';

function parseUrlRef(): { book: string; chapter: number } | null {
  if (typeof window === 'undefined') return null;
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (!ref) return null;
  const parts = ref.split('.');
  const book = parts[0];
  const chapter = parseInt(parts[1] ?? '1', 10) || 1;
  return book ? { book, chapter } : null;
}

function slugify(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function TranslationPDFExportInner() {
  const [range, setRange] = useState<CrossChapterRange>(DEFAULT_CROSS_CHAPTER_RANGE);
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBooks()
      .then(setBooks)
      .catch(() => {});

    const urlRef = parseUrlRef();
    if (!urlRef) return;

    const { book, chapter } = urlRef;

    // Pre-populate the selector; then load the book to discover the last verse of that chapter
    setRange((r) => ({
      ...r,
      book,
      startChapter: chapter,
      startVerse: 1,
      endChapter: chapter,
      endVerse: 1,
    }));

    fetchBook(book)
      .then((bookData) => {
        const chapterData = bookData[String(chapter)];
        if (!chapterData) return;
        const lastVerse = Math.max(...Object.keys(chapterData).map(Number));
        setRange((r) => ({
          ...r,
          book,
          startChapter: chapter,
          startVerse: 1,
          endChapter: chapter,
          endVerse: lastVerse,
        }));
      })
      .catch(() => {});
  }, []);

  async function handleExport() {
    setGenerating(true);
    setError(null);

    try {
      const bookMeta = books.find((b) => b.code === range.book);
      const bookName = bookMeta?.name ?? range.book;
      const bookData = await fetchBook(range.book);
      const verses = extractVerses(bookData, range);

      if (verses.length === 0) {
        setError('No verses found in the selected range.');
        return;
      }

      const passageRef = formatPassageRef(
        bookName,
        range.startChapter,
        range.startVerse,
        range.endChapter,
        range.endVerse,
      );

      const bytes = await buildTranslationPDF(verses, passageRef);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(passageRef)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      posthog.capture('translation_pdf_exported', {
        book: range.book,
        startChapter: range.startChapter,
        endChapter: range.endChapter,
        verseCount: verses.length,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const btnClass =
    'w-full py-3 rounded-xl text-base font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50';

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">Export for Translation Practice</h1>
        <p className="text-text-muted text-sm">
          Select a passage and download a printable PDF with space to write your translation and
          parsing notes.
        </p>
      </div>

      <CrossChapterSelector value={range} onChange={setRange} />

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="button" onClick={handleExport} disabled={generating} className={btnClass}>
        {generating ? 'Generating PDF…' : 'Download PDF'}
      </button>
    </div>
  );
}

export default function TranslationPDFExport() {
  return (
    <ErrorBoundary component="TranslationPDFExport">
      <TranslationPDFExportInner />
    </ErrorBoundary>
  );
}
