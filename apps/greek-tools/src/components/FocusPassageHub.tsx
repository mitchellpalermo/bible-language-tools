import { useEffect, useState } from 'react';
import { deletePassage, type FocusPassage, loadFocusPassages } from '../data/focusPassages';
import { fetchBooks } from '../data/morphgnt';
import { formatPassageRef } from '../lib/passage-deck';
import ErrorBoundary from './ErrorBoundary';
import FocusPassageParsing from './FocusPassageParsing';
import FocusPassageProgress from './FocusPassageProgress';
import FocusPassageReader from './FocusPassageReader';
import FocusPassageVocab from './FocusPassageVocab';

type Tab = 'reader' | 'vocab' | 'parsing' | 'progress';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'reader', label: 'Reader' },
  { id: 'vocab', label: 'Vocab' },
  { id: 'parsing', label: 'Parsing' },
  { id: 'progress', label: 'Progress' },
];

function getInitialTab(): Tab {
  if (typeof window === 'undefined') return 'reader';
  const param = new URLSearchParams(window.location.search).get('tab');
  return TABS.find((t) => t.id === param)?.id ?? 'reader';
}

function setTabInUrl(tab: Tab) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  history.replaceState(null, '', url.toString());
}

function FocusPassageHubInner({ passageId }: { passageId: string }) {
  const [passage, setPassage] = useState<FocusPassage | null>(null);
  const [bookName, setBookName] = useState('');
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const passages = loadFocusPassages();
    const found = passages.find((p) => p.id === passageId);
    if (!found) {
      setNotFound(true);
      return;
    }
    setPassage(found);
    fetchBooks()
      .then((books) => {
        const name = books.find((b) => b.code === found.book)?.name ?? found.book;
        setBookName(name);
      })
      .catch(console.error);
  }, [passageId]);

  function handleTabChange(t: Tab) {
    setTab(t);
    setTabInUrl(t);
  }

  if (notFound) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-lg text-text-muted">Passage not found.</p>
        <a
          href="/focus"
          className="inline-block px-5 py-2.5 bg-[var(--color-accent)] text-white rounded-xl font-bold hover:opacity-90"
        >
          ← Back to Focus Passages
        </a>
      </div>
    );
  }

  if (!passage) {
    return <p className="text-text-muted text-center py-16">Loading…</p>;
  }

  const ref = bookName
    ? formatPassageRef(
        bookName,
        passage.startChapter,
        passage.startVerse,
        passage.endChapter,
        passage.endVerse,
      )
    : '';

  function handleDelete() {
    if (!passage) return;
    const title = passage.label ?? ref;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    deletePassage(passage.id);
    window.location.href = '/focus';
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-2">
        <div>
          <a href="/focus" className="text-xs text-text-muted hover:text-text mb-2 inline-block">
            ← Focus Passages
          </a>
          <h1 className="text-2xl font-bold text-text">{passage.label ?? ref}</h1>
          {passage.label && ref && <p className="text-sm text-text-muted mt-0.5">{ref}</p>}
        </div>
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors shrink-0"
        >
          Delete Passage
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={[
              'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-text-muted hover:text-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'reader' && <FocusPassageReader passage={passage} />}
      {tab === 'vocab' && <FocusPassageVocab passage={passage} />}
      {tab === 'parsing' && <FocusPassageParsing passage={passage} bookName={bookName} />}
      {tab === 'progress' && <FocusPassageProgress passage={passage} />}
    </div>
  );
}

export default function FocusPassageHub({ passageId }: { passageId: string }) {
  return (
    <ErrorBoundary component="FocusPassageHub">
      <FocusPassageHubInner passageId={passageId} />
    </ErrorBoundary>
  );
}
