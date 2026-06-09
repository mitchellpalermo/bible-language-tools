import { useEffect, useState } from 'react';
import {
  type FocusPassage,
  generateId,
  loadFocusPassages,
  saveFocusPassages,
} from '../data/focusPassages';
import { type BookMeta, fetchBook, fetchBooks } from '../data/morphgnt';
import { vocabulary } from '../data/vocabulary';
import { extractVerbsMultiChapter } from '../lib/gnt-parse';
import { buildVocabMap, extractPassageLemmas, formatPassageRef } from '../lib/passage-deck';
import CrossChapterSelector, {
  type CrossChapterRange,
  DEFAULT_CROSS_CHAPTER_RANGE,
} from './CrossChapterSelector';
import ErrorBoundary from './ErrorBoundary';

type Step = 'select' | 'preview' | 'confirm';

function FocusPassageNewInner() {
  const [step, setStep] = useState<Step>('select');
  const [range, setRange] = useState<CrossChapterRange>(DEFAULT_CROSS_CHAPTER_RANGE);
  const [label, setLabel] = useState('');
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [preview, setPreview] = useState<{
    lemmaCount: number;
    verbCount: number;
    snippet: string;
    bookName: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetchBooks().then(setBooks).catch(console.error);
  }, []);

  function bookName(): string {
    return books.find((b) => b.code === range.book)?.name ?? range.book;
  }

  function passageRef(): string {
    return formatPassageRef(
      bookName(),
      range.startChapter,
      range.startVerse,
      range.endChapter,
      range.endVerse,
    );
  }

  async function handlePreview() {
    setLoadingPreview(true);
    try {
      const bookData = await fetchBook(range.book);
      const name = books.find((b) => b.code === range.book)?.name ?? range.book;
      const vocabMap = buildVocabMap(vocabulary);
      const lemmas = extractPassageLemmas(
        bookData,
        range.startChapter,
        range.startVerse,
        range.endChapter,
        range.endVerse,
        vocabMap,
      );
      const verbs = extractVerbsMultiChapter(
        bookData,
        range.startChapter,
        range.startVerse,
        range.endChapter,
        range.endVerse,
        name,
      );

      // Build a short text snippet from the first few words of the first verse
      const firstChapter = bookData[String(range.startChapter)];
      const firstVerse = firstChapter?.[String(range.startVerse)];
      const snippet = firstVerse
        ? firstVerse
            .slice(0, 8)
            .map((w) => w.text)
            .join(' ') + (firstVerse.length > 8 ? '…' : '')
        : '';

      setPreview({ lemmaCount: lemmas.length, verbCount: verbs.length, snippet, bookName: name });
      setStep('preview');
    } catch {
      // stay on select step; user can try again
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleConfirm() {
    if (!preview) return;
    const newPassage: FocusPassage = {
      id: generateId(),
      label: label.trim() || undefined,
      book: range.book,
      startChapter: range.startChapter,
      startVerse: range.startVerse,
      endChapter: range.endChapter,
      endVerse: range.endVerse,
      createdAt: new Date().toISOString(),
    };
    saveFocusPassages([...loadFocusPassages(), newPassage]);
    window.location.href = `/focus/${newPassage.id}`;
  }

  const ref = passageRef();

  if (step === 'select') {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">New Focus Passage</h1>
          <p className="text-text-muted text-sm">
            Choose a verse range to study deeply — vocab, parsing, and reading in one place.
          </p>
        </div>

        <CrossChapterSelector value={range} onChange={setRange} />

        <button
          onClick={handlePreview}
          disabled={loadingPreview}
          className="w-full py-3 rounded-xl text-base font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loadingPreview ? 'Loading…' : 'Preview Passage →'}
        </button>
      </div>
    );
  }

  if (step === 'preview' && preview) {
    return (
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <button
            onClick={() => setStep('select')}
            className="text-sm text-text-muted hover:text-text mb-4 inline-flex items-center gap-1"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-text mb-1">{ref}</h1>
          {preview.snippet && (
            <p
              className="mt-2 text-text-muted leading-relaxed"
              style={{ fontFamily: 'var(--font-greek)', fontSize: '1.1rem' }}
            >
              {preview.snippet}
            </p>
          )}
        </div>

        <div className="bg-bg-card rounded-2xl border border-indigo-100 p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Vocabulary words</span>
            <span className="font-semibold text-text">{preview.lemmaCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Verb forms</span>
            <span className="font-semibold text-text">{preview.verbCount}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
            Name (optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
            }}
            placeholder={`e.g. "${ref}"`}
            className="w-full rounded-lg border border-bg-card bg-bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <button
          onClick={handleConfirm}
          className="w-full py-3 rounded-xl text-base font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
        >
          Create Focus Passage
        </button>
      </div>
    );
  }

  return null;
}

export default function FocusPassageNew() {
  return (
    <ErrorBoundary component="FocusPassageNew">
      <FocusPassageNewInner />
    </ErrorBoundary>
  );
}
