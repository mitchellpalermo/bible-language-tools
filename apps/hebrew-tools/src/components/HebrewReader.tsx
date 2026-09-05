import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_READER_PREFS,
  fetchBook,
  fetchBooks,
  type HebrewBook,
  type HebrewBookMeta,
  type HebrewWord,
  loadReaderPrefs,
  type ReaderPrefs,
  saveLastPassage,
  saveReaderPrefs,
  type TanakhSection,
} from '../data/morphhb';
import { accentUnits, DEFAULT_REF, formatRef, hebrewNumeral, parseRef } from '../lib/reader';
import { lemmaBase, loadStudiedLemmas } from '../lib/studied';
import ErrorBoundary from './ErrorBoundary';
import { type ActiveWord, WordPopup, WordToken } from './HebrewText';

/**
 * The Hebrew Bible reader (issues #119, #120, #121).
 *
 * Passage navigation, the text, and the two aids that make it usable by a
 * beginner. The word itself and its popup live in `HebrewText.tsx`, so Daily
 * Verse (#76) shares one implementation rather than growing a second.
 *
 * Four things here are Hebrew rather than plumbing:
 *
 * - **Every word renders through `readingText`.** The stored text keeps OSHB's
 *   `/` morpheme boundaries, which are real information and must not reach the
 *   screen, and a ketiv carries its qere alongside it.
 * - **A maqqef is not a hyphen.** It binds words into one accentual unit, so
 *   `accentUnits` groups them and each group renders in one non-breaking span.
 * - **The Hebrew runs right to left and the chrome does not.** Verse numbers
 *   are isolated so a number cannot reorder against the words around it.
 * - **Cantillation comes off for display only**, through the app's one set of
 *   Unicode ranges in `hebrew-input.ts`. Nikud stays — stripping vowels is a
 *   different feature for a much later student.
 *
 * The legend explains a mark only when the chapter on screen carries one, which
 * is why it is derived from the verses rather than from the whole SRS store.
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

interface VerseProps {
  number: number;
  words: HebrewWord[];
  prefs: ReaderPrefs;
  studied: Set<string>;
  active: HebrewWord | null;
  onActivate: (word: HebrewWord, rect: DOMRect) => void;
}

function Verse({ number, words, prefs, studied, active, onActivate }: VerseProps) {
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
              <WordToken
                // biome-ignore lint/suspicious/noArrayIndexKey: words are positional
                key={j}
                word={word}
                cantillation={prefs.cantillation}
                studied={prefs.studied && studied.has(lemmaBase(word.lemma))}
                active={word === active}
                onActivate={onActivate}
              />
            ))}
          </span>{' '}
        </span>
      ))}
    </span>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toggle({
  on,
  onChange,
  children,
}: {
  on: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
        on
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-primary/10 text-text-muted hover:border-primary/40'
      }`}
    >
      {children}
    </button>
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
  const [active, setActive] = useState<ActiveWord | null>(null);

  // Both read once, on mount rather than during render: this page is
  // prerendered, and localStorage is not there to be read when the markup is
  // built. Study progress is a snapshot for the session — a reader is not a
  // study session, and re-reading the store per word would be a read per word.
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [studied, setStudied] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setPrefs(loadReaderPrefs());
    setStudied(loadStudiedLemmas());
  }, []);

  const setPref = useCallback((key: keyof ReaderPrefs) => {
    setPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      saveReaderPrefs(next);
      posthog.capture('hebrew_reader_pref_toggled', { pref: key, on: next[key] });
      return next;
    });
  }, []);

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
    setActive(null);
    window.scrollTo({ top: 0 });
  };

  // A word carries a `qere` only where the reading differs from the writing, so
  // the legend explains each mark only if the chapter on screen actually bears
  // it — a chapter with no qere and no studied word gets no legend at all.
  const marks = useMemo(() => {
    const words = verseNumbers.flatMap((n) => verses[String(n)] ?? []);
    return {
      qere: words.some((w) => w.qere !== undefined || w.qereOnly === true),
      studied: prefs.studied && words.some((w) => studied.has(lemmaBase(w.lemma))),
    };
  }, [verses, verseNumbers, prefs.studied, studied]);

  const activate = useCallback((word: HebrewWord, rect: DOMRect) => {
    // A second tap on the same word closes it, so a word is its own dismissal.
    setActive((prev) => (prev?.word === word ? null : { word, rect }));
  }, []);

  const close = useCallback(() => setActive(null), []);

  return (
    // Anywhere else on the page dismisses the popup.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it; see WordPopup
    <div onClick={close}>
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

        <Toggle on={prefs.cantillation} onChange={() => setPref('cantillation')}>
          Cantillation
        </Toggle>
        <Toggle on={prefs.studied} onChange={() => setPref('studied')}>
          Studied words
        </Toggle>

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
            <Verse
              key={n}
              number={n}
              words={verses[String(n)] ?? []}
              prefs={prefs}
              studied={studied}
              active={active?.word ?? null}
              onActivate={activate}
            />
          ))}
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      {(marks.studied || marks.qere) && (
        <div className="text-text-muted text-xs mt-6 space-y-1 select-none">
          {marks.studied && (
            <p>
              <span className="underline decoration-dotted decoration-primary/70 underline-offset-4">
                dotted underline
              </span>{' '}
              — a word you have studied in Flashcards
            </p>
          )}
          {marks.qere && (
            <p>
              <span className="underline decoration-dashed decoration-accent/50 underline-offset-4">
                dashed underline
              </span>{' '}
              — a qere: what is read, where it differs from what is written
            </p>
          )}
        </div>
      )}

      {/* ── Word popup ────────────────────────────────────────────────────── */}
      {active && <WordPopup active={active} cantillation={prefs.cantillation} onClose={close} />}
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
