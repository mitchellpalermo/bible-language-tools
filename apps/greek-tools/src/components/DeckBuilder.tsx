import { useEffect, useMemo, useState } from 'react';
import {
  type CustomDeck,
  createCustomDeck,
  deleteCustomDeck,
  loadCustomDecks,
  updateCustomDeck,
} from '../data/customDecks';
import { type BookMeta, fetchBook, fetchBooks, type MorphBook } from '../data/morphgnt';
import { getStudiedLemmas, normalizeKey } from '../data/srs';
import { vocabulary } from '../data/vocabulary';
import { getBookWordKeys } from '../lib/book-deck';
import {
  buildVocabMap,
  extractPassageLemmas,
  formatPassageRef,
  GNT_BOOKS,
  isValidRef,
} from '../lib/passage-deck';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeckBuilderView = 'list' | 'edit' | 'from-book' | 'passage';

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

  // From-book state
  const [availableBooks, setAvailableBooks] = useState<BookMeta[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [fromBookCode, setFromBookCode] = useState('');
  const [fromBookName, setFromBookName] = useState('');
  const [fromBookWordKeys, setFromBookWordKeys] = useState<string[]>([]);
  const [fromBookLoading, setFromBookLoading] = useState(false);
  const [fromBookError, setFromBookError] = useState('');
  const [fromBookNameError, setFromBookNameError] = useState('');

  // Passage view state
  const [passageBookCode, setPassageBookCode] = useState('MAT');
  const [passageBookData, setPassageBookData] = useState<MorphBook | null>(null);
  const [passageBookLoading, setPassageBookLoading] = useState(false);
  const [passageBookError, setPassageBookError] = useState('');
  const [passageStartCh, setPassageStartCh] = useState('1');
  const [passageStartVs, setPassageStartVs] = useState('1');
  const [passageEndCh, setPassageEndCh] = useState('1');
  const [passageEndVs, setPassageEndVs] = useState('1');
  const [passageNewWordsOnly, setPassageNewWordsOnly] = useState(false);
  const [passageName, setPassageName] = useState('');
  const [passageNameManuallyEdited, setPassageNameManuallyEdited] = useState(false);
  const [passageNameError, setPassageNameError] = useState('');
  const [passageSaveError, setPassageSaveError] = useState('');

  // ─── Passage view: computed values ───────────────────────────────────────────

  const vocabMap = useMemo(() => buildVocabMap(vocabulary), []);

  useEffect(() => {
    if (view !== 'passage') return;
    let cancelled = false;
    setPassageBookData(null);
    setPassageBookLoading(true);
    setPassageBookError('');
    fetchBook(passageBookCode)
      .then((data) => {
        if (!cancelled) {
          setPassageBookData(data);
          setPassageBookLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPassageBookLoading(false);
          setPassageBookError('Failed to load book data.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [passageBookCode, view]);

  const passageRefError = useMemo(() => {
    if (!passageBookData) return '';
    const startCh = parseInt(passageStartCh, 10);
    const startVs = parseInt(passageStartVs, 10);
    const endCh = parseInt(passageEndCh, 10);
    const endVs = parseInt(passageEndVs, 10);
    if (isNaN(startCh) || isNaN(startVs) || isNaN(endCh) || isNaN(endVs)) return '';
    if (!isValidRef(passageBookData, startCh, startVs)) {
      if (!(String(startCh) in passageBookData)) return `Chapter ${startCh} is out of range.`;
      return `Verse ${startVs} is out of range for chapter ${startCh}.`;
    }
    if (!isValidRef(passageBookData, endCh, endVs)) {
      if (!(String(endCh) in passageBookData)) return `Chapter ${endCh} is out of range.`;
      return `Verse ${endVs} is out of range for chapter ${endCh}.`;
    }
    if (startCh > endCh || (startCh === endCh && startVs > endVs))
      return 'Start must come before end.';
    return '';
  }, [passageBookData, passageStartCh, passageStartVs, passageEndCh, passageEndVs]);

  const previewLemmas = useMemo(() => {
    if (!passageBookData || passageRefError) return null;
    const startCh = parseInt(passageStartCh, 10);
    const startVs = parseInt(passageStartVs, 10);
    const endCh = parseInt(passageEndCh, 10);
    const endVs = parseInt(passageEndVs, 10);
    if (isNaN(startCh) || isNaN(startVs) || isNaN(endCh) || isNaN(endVs)) return null;
    const all = extractPassageLemmas(passageBookData, startCh, startVs, endCh, endVs, vocabMap);
    if (!passageNewWordsOnly) return all;
    const studied = getStudiedLemmas();
    return all.filter((key) => !studied.has(key));
  }, [
    passageBookData,
    passageRefError,
    passageStartCh,
    passageStartVs,
    passageEndCh,
    passageEndVs,
    passageNewWordsOnly,
    vocabMap,
  ]);

  const autoPassageName = useMemo(() => {
    if (!passageBookData || passageRefError) return null;
    const startCh = parseInt(passageStartCh, 10);
    const startVs = parseInt(passageStartVs, 10);
    const endCh = parseInt(passageEndCh, 10);
    const endVs = parseInt(passageEndVs, 10);
    if (isNaN(startCh) || isNaN(startVs) || isNaN(endCh) || isNaN(endVs)) return null;
    const bookName = GNT_BOOKS.find((b) => b.code === passageBookCode)?.name ?? passageBookCode;
    return formatPassageRef(bookName, startCh, startVs, endCh, endVs);
  }, [
    passageBookData,
    passageRefError,
    passageBookCode,
    passageStartCh,
    passageStartVs,
    passageEndCh,
    passageEndVs,
  ]);

  useEffect(() => {
    if (passageNameManuallyEdited || !autoPassageName) return;
    setPassageName(autoPassageName);
  }, [autoPassageName, passageNameManuallyEdited]);

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

  async function openFromBook() {
    setFromBookCode('');
    setFromBookName('');
    setFromBookWordKeys([]);
    setFromBookError('');
    setFromBookNameError('');
    setView('from-book');

    if (availableBooks.length === 0) {
      setBooksLoading(true);
      try {
        const books = await fetchBooks();
        setAvailableBooks(books);
      } catch {
        setFromBookError('Could not load book list. Try again.');
      } finally {
        setBooksLoading(false);
      }
    }
  }

  async function handleBookSelect(code: string) {
    const meta = availableBooks.find((b) => b.code === code);
    if (!meta) return;

    setFromBookCode(code);
    setFromBookName(meta.name);
    setFromBookWordKeys([]);
    setFromBookError('');
    setFromBookLoading(true);

    try {
      const keys = await getBookWordKeys(code);
      setFromBookWordKeys(keys);
    } catch {
      setFromBookError('Could not load book data. Try again.');
    } finally {
      setFromBookLoading(false);
    }
  }

  function handleFromBookCreate() {
    const trimmed = fromBookName.trim();

    if (!trimmed) {
      setFromBookNameError('Deck name is required.');
      return;
    }
    if (trimmed.length > 60) {
      setFromBookNameError('Name must be 60 characters or fewer.');
      return;
    }
    const duplicate = decks.find((d) => d.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setFromBookNameError('A deck with that name already exists.');
      return;
    }
    setFromBookNameError('');

    createCustomDeck(trimmed, fromBookWordKeys.sort());
    onDecksChange(loadCustomDecks());
    setView('list');
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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={openNew}
            className="flex-1 py-2.5 border-2 border-dashed border-indigo-200 text-text-muted rounded-xl text-sm font-medium hover:border-grape/40 hover:text-text transition-colors"
          >
            + New Deck
          </button>
          <button
            type="button"
            onClick={openFromBook}
            className="flex-1 py-2.5 border-2 border-dashed border-indigo-200 text-text-muted rounded-xl text-sm font-medium hover:border-grape/40 hover:text-text transition-colors"
          >
            + From GNT Book
          </button>
        </div>
        <button
          type="button"
          onClick={openPassage}
          className="w-full py-2.5 border-2 border-dashed border-indigo-200 text-text-muted rounded-xl text-sm font-medium hover:border-grape/40 hover:text-text transition-colors"
        >
          Generate from Passage
        </button>
      </div>
    );
  }

  // ─── From-book view ──────────────────────────────────────────────────────────

  if (view === 'from-book') {
    return (
      <div className="bg-bg-card rounded-2xl border-2 border-indigo-100 p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text uppercase tracking-wider">
            Deck from GNT Book
          </h3>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label="Back to deck list"
            className="text-sm text-text-muted hover:text-text transition-colors font-medium"
          >
            ← Back
          </button>
        </div>

        {booksLoading ? (
          <p className="text-sm text-text-muted text-center py-4">Loading books…</p>
        ) : (
          <>
            <div>
              <label
                htmlFor="from-book-select"
                className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5"
              >
                Book
              </label>
              <select
                id="from-book-select"
                value={fromBookCode}
                onChange={(e) => handleBookSelect(e.target.value)}
                className="w-full px-3 py-2 border-2 border-indigo-100 rounded-xl text-sm focus:border-grape focus:outline-none bg-white"
                aria-label="Select GNT book"
              >
                <option value="">— Select a book —</option>
                {availableBooks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {fromBookCode && (
              <div>
                <label
                  htmlFor="from-book-name"
                  className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5"
                >
                  Deck Name
                </label>
                <input
                  id="from-book-name"
                  type="text"
                  value={fromBookName}
                  onChange={(e) => {
                    setFromBookName(e.target.value);
                    setFromBookNameError('');
                  }}
                  maxLength={60}
                  className={`w-full px-3 py-2 border-2 rounded-xl text-sm focus:outline-none transition-colors ${
                    fromBookNameError
                      ? 'border-coral focus:border-coral'
                      : 'border-indigo-100 focus:border-grape'
                  }`}
                  autoComplete="off"
                />
                <div className="flex justify-between mt-1">
                  {fromBookNameError ? (
                    <p className="text-xs text-coral">{fromBookNameError}</p>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-text-muted ml-auto">{fromBookName.length}/60</span>
                </div>
              </div>
            )}

            {fromBookCode && (
              <div className="text-sm" role="status" aria-live="polite">
                {fromBookLoading ? (
                  <span className="text-text-muted">Loading words…</span>
                ) : fromBookError ? (
                  <span className="text-coral">{fromBookError}</span>
                ) : fromBookWordKeys.length > 0 ? (
                  <span className="text-text-muted">
                    <strong className="text-text">{fromBookWordKeys.length}</strong> unique
                    vocabulary word{fromBookWordKeys.length !== 1 ? 's' : ''} in{' '}
                    {availableBooks.find((b) => b.code === fromBookCode)?.name}
                  </span>
                ) : null}
              </div>
            )}

            {fromBookError && !fromBookCode && (
              <p className="text-xs text-coral">{fromBookError}</p>
            )}
          </>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleFromBookCreate}
            disabled={!fromBookCode || fromBookLoading || fromBookWordKeys.length === 0}
            className="flex-1 py-2.5 bg-grape text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Deck
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className="px-4 py-2.5 border-2 border-gray-200 text-text-muted rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─── Passage view helpers ────────────────────────────────────────────────────

  function openPassage() {
    setPassageBookCode('MAT');
    setPassageBookData(null);
    setPassageBookLoading(false);
    setPassageBookError('');
    setPassageStartCh('1');
    setPassageStartVs('1');
    setPassageEndCh('1');
    setPassageEndVs('1');
    setPassageNewWordsOnly(false);
    setPassageName('');
    setPassageNameManuallyEdited(false);
    setPassageNameError('');
    setPassageSaveError('');
    setView('passage');
  }

  function handlePassageBookChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPassageBookCode(e.target.value);
    setPassageStartCh('1');
    setPassageStartVs('1');
    setPassageEndCh('1');
    setPassageEndVs('1');
    setPassageNameManuallyEdited(false);
  }

  function handlePassageSave() {
    const trimmed = passageName.trim();
    if (!trimmed) {
      setPassageNameError('Deck name is required.');
      return;
    }
    if (trimmed.length > 60) {
      setPassageNameError('Name must be 60 characters or fewer.');
      return;
    }
    const duplicate = decks.find((d) => d.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setPassageNameError('A deck with that name already exists.');
      return;
    }
    setPassageNameError('');
    if (!previewLemmas || previewLemmas.length === 0) {
      setPassageSaveError('No words found in this passage. Adjust the range or filter.');
      return;
    }
    setPassageSaveError('');
    const newDeck = createCustomDeck(trimmed, previewLemmas);
    onDecksChange(loadCustomDecks());
    onActivateDeck(newDeck.id);
    onClose();
  }

  // ─── Passage view ─────────────────────────────────────────────────────────────

  if (view === 'passage') {
    const previewCount = previewLemmas?.length ?? null;
    return (
      <div className="bg-bg-card rounded-2xl border-2 border-indigo-100 p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text uppercase tracking-wider">
            Generate from Passage
          </h3>
          <button
            onClick={() => setView('list')}
            aria-label="Back to deck list"
            className="text-sm text-text-muted hover:text-text transition-colors font-medium"
          >
            ← Back
          </button>
        </div>

        <div>
          <label
            htmlFor="passage-book"
            className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5"
          >
            Book
          </label>
          <select
            id="passage-book"
            value={passageBookCode}
            onChange={handlePassageBookChange}
            className="w-full px-3 py-2 border-2 border-indigo-100 rounded-xl text-sm focus:border-grape focus:outline-none bg-white"
          >
            {GNT_BOOKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
            Passage Range
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted w-8 shrink-0">From</span>
            <input
              type="number"
              min={1}
              value={passageStartCh}
              onChange={(e) => setPassageStartCh(e.target.value)}
              aria-label="Start chapter"
              className="w-16 px-2 py-2 border-2 border-indigo-100 rounded-xl text-sm text-center focus:border-grape focus:outline-none"
            />
            <span className="text-xs text-text-muted">:</span>
            <input
              type="number"
              min={1}
              value={passageStartVs}
              onChange={(e) => setPassageStartVs(e.target.value)}
              aria-label="Start verse"
              className="w-16 px-2 py-2 border-2 border-indigo-100 rounded-xl text-sm text-center focus:border-grape focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted w-8 shrink-0">To</span>
            <input
              type="number"
              min={1}
              value={passageEndCh}
              onChange={(e) => setPassageEndCh(e.target.value)}
              aria-label="End chapter"
              className="w-16 px-2 py-2 border-2 border-indigo-100 rounded-xl text-sm text-center focus:border-grape focus:outline-none"
            />
            <span className="text-xs text-text-muted">:</span>
            <input
              type="number"
              min={1}
              value={passageEndVs}
              onChange={(e) => setPassageEndVs(e.target.value)}
              aria-label="End verse"
              className="w-16 px-2 py-2 border-2 border-indigo-100 rounded-xl text-sm text-center focus:border-grape focus:outline-none"
            />
          </div>
          {passageRefError && <p className="text-xs text-coral">{passageRefError}</p>}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={passageNewWordsOnly}
            onChange={(e) => setPassageNewWordsOnly(e.target.checked)}
            className="accent-grape"
            aria-label="New words only"
          />
          <span className="text-sm text-text">New words only</span>
          <span className="text-xs text-text-muted">(exclude already studied)</span>
        </label>

        {passageBookLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : passageBookError ? (
          <p className="text-sm text-coral">{passageBookError}</p>
        ) : previewCount !== null ? (
          <p className="text-sm text-text-muted" role="status" aria-label="passage word count">
            <strong className="text-text">{previewCount}</strong> unique word
            {previewCount !== 1 ? 's' : ''} found in this passage
          </p>
        ) : null}

        <div>
          <label
            htmlFor="passage-deck-name"
            className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5"
          >
            Deck Name
          </label>
          <input
            id="passage-deck-name"
            type="text"
            value={passageName}
            onChange={(e) => {
              setPassageName(e.target.value);
              setPassageNameManuallyEdited(true);
              setPassageNameError('');
            }}
            placeholder="e.g. John 3:1–21"
            maxLength={60}
            className={`w-full px-3 py-2 border-2 rounded-xl text-sm focus:outline-none transition-colors ${passageNameError ? 'border-coral focus:border-coral' : 'border-indigo-100 focus:border-grape'}`}
            autoComplete="off"
          />
          <div className="flex justify-between mt-1">
            {passageNameError ? <p className="text-xs text-coral">{passageNameError}</p> : <span />}
            <span className="text-xs text-text-muted ml-auto">{passageName.length}/60</span>
          </div>
        </div>

        {passageSaveError && <p className="text-xs text-coral">{passageSaveError}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handlePassageSave}
            className="flex-1 py-2.5 bg-grape text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            Generate Deck
          </button>
          <button
            onClick={() => setView('list')}
            className="px-4 py-2.5 border-2 border-gray-200 text-text-muted rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
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
