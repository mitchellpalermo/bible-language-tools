import {
  type FocusPassage,
  formatPassageRef,
  MAX_PASSAGE_LABEL,
  passageTitle,
} from '@tools/shared/focus-passages';
import { useStoredState } from '@tools/shared/use-stored-state';
import { useState } from 'react';
import { focusPassageStore } from '../lib/focus-passages';
import { usePassageData } from '../lib/use-passage-data';
import ErrorBoundary from './ErrorBoundary';
import FocusPassageProgress from './FocusPassageProgress';
import FocusPassageReading from './FocusPassageReading';
import FocusPassageVocabulary from './FocusPassageVocabulary';

const TABS = [
  { id: 'reading', label: 'Reading' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'progress', label: 'Progress' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function tabFromUrl(): TabId {
  if (typeof window === 'undefined') return 'reading';
  const param = new URLSearchParams(window.location.search).get('tab');
  return TABS.find((t) => t.id === param)?.id ?? 'reading';
}

function Header({
  passage,
  title,
  reference,
  onRename,
  onDelete,
}: {
  passage: FocusPassage;
  title: string;
  reference: string;
  onRename: (label: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(passage.label ?? '');

  function commit() {
    setEditing(false);
    onRename(draft);
  }

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <a href="/focus" className="text-sm text-text-muted hover:text-text inline-block mb-2">
          ← Focus passages
        </a>
        {editing ? (
          <div className="flex gap-2">
            <label htmlFor="rename" className="sr-only">
              Passage name
            </label>
            <input
              id="rename"
              // biome-ignore lint/a11y/noAutofocus: the student just asked to rename
              autoFocus
              value={draft}
              maxLength={MAX_PASSAGE_LABEL}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="rounded-lg border border-gray-400 bg-bg-card px-3 py-2 text-base text-text"
            />
            <button
              type="button"
              onClick={commit}
              className="min-h-11 px-4 rounded-lg font-bold text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              Save name
            </button>
          </div>
        ) : (
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {title}
          </h1>
        )}
        {passage.label && !editing && <p className="text-sm text-text-muted mt-0.5">{reference}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setDraft(passage.label ?? '');
            setEditing(true);
          }}
          className="min-h-11 px-4 rounded-lg text-sm font-semibold border border-gray-400 text-text hover:bg-gray-50"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="min-h-11 px-4 rounded-lg text-sm font-semibold border border-red-300 text-red-700 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function HubInner({ passageId }: { passageId: string }) {
  const [passage, setPassage, loaded] = useStoredState(
    () => focusPassageStore.get(passageId),
    null as FocusPassage | null,
  );
  const [tab, setTab] = useState<TabId>(tabFromUrl);
  const data = usePassageData(passage);

  if (!loaded) return <p className="text-text-muted py-16 text-center">Loading…</p>;

  if (!passage) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-lg text-text-muted">That focus passage is not here.</p>
        <a
          href="/focus"
          className="inline-block min-h-11 px-5 py-2.5 rounded-xl font-bold text-white hover:opacity-90"
          style={{ background: 'var(--color-primary)' }}
        >
          Back to focus passages
        </a>
      </div>
    );
  }

  const bookName = data.status === 'ready' ? data.bookName : passage.book;
  const reference = formatPassageRef(bookName, passage);
  const title = passageTitle(passage, bookName);

  function choose(next: TabId) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    history.replaceState(null, '', url.toString());
  }

  function remove() {
    if (!passage) return;
    if (!window.confirm(`Delete "${title}"? Your reviews of its words are kept.`)) return;
    focusPassageStore.remove(passage.id);
    window.location.href = '/focus';
  }

  return (
    <div>
      <Header
        // Remounted when the name changes so an open editor never shows a stale draft.
        key={passage.label ?? ''}
        passage={passage}
        title={title}
        reference={reference}
        onRename={(label) => {
          focusPassageStore.rename(passage.id, label);
          setPassage(focusPassageStore.get(passage.id));
        }}
        onDelete={remove}
      />

      <div
        role="tablist"
        aria-label="Passage views"
        className="flex gap-1 border-b border-gray-300 mb-6"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls="passage-panel"
            onClick={() => choose(id)}
            className={[
              'min-h-11 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
              tab === id
                ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                : 'border-transparent text-text-muted hover:text-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="passage-panel" aria-labelledby={`tab-${tab}`}>
        {data.status === 'loading' && <p className="text-text-muted">Loading the text…</p>}
        {data.status === 'error' && (
          <p role="alert" className="text-red-700">
            The Hebrew text did not load. Check your connection and reload the page.
          </p>
        )}
        {data.status === 'ready' && tab === 'reading' && (
          <FocusPassageReading passage={passage} verses={data.verses} />
        )}
        {data.status === 'ready' && tab === 'vocabulary' && (
          <FocusPassageVocabulary title={title} vocabulary={data.vocabulary} lemmas={data.lemmas} />
        )}
        {data.status === 'ready' && tab === 'progress' && (
          <FocusPassageProgress title={title} vocabulary={data.vocabulary} />
        )}
      </div>
    </div>
  );
}

export default function FocusPassageHub({ passageId }: { passageId: string }) {
  return (
    <ErrorBoundary component="FocusPassageHub">
      <HubInner passageId={passageId} />
    </ErrorBoundary>
  );
}
