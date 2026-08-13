import posthog from 'posthog-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchBook,
  fetchBooks,
  type HebrewBook,
  type HebrewBookMeta,
  type HebrewWord,
  readingText,
  saveLastPassage,
  type TanakhSection,
} from '../data/morphhb';
import { accentUnits, DEFAULT_REF, formatRef, hebrewNumeral, parseRef } from '../lib/reader';
import ErrorBoundary from './ErrorBoundary';

/**
 * The Hebrew Bible reader (issue #119).
 *
 * Reading only. Tapping a word does nothing yet — the popup is #120, the
 * cantillation toggle and studied-word highlighting are #121.
 *
 * Three things here are Hebrew rather than plumbing:
 *
 * - **Every word renders through `readingText`.** The stored text keeps OSHB's
 *   `/` morpheme boundaries, which are real information and must not reach the
 *   screen, and a ketiv carries its qere alongside it.
 * - **A maqqef is not a hyphen.** It binds words into one accentual unit, so
 *   `accentUnits` groups them and each group renders in one non-breaking span.
 * - **The Hebrew runs right to left and the chrome does not.** Verse numbers
 *   are isolated so a number cannot reorder against the words around it.
 */

const SECTION_LABELS: Record<TanakhSection, string> = {
  torah: 'Torah',
  neviim: "Nevi'im",
  ketuvim: 'Ketuvim',
};

const SECTION_ORDER: TanakhSection[] = ['torah', 'neviim', 'ketuvim'];

// ─── URL ──────────────────────────────────────────────────────────────────────

function urlRef(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('ref');
}

function writeUrlRef(book: string, chapter: number): void {
  const url = new URL(window.location.href);
  url.searchParams.set('ref', formatRef({ book, chapter }));
  history.replaceState(null, '', url.toString());
}

// ─── Verse ────────────────────────────────────────────────────────────────────

function Word({ word }: { word: HebrewWord }) {
  const qere = word.qere !== undefined || word.qereOnly === true;
  return (
    <>
      <span
        className={qere ? 'underline decoration-dotted decoration-accent/50 underline-offset-4' : ''}
        title={qere ? 'Qere — read, where it differs from what is written' : undefined}
      >
        {readingText(word)}
      </span>
      {word.after && <span className="text-text-muted">{word.after}</span>}
    </>
  );
}

function Verse({ number, words }: { number: number; words: HebrewWord[] }) {
  const units = useMemo(() => accentUnits(words), [words]);

  return (
    <span id={`verse-${number}`}>
      <sup
        dir="ltr"
        className="text-text-muted text-xs font-normal select-none align-super"
        // Isolated so the number cannot reorder against the Hebrew beside it —
        // a bare LTR run inside an RTL paragraph is resolved by its neighbours.
        style={{ unicodeBidi: 'isolate', marginInlineEnd: '0.15em' }}
      >
        {number}
      </sup>
      {units.map((unit, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: units are positional
        <span key={i}>
          {/* The unit is one word to the ear, so it is one word to the line
              breaker. The space that follows it is where a break may fall. */}
          <span style={{ whiteSpace: 'nowrap' }}>
            {unit.map((word, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: words are positional
              <Word key={j} word={word} />
            ))}
          </span>{' '}
        </span>
      ))}
    </span>
  );
}

// ─── Reader ───────────────────────────────────────────────────────────────────

function HebrewReaderInner() {
  const [books, setBooks] = useState<HebrewBookMeta[]>([]);
  const [book, setBook] = useState(DEFAULT_REF.book);
  const [chapter, setChapter] = useState(DEFAULT_REF.chapter);
  const [bookData, setBookData] = useState<HebrewBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** The verse the reader was opened at, if the URL named one. */
  const anchor = useRef<number | undefined>(undefined);

  // The URL is read after mount rather than during render. This page is
  // prerendered, so its server-rendered HTML knows nothing of `?ref=`, and
  // seeding state from the query string would hydrate a different passage than
  // the markup on screen.
  useEffect(() => {
    const ref = parseRef(urlRef());
    anchor.current = ref.verse;
    setBook(ref.book);
    setChapter(ref.chapter);

    fetchBooks()
      .then(setBooks)
      .catch(() => {
        /* the index is chrome; the text below still loads without it */
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBookData(null);

    fetchBook(book)
      .then((data) => {
        if (cancelled) return;
        setBookData(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [book]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    writeUrlRef(book, chapter);
    saveLastPassage(formatRef({ book, chapter }));
    posthog.capture('hebrew_reader_passage_opened', { book, chapter });
  }, [book, chapter]);

  // Only ever runs once: the anchor comes from the URL the reader was opened
  // with, and every navigation after that starts at the top of a chapter.
  const scrolled = useRef(false);
  useEffect(() => {
    if (!bookData || scrolled.current) return;
    scrolled.current = true;
    if (anchor.current === undefined) return;
    document
      .getElementById(`verse-${anchor.current}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [bookData]);

  const current = books.find((b) => b.code === book);
  const chapterCount = current?.chapters ?? 0;
  const verses = bookData?.[String(chapter)] ?? {};
  const verseNumbers = Object.keys(verses)
    .map(Number)
    .sort((a, b) => a - b);

  const sections = SECTION_ORDER.map((section) => ({
    section,
    books: books.filter((b) => b.section === section),
  })).filter((group) => group.books.length > 0);

  const goToChapter = (next: number) => {
    setChapter(Math.max(1, chapterCount ? Math.min(chapterCount, next) : next));
    window.scrollTo({ top: 0 });
  };

  return (
    <div>
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
        <select
          value={book}
          onChange={(e) => {
            setBook(e.target.value);
            setChapter(1);
          }}
          aria-label="Book"
          className="px-3 py-2 border-2 border-primary/10 rounded-xl text-sm font-semibold bg-bg-card text-text focus:border-primary focus:outline-none"
        >
          {sections.length === 0 ? (
            <option value={book}>{book}</option>
          ) : (
            sections.map(({ section, books: group }) => (
              <optgroup key={section} label={SECTION_LABELS[section]}>
                {group.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
            ))
          )}
        </select>

        <select
          value={chapter}
          onChange={(e) => goToChapter(Number(e.target.value))}
          aria-label="Chapter"
          className="px-3 py-2 border-2 border-primary/10 rounded-xl text-sm font-semibold bg-bg-card text-text focus:border-primary focus:outline-none"
        >
          {chapterCount === 0 ? (
            <option value={chapter}>Chapter {chapter}</option>
          ) : (
            Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Chapter {n}
              </option>
            ))
          )}
        </select>

        <div className="flex gap-1 ms-auto">
          <button
            type="button"
            onClick={() => goToChapter(chapter - 1)}
            disabled={chapter <= 1}
            aria-label="Previous chapter"
            className="px-3 py-2 border-2 border-primary/10 rounded-xl text-sm hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => goToChapter(chapter + 1)}
            disabled={chapterCount > 0 && chapter >= chapterCount}
            aria-label="Next chapter"
            className="px-3 py-2 border-2 border-primary/10 rounded-xl text-sm hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {/* ── Heading ───────────────────────────────────────────────────────── */}
      {current && (
        <div className="flex items-baseline justify-between gap-3 mb-4 pb-3 border-b-2 border-primary/5">
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider select-none">
            {current.name} {chapter}
          </h2>
          <p
            dir="rtl"
            className="text-lg select-none"
            style={{ fontFamily: 'var(--font-hebrew)', color: 'var(--color-hebrew)' }}
          >
            {current.hebrew} {hebrewNumeral(chapter)}
          </p>
        </div>
      )}

      {/* ── Text ──────────────────────────────────────────────────────────── */}
      {loading && <p className="text-text-muted text-center py-16">Loading…</p>}

      {error && (
        <div className="text-center py-16 space-y-3">
          <p className="text-red-600 text-sm">
            Could not load {book}: {error}
          </p>
          <p className="text-text-muted text-xs">
            Run <code className="bg-primary/5 px-1 rounded">pnpm build:data</code> to generate the
            text files.
          </p>
        </div>
      )}

      {!loading && !error && verseNumbers.length === 0 && (
        <p className="text-text-muted text-center py-16">
          {current ? `${current.name} has no chapter ${chapter}.` : 'No text for this passage.'}
        </p>
      )}

      {!loading && !error && verseNumbers.length > 0 && (
        <div
          dir="rtl"
          lang="he"
          data-testid="reader-text"
          className="max-w-2xl"
          style={{
            fontFamily: 'var(--font-hebrew)',
            color: 'var(--color-hebrew)',
            fontSize: '1.5rem',
            lineHeight: 2.1,
            wordSpacing: '0.12em',
          }}
        >
          {verseNumbers.map((n) => (
            <Verse key={n} number={n} words={verses[String(n)] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HebrewReader() {
  return (
    <ErrorBoundary component="HebrewReader">
      <HebrewReaderInner />
    </ErrorBoundary>
  );
}
