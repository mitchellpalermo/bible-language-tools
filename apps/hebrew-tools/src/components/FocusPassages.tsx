import { type FocusPassage, formatPassageRef, passageTitle } from '@tools/shared/focus-passages';
import { useStoredState } from '@tools/shared/use-stored-state';
import { useEffect, useState } from 'react';
import { fetchBooks, type HebrewBookMeta } from '../data/morphhb';
import { focusPassageStore } from '../lib/focus-passages';
import ErrorBoundary from './ErrorBoundary';
import FocusPassageNew from './FocusPassageNew';

const EMPTY: FocusPassage[] = [];

function PassageCard({ passage, bookName }: { passage: FocusPassage; bookName: string }) {
  const ref = formatPassageRef(bookName, passage);
  return (
    <a
      href={`/focus/${passage.id}`}
      className="block bg-bg-card rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-white overflow-hidden"
    >
      <div className="h-1.5 w-full" style={{ background: 'var(--color-primary)' }} />
      <div className="p-5">
        <p className="text-base font-bold text-text">{passageTitle(passage, bookName)}</p>
        {passage.label && <p className="text-sm text-text-muted mt-0.5">{ref}</p>}
      </div>
    </a>
  );
}

function FocusPassagesInner() {
  // Hold back the empty state until storage has been read: "No focus passages
  // yet" is wrong for a student who has some, and the server cannot know.
  const [passages, , loaded] = useStoredState(() => focusPassageStore.load(), EMPTY);
  const [books, setBooks] = useState<HebrewBookMeta[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchBooks()
      .then(setBooks)
      .catch(() => {}); // Names fall back to the book code.
  }, []);

  const nameOf = (code: string) => books.find((b) => b.code === code)?.name ?? code;

  return (
    <div className="space-y-6">
      {!creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="min-h-11 px-5 py-2 rounded-xl font-bold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--color-primary)' }}
        >
          New focus passage
        </button>
      )}

      {creating && <FocusPassageNew onCancel={() => setCreating(false)} />}

      {loaded && passages.length === 0 && !creating && (
        <p className="text-text-muted max-w-xl">
          No focus passages yet. Choose a stretch of the Hebrew Bible and this page keeps its
          vocabulary, its text and how well you know it in one place.
        </p>
      )}

      {passages.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 max-w-3xl" aria-label="Your focus passages">
          {passages.map((p) => (
            <li key={p.id}>
              <PassageCard passage={p} bookName={nameOf(p.book)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FocusPassages() {
  return (
    <ErrorBoundary component="FocusPassages">
      <FocusPassagesInner />
    </ErrorBoundary>
  );
}
