import PassagePicker from '@tools/shared/components/PassagePicker';
import {
  formatPassageRef,
  type PassageRange,
  rangeError,
  verseCounts,
  versesInRange,
} from '@tools/shared/focus-passages';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchBook,
  fetchBooks,
  fetchLemmas,
  type HebrewBook,
  type HebrewBookMeta,
  type LemmaIndex,
} from '../data/morphhb';
import { focusPassageStore, passageVocabulary } from '../lib/focus-passages';

/** Genesis 1:1–5: a short passage that is the same in every Bible and has plenty of words in it. */
export const DEFAULT_RANGE: PassageRange = {
  book: 'GEN',
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 5,
};

const MAX_LABEL = 100;

/**
 * Pick a passage, see what is in it, name it if you like, and save it. The
 * numbers are the passage's real ones, from the corpus, so a student can tell a
 * stretch they will read in a sitting from one they will not.
 */
export default function FocusPassageNew({ onCancel }: { onCancel: () => void }) {
  const [books, setBooks] = useState<HebrewBookMeta[]>([]);
  const [range, setRange] = useState<PassageRange>(DEFAULT_RANGE);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Kept with the book it was loaded for, so a slow response for the book the
  // student has already left cannot size the verse menus of the one they chose.
  const [loaded, setLoaded] = useState<{ code: string; data: HebrewBook } | null>(null);
  const [lemmas, setLemmas] = useState<LemmaIndex | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetchBooks()
      .then(setBooks)
      .catch(() => setLoadFailed(true));
    fetchLemmas()
      .then(setLemmas)
      .catch(() => {}); // The preview still counts words without it.
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBook(range.book)
      .then((data) => {
        if (!cancelled) setLoaded({ code: range.book, data });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [range.book]);

  const book = loaded?.code === range.book ? loaded.data : null;
  const counts = useMemo(() => (book ? verseCounts(book) : null), [book]);
  const bookName = books.find((b) => b.code === range.book)?.name ?? range.book;
  const problem = rangeError(range);

  const preview = useMemo(() => {
    if (!book || problem) return null;
    return passageVocabulary(versesInRange(book, range), lemmas);
  }, [book, range, lemmas, problem]);

  function save() {
    try {
      const passage = focusPassageStore.create(range, label);
      window.location.href = `/focus/${passage.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This passage could not be saved.');
    }
  }

  return (
    <section
      aria-labelledby="new-passage-heading"
      className="max-w-xl bg-bg-card rounded-2xl shadow-sm border border-white p-5 space-y-5"
    >
      <h2
        id="new-passage-heading"
        className="text-lg font-bold"
        style={{ color: 'var(--color-primary)' }}
      >
        New focus passage
      </h2>

      {loadFailed && (
        <p role="alert" className="text-sm text-red-700">
          The Hebrew text did not load, so the passage cannot be previewed. Check your connection
          and try again.
        </p>
      )}

      <PassagePicker books={books} value={range} onChange={setRange} verseCounts={counts} />

      <p className="text-sm text-text-muted" aria-live="polite" data-testid="passage-preview">
        {problem ??
          (preview
            ? `${formatPassageRef(bookName, range)}: ${preview.runningWords} words, ${preview.words.length} of them in the course vocabulary.`
            : 'Loading the text…')}
      </p>

      <div>
        <label htmlFor="passage-name" className="block text-xs font-semibold text-text-muted mb-1">
          Name (optional)
        </label>
        <input
          id="passage-name"
          type="text"
          value={label}
          maxLength={MAX_LABEL}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && preview) save();
          }}
          placeholder={formatPassageRef(bookName, range)}
          className="w-full rounded-lg border border-gray-400 bg-bg-card px-3 py-2 text-base text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!preview}
          className="flex-1 min-h-11 px-4 py-2 rounded-xl font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-primary)' }}
        >
          Save passage
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 px-4 py-2 rounded-xl font-semibold border border-gray-400 text-text hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
