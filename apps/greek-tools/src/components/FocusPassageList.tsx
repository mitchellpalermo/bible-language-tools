import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  deletePassage,
  type FocusPassage,
  getParseGrade,
  loadFocusPassages,
  saveFocusPassages,
} from '../data/focusPassages';
import { type BookMeta, fetchBooks } from '../data/morphgnt';
import { formatPassageRef } from '../lib/passage-deck';
import ErrorBoundary from './ErrorBoundary';

function gradeColor(grade: string): string {
  if (grade === 'A') return 'text-green-600';
  if (grade === 'B') return 'text-teal-600';
  if (grade === 'C') return 'text-amber-600';
  if (grade === 'D' || grade === 'E') return 'text-red-600';
  return 'text-text-muted';
}

function PassageCard({
  passage,
  bookName,
  onDelete,
  onRename,
}: {
  passage: FocusPassage;
  bookName: string;
  onDelete: () => void;
  onRename: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(passage.label ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const grade = getParseGrade(passage.id);

  const ref = formatPassageRef(
    bookName,
    passage.startChapter,
    passage.startVerse,
    passage.endChapter,
    passage.endVerse,
  );

  const displayTitle = passage.label ?? ref;

  function startEditing() {
    setDraft(passage.label ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitRename() {
    setEditing(false);
    onRename(draft.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setEditing(false);
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete "${displayTitle}"? This cannot be undone.`)) {
      onDelete();
    }
  }

  function handlePencilClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startEditing();
  }

  const createdDate = new Date(passage.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <a
      href={`/focus/${passage.id}`}
      className="group block bg-bg-card rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-white hover:-translate-y-0.5"
    >
      <div className="h-1.5 w-full" style={{ background: 'var(--color-accent)' }} />

      <div className="p-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.preventDefault()}
              className="flex-1 text-base font-bold rounded px-1 border border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] bg-bg"
            />
          ) : (
            <span className="text-base font-bold text-text leading-tight">{displayTitle}</span>
          )}

          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handlePencilClick}
              aria-label="Rename"
              className="p-1 rounded hover:bg-gray-100 text-text-muted hover:text-text transition-colors"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={handleDelete}
              aria-label="Delete"
              className="p-1 rounded hover:bg-red-50 text-text-muted hover:text-red-600 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Reference (when label is set) */}
        {passage.label && <p className="text-xs text-text-muted mb-2">{ref}</p>}

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
          <span>
            Grade: <strong className={gradeColor(grade)}>{grade}</strong>
          </span>
          <span className="text-text-muted/40">·</span>
          <span>Added {createdDate}</span>
        </div>
      </div>

      <div
        className="px-5 pb-4 text-xs font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--color-accent)' }}
      >
        Open →
      </div>
    </a>
  );
}

function FocusPassageListInner() {
  const [passages, setPassages] = useState<FocusPassage[]>(() => loadFocusPassages());
  const [books, setBooks] = useState<BookMeta[]>([]);

  useEffect(() => {
    fetchBooks().then(setBooks).catch(console.error);
  }, []);

  function getBookName(code: string): string {
    return books.find((b) => b.code === code)?.name ?? code;
  }

  function handleDelete(id: string) {
    deletePassage(id);
    setPassages((prev) => prev.filter((p) => p.id !== id));
  }

  function handleRename(id: string, label: string) {
    const updated = passages.map((p) => (p.id === id ? { ...p, label: label || undefined } : p));
    saveFocusPassages(updated);
    setPassages(updated);
  }

  if (passages.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text">Focus Passages</h1>
            <p className="text-text-muted text-sm mt-1">
              Pin a verse range and master it through vocab, parsing, and reading.
            </p>
          </div>
          <a
            href="/focus/new"
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
          >
            New Passage
          </a>
        </div>

        <div className="text-center py-24 space-y-4">
          <p
            className="text-5xl opacity-20 select-none"
            style={{ fontFamily: 'var(--font-greek)' }}
            aria-hidden="true"
          >
            Αα
          </p>
          <p className="text-lg text-text-muted">No focus passages yet.</p>
          <a
            href="/focus/new"
            className="inline-block px-5 py-2.5 bg-[var(--color-accent)] text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            Create your first →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Focus Passages</h1>
          <p className="text-text-muted text-sm mt-1">
            {passages.length} passage{passages.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <a
          href="/focus/new"
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
        >
          New Passage
        </a>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {passages.map((p) => (
          <PassageCard
            key={p.id}
            passage={p}
            bookName={getBookName(p.book)}
            onDelete={() => handleDelete(p.id)}
            onRename={(label) => handleRename(p.id, label)}
          />
        ))}
      </div>
    </div>
  );
}

export default function FocusPassageList() {
  return (
    <ErrorBoundary component="FocusPassageList">
      <FocusPassageListInner />
    </ErrorBoundary>
  );
}
