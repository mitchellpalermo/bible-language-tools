import { useMemo, useState } from 'react';
import {
  type CustomDeck,
  createCustomDeck,
  deleteCustomDeck,
  loadCustomDecks,
  updateCustomDeck,
} from '../data/customDecks';
import { normalizeKey } from '../data/srs';
import { vocabulary } from '../data/vocabulary';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeckBuilderView = 'list' | 'edit';

interface DeckBuilderProps {
  decks: CustomDeck[];
  activeDeckId: string | null;
  onActivateDeck: (id: string | null) => void;
  onDecksChange: (decks: CustomDeck[]) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeckBuilder({
  decks,
  activeDeckId,
  onActivateDeck,
  onDecksChange,
  onClose,
}: DeckBuilderProps) {
  const [view, setView] = useState<DeckBuilderView>('list');
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftWordKeys, setDraftWordKeys] = useState<Set<string>>(new Set());
  const [wordSearch, setWordSearch] = useState('');
  const [nameError, setNameError] = useState('');
  const [saveError, setSaveError] = useState('');

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function openNew() {
    setEditingDeckId(null);
    setDraftName('');
    setDraftWordKeys(new Set());
    setWordSearch('');
    setNameError('');
    setSaveError('');
    setView('edit');
  }

  function openEdit(deck: CustomDeck) {
    setEditingDeckId(deck.id);
    setDraftName(deck.name);
    setDraftWordKeys(new Set(deck.wordKeys));
    setWordSearch('');
    setNameError('');
    setSaveError('');
    setView('edit');
  }

  function cancelEdit() {
    setView('list');
    setNameError('');
    setSaveError('');
  }

  function handleDelete(deck: CustomDeck) {
    if (!confirm(`Delete deck "${deck.name}"? This cannot be undone.`)) return;
    const updated = deleteCustomDeck(deck.id);
    onDecksChange(updated);
    if (deck.id === activeDeckId) onActivateDeck(null);
  }

  function handleSave() {
    const trimmed = draftName.trim();

    // Validate name
    if (!trimmed) {
      setNameError('Deck name is required.');
      return;
    }
    if (trimmed.length > 60) {
      setNameError('Name must be 60 characters or fewer.');
      return;
    }
    const duplicate = decks.find(
      (d) => d.name.trim().toLowerCase() === trimmed.toLowerCase() && d.id !== editingDeckId,
    );
    if (duplicate) {
      setNameError('A deck with that name already exists.');
      return;
    }
    setNameError('');

    // Validate words
    if (draftWordKeys.size === 0) {
      setSaveError('Add at least one word to the deck.');
      return;
    }
    setSaveError('');

    const wordKeys = Array.from(draftWordKeys).sort();

    if (editingDeckId === null) {
      // Create
      createCustomDeck(trimmed, wordKeys);
    } else {
      // Update
      updateCustomDeck(editingDeckId, { name: trimmed, wordKeys });
    }

    // Re-load to get the latest saved state
    onDecksChange(loadCustomDecks());
    setView('list');
  }

  function toggleWord(key: string) {
    setDraftWordKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ─── Filtered word list (word picker) ───────────────────────────────────────

  const filteredWords = useMemo(() => {
    const q = wordSearch.trim().toLowerCase();
    if (!q) return vocabulary;
    return vocabulary.filter(
      (w) => w.greek.toLowerCase().includes(q) || w.gloss.toLowerCase().includes(q),
    );
  }, [wordSearch]);

  function selectAllFiltered() {
    setDraftWordKeys((prev) => {
      const next = new Set(prev);
      for (const w of filteredWords) next.add(normalizeKey(w.greek));
      return next;
    });
  }

  function clearSelection() {
    setDraftWordKeys(new Set());
  }

  // ─── List view ───────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="bg-bg-card rounded-2xl border-2 border-indigo-100 p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text uppercase tracking-wider">My Decks</h3>
          <button
            onClick={onClose}
            aria-label="Close deck builder"
            className="text-text-muted hover:text-text transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {decks.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-4">
            No custom decks yet. Create one to get started.
          </p>
        ) : (
          <ul className="space-y-2" role="list">
            {decks.map((deck) => (
              <li
                key={deck.id}
                className="flex items-center justify-between gap-3 bg-white border border-indigo-100 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-text text-sm truncate block">
                    {deck.name}
                  </span>
                  <span className="text-xs text-text-muted">
                    {deck.wordKeys.length} word{deck.wordKeys.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onActivateDeck(deck.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-grape text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Study
                  </button>
                  <button
                    onClick={() => openEdit(deck)}
                    aria-label={`Edit deck ${deck.name}`}
                    className="px-2.5 py-1.5 border border-indigo-100 text-text-muted rounded-lg text-xs font-medium hover:border-grape/40 hover:text-text transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(deck)}
                    aria-label={`Delete deck ${deck.name}`}
                    className="px-2.5 py-1.5 border border-coral/20 text-coral rounded-lg text-xs font-medium hover:bg-coral/5 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={openNew}
          className="w-full py-2.5 border-2 border-dashed border-indigo-200 text-text-muted rounded-xl text-sm font-medium hover:border-grape/40 hover:text-text transition-colors"
        >
          + New Deck
        </button>
      </div>
    );
  }

  // ─── Edit view ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-bg-card rounded-2xl border-2 border-indigo-100 p-4 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text uppercase tracking-wider">
          {editingDeckId === null ? 'New Deck' : 'Edit Deck'}
        </h3>
        <button
          onClick={cancelEdit}
          aria-label="Back to deck list"
          className="text-sm text-text-muted hover:text-text transition-colors font-medium"
        >
          ← Back
        </button>
      </div>

      {/* Deck name */}
      <div>
        <label
          htmlFor="deck-name"
          className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5"
        >
          Deck Name
        </label>
        <input
          id="deck-name"
          type="text"
          value={draftName}
          onChange={(e) => {
            setDraftName(e.target.value);
            setNameError('');
          }}
          placeholder="e.g. Week 1 Passage Words"
          maxLength={60}
          className={`w-full px-3 py-2 border-2 rounded-xl text-sm focus:outline-none transition-colors ${
            nameError ? 'border-coral focus:border-coral' : 'border-indigo-100 focus:border-grape'
          }`}
          autoComplete="off"
        />
        <div className="flex justify-between mt-1">
          {nameError ? <p className="text-xs text-coral">{nameError}</p> : <span />}
          <span className="text-xs text-text-muted ml-auto">{draftName.length}/60</span>
        </div>
      </div>

      {/* Word picker */}
      <div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Add Words</p>

        {/* Search + bulk actions */}
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={wordSearch}
            onChange={(e) => setWordSearch(e.target.value)}
            placeholder="Search for English definition…"
            className="flex-1 px-3 py-2 border-2 border-indigo-100 rounded-xl text-sm focus:border-grape focus:outline-none"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search vocabulary"
          />
        </div>
        <div className="flex gap-2 mb-2">
          <button
            onClick={selectAllFiltered}
            className="text-xs text-grape hover:opacity-80 font-semibold transition-opacity"
          >
            Select all matching ({filteredWords.length})
          </button>
          <span className="text-text-muted text-xs">·</span>
          <button
            onClick={clearSelection}
            className="text-xs text-text-muted hover:text-text transition-colors font-medium"
          >
            Clear selection
          </button>
        </div>

        {/* Word list */}
        <div
          className="border-2 border-indigo-100 rounded-xl overflow-y-auto"
          style={{ maxHeight: '320px' }}
          role="list"
          aria-label="Vocabulary word list"
        >
          {filteredWords.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-6">No words match your search.</p>
          ) : (
            filteredWords.slice(0, 200).map((w) => {
              const key = normalizeKey(w.greek);
              const checked = draftWordKeys.has(key);
              return (
                <label
                  key={key}
                  role="listitem"
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors border-b border-indigo-50 last:border-b-0 ${
                    checked ? 'bg-grape/5' : 'hover:bg-indigo-50/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleWord(key)}
                    className="accent-grape shrink-0"
                    aria-label={`Add ${w.greek} to deck`}
                  />
                  <span
                    className="font-bold text-base shrink-0"
                    style={{ fontFamily: 'var(--font-greek)', color: 'var(--color-greek)' }}
                  >
                    {w.greek}
                  </span>
                  <span className="text-text-muted text-xs truncate flex-1">{w.gloss}</span>
                  <span className="text-text-muted text-xs shrink-0">
                    {w.frequency.toLocaleString()}×
                  </span>
                </label>
              );
            })
          )}
          {filteredWords.length > 200 && (
            <p className="text-center text-xs text-text-muted py-2 border-t border-indigo-50">
              Showing first 200 of {filteredWords.length} — search to narrow results
            </p>
          )}
        </div>

        {/* Selection footer */}
        <p className="text-sm text-text-muted mt-2" role="status" aria-label="word count">
          <strong className="text-text">{draftWordKeys.size}</strong> word
          {draftWordKeys.size !== 1 ? 's' : ''} selected
        </p>
        {saveError && <p className="text-xs text-coral mt-1">{saveError}</p>}
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSave}
          className="flex-1 py-2.5 bg-grape text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          {editingDeckId === null ? 'Create Deck' : 'Save Changes'}
        </button>
        <button
          onClick={cancelEdit}
          className="px-4 py-2.5 border-2 border-gray-200 text-text-muted rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
