import { useEffect, useState } from 'react';
import { type BookMeta, fetchBooks } from '../data/morphgnt';
import type { GNTPassageSettings } from '../lib/gnt-parse';

interface Props {
  settings: GNTPassageSettings;
  verbCount: number | null; // null while unknown
  verseCount: number | null; // total verses in selected chapter, null while loading
  onChange: (s: GNTPassageSettings) => void;
  onStart: () => void;
  loading: boolean;
}

const SESSION_LENGTHS = [10, 20, 30, 'all'] as const;
const SESSION_LABELS: Record<string, string> = {
  10: '10',
  20: '20',
  30: '30',
  all: 'All',
};

export default function PassageSelector({
  settings,
  verbCount,
  verseCount,
  onChange,
  onStart,
  loading,
}: Props) {
  const [books, setBooks] = useState<BookMeta[]>([]);

  useEffect(() => {
    fetchBooks().then(setBooks).catch(console.error);
  }, []);

  const currentBook = books.find((b) => b.code === settings.book);
  const chapterCount = currentBook?.chapters ?? 1;

  function handleBookChange(code: string) {
    onChange({ ...settings, book: code, chapter: 1, verseStart: 1, verseEnd: Infinity });
  }

  function handleChapterChange(ch: number) {
    onChange({ ...settings, chapter: ch, verseStart: 1, verseEnd: Infinity });
  }

  function handleVerseStartChange(v: number) {
    const newEnd = settings.verseEnd < v ? v : settings.verseEnd;
    onChange({ ...settings, verseStart: v, verseEnd: newEnd });
  }

  function handleVerseEndChange(v: number) {
    const effectiveTotal = verseCount ?? 1;
    onChange({ ...settings, verseEnd: v >= effectiveTotal ? Infinity : v });
  }

  const effectiveVerseEnd =
    !isFinite(settings.verseEnd) || (verseCount !== null && settings.verseEnd >= verseCount)
      ? (verseCount ?? 1)
      : settings.verseEnd;

  const canStart = !loading && verbCount !== null && verbCount > 0;

  return (
    <div className="max-w-lg mx-auto space-y-8">
      {/* ── Passage ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
          Passage
        </h2>
        <div className="flex gap-3">
          {/* Book */}
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">
              Book
            </label>
            <select
              value={settings.book}
              onChange={(e) => handleBookChange(e.target.value)}
              className="w-full rounded-lg border border-bg-card bg-bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] appearance-none"
            >
              {books.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter */}
          <div className="w-28">
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">
              Chapter
            </label>
            <select
              value={settings.chapter}
              onChange={(e) => handleChapterChange(Number(e.target.value))}
              className="w-full rounded-lg border border-bg-card bg-bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] appearance-none"
            >
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Verse range */}
        <div className="flex items-end gap-2 mt-3">
          <div className="w-24">
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">
              Verse
            </label>
            <select
              value={settings.verseStart}
              disabled={loading || verseCount === null}
              onChange={(e) => handleVerseStartChange(Number(e.target.value))}
              className="w-full rounded-lg border border-bg-card bg-bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] appearance-none disabled:opacity-50"
            >
              {Array.from({ length: verseCount ?? 1 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <span className="pb-2 text-sm text-text-muted">to</span>
          <div className="w-24">
            <select
              value={effectiveVerseEnd}
              disabled={loading || verseCount === null}
              onChange={(e) => handleVerseEndChange(Number(e.target.value))}
              className="w-full rounded-lg border border-bg-card bg-bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] appearance-none disabled:opacity-50"
            >
              {Array.from({ length: verseCount ?? 1 }, (_, i) => i + 1)
                .filter((n) => n >= settings.verseStart)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Skip repeated lemmas toggle */}
        <label className="mt-3 flex items-center gap-2 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={settings.skipRepeatedLemmas}
            onChange={(e) => onChange({ ...settings, skipRepeatedLemmas: e.target.checked })}
            className="w-4 h-4 rounded accent-[var(--color-accent)]"
          />
          <span className="text-sm text-text">Skip repeat verbs</span>
        </label>

        {/* Verb count feedback */}
        <p className="mt-2 text-xs text-text-muted h-4">
          {loading && 'Loading…'}
          {!loading && verbCount === null && ''}
          {!loading && verbCount === 0 && 'No verbs found in this passage.'}
          {!loading &&
            verbCount !== null &&
            verbCount > 0 &&
            `${verbCount} verb form${verbCount !== 1 ? 's' : ''} in this passage`}
        </p>
      </section>

      {/* ── Session length ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
          Forms per session
        </h2>
        <div className="flex gap-2">
          {SESSION_LENGTHS.map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...settings, sessionLength: n })}
              disabled={n !== 'all' && verbCount !== null && verbCount < Number(n)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                settings.sessionLength === n
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-bg-card bg-bg-card text-text-muted hover:border-[var(--color-accent)]',
              ].join(' ')}
            >
              {SESSION_LABELS[n]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          "All" parses every verb in the chapter in order.
        </p>
      </section>

      {/* ── Start ────────────────────────────────────────────────────────── */}
      <button
        onClick={onStart}
        disabled={!canStart}
        className={[
          'w-full py-3 rounded-xl text-base font-bold transition-colors',
          canStart
            ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
            : 'bg-bg-card text-text-muted cursor-not-allowed',
        ].join(' ')}
      >
        {loading ? 'Loading…' : 'Start Parsing'}
      </button>
    </div>
  );
}
