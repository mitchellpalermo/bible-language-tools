import posthog from 'posthog-js';
import { useEffect, useRef, useState } from 'react';
import {
  fetchBook,
  fetchBooks,
  type HebrewBook,
  type HebrewBookMeta,
  loadReaderPrefs,
} from '../data/morphhb';
import {
  buildHebrewPDF,
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type ExportRange,
  exportFilename,
  extractVerses,
  formatPassageRef,
  lastVerse,
  normalizeRange,
} from '../lib/pdf-export';
import { DEFAULT_REF, parseRef } from '../lib/reader';
import ErrorBoundary from './ErrorBoundary';
import PrefToggle from './PrefToggle';

/**
 * `/export` (#227): choose a passage, download it as a PDF to translate on
 * paper or on an iPad with a Pencil.
 *
 * The page reads `?ref=GEN.3` after mount, as the reader does — this page is
 * prerendered and the server's HTML knows nothing of the query string. The
 * cantillation switch starts from the reader's own preference for the same
 * reason: what was on screen is what the student expects on the page.
 */

const WHOLE_CHAPTER = (book: string, chapter: number): ExportRange => ({
  book,
  startChapter: chapter,
  startVerse: 1,
  endChapter: chapter,
  endVerse: 1,
});

const selectClass =
  'w-full rounded-lg border border-bg-card bg-bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-text-muted mb-1';

function range(n: number, from = 1): number[] {
  return Array.from({ length: Math.max(0, n - from + 1) }, (_, i) => from + i);
}

function ExportInner() {
  const [books, setBooks] = useState<HebrewBookMeta[]>([]);
  const [value, setValue] = useState<ExportRange>({
    ...WHOLE_CHAPTER(DEFAULT_REF.book, DEFAULT_REF.chapter),
    endVerse: 3,
  });
  const [bookData, setBookData] = useState<{ code: string; data: HebrewBook } | null>(null);
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const wholeChapter = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read after mount: storage and the query string are not there to be read
  // when this page is prerendered.
  useEffect(() => {
    setOptions((o) => ({ ...o, cantillation: loadReaderPrefs().cantillation }));
    fetchBooks()
      .then(setBooks)
      .catch(() => {
        /* the book list is chrome; the passage still exports without names */
      });

    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!ref) return;
    const { book, chapter, verse } = parseRef(ref);
    wholeChapter.current = verse === undefined;
    setValue(
      verse === undefined
        ? WHOLE_CHAPTER(book, chapter)
        : { ...WHOLE_CHAPTER(book, chapter), startVerse: verse, endVerse: verse },
    );
  }, []);

  // Load the book the range names; a response for a book the student has since
  // left is never taken for the current one.
  useEffect(() => {
    let cancelled = false;
    fetchBook(value.book)
      .then((data) => {
        if (!cancelled) setBookData({ code: value.book, data });
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [value.book]);

  const data = bookData?.code === value.book ? bookData.data : null;

  // A book or a `?ref=GEN.3` selects a whole chapter, and the chapter's last
  // verse is only known once the book has loaded: fill it in then.
  useEffect(() => {
    if (!data || !wholeChapter.current) return;
    wholeChapter.current = false;
    setValue((v) => ({ ...v, endVerse: lastVerse(data, v.endChapter) }));
  }, [data]);

  const meta = books.find((b) => b.code === value.book);
  const chapterCount = meta?.chapters ?? Math.max(value.endChapter, 1);

  function change(patch: Partial<ExportRange>) {
    setValue((v) => normalizeRange({ ...v, ...patch }, data));
  }

  async function handleExport() {
    setGenerating(true);
    setError(null);
    try {
      const book = await fetchBook(value.book);
      const verses = extractVerses(book, value);
      if (verses.length === 0) {
        setError('No verses found in the selected range.');
        return;
      }
      const ref = formatPassageRef(meta?.name ?? value.book, value);
      const bytes = await buildHebrewPDF(verses, ref, options);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename(ref);
      a.click();
      URL.revokeObjectURL(url);

      posthog.capture('hebrew_translation_pdf_exported', {
        book: value.book,
        startChapter: value.startChapter,
        endChapter: value.endChapter,
        verseCount: verses.length,
        pointing: options.pointing,
        cantillation: options.pointing === 'pointed' && options.cantillation,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  // Before the book loads the lists still hold the current choice.
  const startMax = Math.max(lastVerse(data, value.startChapter), value.startVerse);
  const endMax = Math.max(lastVerse(data, value.endChapter), value.endVerse);
  const endMin = value.startChapter === value.endChapter ? value.startVerse : 1;
  const pointed = options.pointing === 'pointed';

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">Export for Translation Practice</h1>
        <p className="text-text-muted text-sm">
          Choose a passage and download a printable PDF: the Hebrew set right to left, with ruled
          lines under each line to write your translation on.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="export-book" className={labelClass}>
            Book
          </label>
          <select
            id="export-book"
            value={value.book}
            onChange={(e) => {
              wholeChapter.current = true;
              setValue(WHOLE_CHAPTER(e.target.value, 1));
            }}
            className={selectClass}
          >
            {(books.length === 0 ? [{ code: value.book, name: value.book }] : books).map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className={labelClass}>Start</legend>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-text-muted">
              Chapter
              <select
                value={value.startChapter}
                onChange={(e) => change({ startChapter: Number(e.target.value), startVerse: 1 })}
                aria-label="Start chapter"
                className={`${selectClass} mt-1`}
              >
                {range(chapterCount).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-xs text-text-muted">
              Verse
              <select
                value={value.startVerse}
                onChange={(e) => change({ startVerse: Number(e.target.value) })}
                aria-label="Start verse"
                className={`${selectClass} mt-1`}
              >
                {range(startMax).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className={labelClass}>End</legend>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-text-muted">
              Chapter
              <select
                value={value.endChapter}
                onChange={(e) => {
                  const endChapter = Number(e.target.value);
                  change({ endChapter, endVerse: lastVerse(data, endChapter) });
                }}
                aria-label="End chapter"
                className={`${selectClass} mt-1`}
              >
                {range(chapterCount, value.startChapter).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-xs text-text-muted">
              Verse
              <select
                value={value.endVerse}
                onChange={(e) => change({ endVerse: Number(e.target.value) })}
                aria-label="End verse"
                className={`${selectClass} mt-1`}
              >
                {range(endMax, endMin).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
      </div>

      <div>
        <p className={labelClass}>Marking</p>
        <div className="flex flex-wrap gap-2">
          <PrefToggle
            on={pointed}
            onChange={() =>
              setOptions((o) => ({ ...o, pointing: pointed ? 'consonants' : 'pointed' }))
            }
          >
            Vowel points
          </PrefToggle>
          {pointed && (
            <PrefToggle
              on={options.cantillation}
              onChange={() => setOptions((o) => ({ ...o, cantillation: !o.cantillation }))}
            >
              Cantillation
            </PrefToggle>
          )}
        </div>
        <p className="text-text-muted text-xs mt-2">
          {pointed
            ? 'Pointed text. Cantillation starts from the setting you use in the reader.'
            : 'Consonants only, with no vowel points or accents.'}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleExport}
        disabled={generating}
        className="w-full py-3 rounded-xl text-base font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {generating ? 'Generating PDF…' : 'Download PDF'}
      </button>
    </div>
  );
}

export default function TranslationPDFExport() {
  return (
    <ErrorBoundary component="TranslationPDFExport">
      <ExportInner />
    </ErrorBoundary>
  );
}
