// The custom deck builder: list your decks, make one, edit one, delete one.
// Shared by both apps; the vocabulary it picks from is passed in.
//
// STYLED INLINE ON FALLBACK-BEARING TOKENS, never Tailwind utilities, for the
// reasons at the top of GradeButtons.tsx: neither app scans packages/shared, so
// a utility class here emits no CSS. The accent is a required prop because
// `--color-primary` is a different colour in each app.
//
// What the builder does not know is anything about a language. A word arrives
// as `{ key, label, detail, search }` — the app decides what a word looks like
// (pointed Hebrew in the Hebrew face, say) and what typing in the search box
// should find. greek.tools' builder also builds a deck from a GNT book or a
// passage; those need its corpus, so they stay there until it adopts this.

import { type CSSProperties, useMemo, useState } from 'react';
import {
  type CustomDeck,
  type CustomDeckStore,
  deckNameError,
  MAX_DECK_NAME,
} from '../custom-decks';

export interface DeckBuilderWord {
  /** The SRS store key the deck holds. */
  key: string;
  /** The word as the card shows it. */
  label: string;
  /** The gloss or other small print. */
  detail: string;
  /** Lower-cased text the search box matches: the gloss, the word without its points, and so on. */
  search: string;
}

export interface DeckBuilderProps {
  /** The live decks. */
  decks: CustomDeck[];
  words: readonly DeckBuilderWord[];
  store: CustomDeckStore;
  activeDeckId: string | null;
  onActivateDeck: (id: string | null) => void;
  onDecksChange: (decks: CustomDeck[]) => void;
  onClose: () => void;
  /** The app's accent, e.g. `var(--color-primary, #15803D)`. */
  accent: string;
  /** For a script that needs them in the word column: its direction, language tag and font. */
  labelDir?: 'rtl' | 'ltr';
  labelLang?: string;
  labelFontFamily?: string;
}

/** Rows drawn at once. A thousand checkboxes is slow on a tablet; the search box narrows. */
export const VISIBLE_WORDS = 150;

const FALLBACK = {
  text: 'var(--color-text, #1F2937)',
  muted: 'var(--color-text-muted, #6B7280)',
  card: 'var(--color-bg-card, #FFFFFF)',
  coral: 'var(--color-coral, #F43F5E)',
  border: '#D1D5DB',
};

const panel: CSSProperties = {
  background: FALLBACK.card,
  border: `2px solid ${FALLBACK.border}`,
  borderRadius: 16,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  color: FALLBACK.text,
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };

const field: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 12px',
  borderRadius: 12,
  border: `2px solid ${FALLBACK.border}`,
  fontSize: 14,
  background: '#fff',
  color: FALLBACK.text,
};

const small: CSSProperties = { fontSize: 12, color: FALLBACK.muted };

function filled(accent: string): CSSProperties {
  return {
    padding: '10px 16px',
    borderRadius: 12,
    border: 'none',
    background: accent,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

const quiet: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 12,
  border: `2px solid ${FALLBACK.border}`,
  background: 'transparent',
  color: FALLBACK.muted,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

const link = (accent: string): CSSProperties => ({
  background: 'none',
  border: 'none',
  padding: 0,
  color: accent,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
});

export default function DeckBuilder({
  decks,
  words,
  store,
  activeDeckId,
  onActivateDeck,
  onDecksChange,
  onClose,
  accent,
  labelDir,
  labelLang,
  labelFontFamily,
}: DeckBuilderProps) {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [nameError, setNameError] = useState('');
  const [saveError, setSaveError] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? words.filter((w) => w.search.includes(q)) : words;
  }, [words, query]);

  function open(deck: CustomDeck | null) {
    setEditingId(deck?.id ?? null);
    setName(deck?.name ?? '');
    setPicked(new Set(deck?.wordKeys ?? []));
    setQuery('');
    setNameError('');
    setSaveError('');
    setView('edit');
  }

  function save() {
    const error = deckNameError(name, decks, editingId);
    setNameError(error ?? '');
    if (error) return;
    if (picked.size === 0) {
      setSaveError('Add at least one word to the deck.');
      return;
    }
    setSaveError('');
    try {
      const wordKeys = [...picked];
      if (editingId === null) store.create(name, wordKeys);
      else store.update(editingId, { name, wordKeys });
    } catch {
      // A full or disabled localStorage must say so, not look like it saved.
      setSaveError('Could not save the deck. This browser’s storage may be full or turned off.');
      return;
    }
    onDecksChange(store.load());
    setView('list');
  }

  function remove(deck: CustomDeck) {
    if (!window.confirm(`Delete deck "${deck.name}"? This cannot be undone.`)) return;
    onDecksChange(store.remove(deck.id));
    if (deck.id === activeDeckId) onActivateDeck(null);
  }

  function toggle(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  if (view === 'list') {
    return (
      <section aria-label="Custom decks" style={panel}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <h3 style={heading}>My decks</h3>
          <button type="button" onClick={onClose} style={link(accent)}>
            Close
          </button>
        </div>

        {decks.length === 0 ? (
          <p style={{ ...small, margin: 0 }}>
            No decks yet. A deck is any set of words you choose; it picks cards to study and never
            holds a schedule of its own.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {decks.map((deck) => (
              <li
                key={deck.id}
                style={{
                  ...row,
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  padding: '8px 12px',
                  borderRadius: 12,
                  border: `2px solid ${FALLBACK.border}`,
                }}
              >
                <span>
                  <strong>{deck.name}</strong>{' '}
                  <span style={small}>
                    {deck.wordKeys.length} {deck.wordKeys.length === 1 ? 'word' : 'words'}
                  </span>
                </span>
                <span style={row}>
                  <button
                    type="button"
                    onClick={() => {
                      onActivateDeck(deck.id);
                      onClose();
                    }}
                    style={link(accent)}
                    aria-label={`Study ${deck.name}`}
                  >
                    Study
                  </button>
                  <button
                    type="button"
                    onClick={() => open(deck)}
                    style={link(accent)}
                    aria-label={`Edit ${deck.name}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(deck)}
                    style={{ ...link(accent), color: FALLBACK.coral }}
                    aria-label={`Delete ${deck.name}`}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div>
          <button type="button" onClick={() => open(null)} style={filled(accent)}>
            New deck
          </button>
        </div>
      </section>
    );
  }

  const shown = matches.slice(0, VISIBLE_WORDS);
  return (
    <section aria-label={editingId === null ? 'New deck' : 'Edit deck'} style={panel}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <h3 style={heading}>{editingId === null ? 'New deck' : 'Edit deck'}</h3>
        <button type="button" onClick={() => setView('list')} style={link(accent)}>
          ← Back
        </button>
      </div>

      <div>
        <label htmlFor="deck-name" style={{ ...small, fontWeight: 700, display: 'block' }}>
          Deck name
        </label>
        <input
          id="deck-name"
          type="text"
          value={name}
          maxLength={MAX_DECK_NAME}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            setNameError('');
          }}
          aria-invalid={nameError !== ''}
          style={{ ...field, borderColor: nameError ? FALLBACK.coral : FALLBACK.border }}
        />
        <div style={{ ...row, justifyContent: 'space-between', marginTop: 4 }}>
          <span role="alert" style={{ ...small, color: FALLBACK.coral }}>
            {nameError}
          </span>
          <span style={small}>
            {name.length}/{MAX_DECK_NAME}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="deck-search" style={{ ...small, fontWeight: 700, display: 'block' }}>
          Find words
        </label>
        <input
          id="deck-search"
          type="search"
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          style={field}
        />
        <div style={{ ...row, justifyContent: 'space-between', marginTop: 4, flexWrap: 'wrap' }}>
          <span style={small} role="status">
            <strong>{picked.size}</strong> selected &middot; {matches.length}{' '}
            {matches.length === 1 ? 'match' : 'matches'}
          </span>
          <span style={row}>
            <button
              type="button"
              style={link(accent)}
              onClick={() => setPicked((prev) => new Set([...prev, ...matches.map((w) => w.key)]))}
            >
              Add all {matches.length} {matches.length === 1 ? 'match' : 'matches'}
            </button>
            <button type="button" style={link(accent)} onClick={() => setPicked(new Set())}>
              Clear selection
            </button>
          </span>
        </div>
      </div>

      <ul
        aria-label="Words"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          maxHeight: 320,
          overflowY: 'auto',
          border: `2px solid ${FALLBACK.border}`,
          borderRadius: 12,
        }}
      >
        {shown.map((w) => (
          <li key={w.key}>
            <label
              style={{
                ...row,
                padding: '6px 12px',
                cursor: 'pointer',
                justifyContent: 'flex-start',
              }}
            >
              <input
                type="checkbox"
                checked={picked.has(w.key)}
                onChange={() => toggle(w.key)}
                style={{ accentColor: accent }}
              />
              <span
                dir={labelDir}
                lang={labelLang}
                style={{ fontSize: 18, fontFamily: labelFontFamily, minWidth: 72 }}
              >
                {w.label}
              </span>
              <span style={small}>{w.detail}</span>
            </label>
          </li>
        ))}
      </ul>
      {matches.length > shown.length && (
        <p style={{ ...small, margin: 0 }}>
          Showing the first {shown.length} of {matches.length}. Type in the search box to narrow
          them.
        </p>
      )}
      {matches.length === 0 && (
        <p style={{ ...small, margin: 0 }}>No words match &ldquo;{query}&rdquo;.</p>
      )}

      {saveError && (
        <p role="alert" style={{ ...small, color: FALLBACK.coral, margin: 0 }}>
          {saveError}
        </p>
      )}
      <div style={row}>
        <button type="button" onClick={save} style={{ ...filled(accent), flex: 1 }}>
          {editingId === null ? 'Create deck' : 'Save changes'}
        </button>
        <button type="button" onClick={() => setView('list')} style={quiet}>
          Cancel
        </button>
      </div>
    </section>
  );
}
