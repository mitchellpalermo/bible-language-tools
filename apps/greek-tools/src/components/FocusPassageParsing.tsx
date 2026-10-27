import { useEffect, useState } from 'react';
import type { FocusPassage } from '../data/focusPassages';
import { recordParseSession } from '../data/focusPassages';
import { fetchBook, fetchBooks } from '../data/morphgnt';
import {
  deduplicateByLemma,
  emptyGNTAnswer,
  extractVerbsMultiChapter,
  filterMissedItems,
  type GNTParseAnswer,
  type GNTParseItem,
  type GNTParseResult,
  gradeGNTAnswer,
  sampleVerbs,
} from '../lib/gnt-parse';
import { formatPassageRef } from '../lib/passage-deck';
import GNTFeedback from './GNTFeedback';
import GNTParseQuestion from './GNTParseQuestion';
import type { SessionResults } from './ParseResults';
import ParseResults from './ParseResults';

type Phase = 'select' | 'question' | 'feedback' | 'results';

const SESSION_LENGTHS = [10, 20, 30, 'all'] as const;
type SessionLength = (typeof SESSION_LENGTHS)[number];
const SESSION_LABELS: Record<string, string> = { 10: '10', 20: '20', 30: '30', all: 'All' };

interface Props {
  passage: FocusPassage;
  bookName: string;
}

export default function FocusPassageParsing({ passage, bookName }: Props) {
  const [verbCount, setVerbCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionLength, setSessionLength] = useState<SessionLength>(20);
  const [skipRepeated, setSkipRepeated] = useState(false);

  const [phase, setPhase] = useState<Phase>('select');
  const [session, setSession] = useState<GNTParseItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState<GNTParseAnswer>(emptyGNTAnswer());
  const [results, setResults] = useState<GNTParseResult[]>([]);
  const [currentResult, setCurrentResult] = useState<GNTParseResult | null>(null);
  const [isReview, setIsReview] = useState(false);
  const [allItems, setAllItems] = useState<GNTParseItem[]>([]);

  const ref = formatPassageRef(
    bookName,
    passage.startChapter,
    passage.startVerse,
    passage.endChapter,
    passage.endVerse,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([fetchBook(passage.book), fetchBooks()])
      .then(([bookData, books]) => {
        if (cancelled) return;
        const name = books.find((b) => b.code === passage.book)?.name ?? bookName;
        let verbs = extractVerbsMultiChapter(
          bookData,
          passage.startChapter,
          passage.startVerse,
          passage.endChapter,
          passage.endVerse,
          name,
        );
        if (skipRepeated) verbs = deduplicateByLemma(verbs);
        setAllItems(verbs);
        setVerbCount(verbs.length);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    passage.book,
    passage.startChapter,
    passage.startVerse,
    passage.endChapter,
    passage.endVerse,
    bookName,
    skipRepeated,
  ]);

  function handleStart() {
    const items = [...allItems];
    const count = sessionLength === 'all' ? items.length : sessionLength;
    const sampled = sampleVerbs(items, count);
    if (sampled.length === 0) return;
    setSession(sampled);
    setCurrentIndex(0);
    setResults([]);
    setAnswer(emptyGNTAnswer());
    setCurrentResult(null);
    setIsReview(false);
    setPhase('question');
  }

  function handleReviewMissed() {
    const missed = filterMissedItems(session, results);
    if (missed.length === 0) return;
    setSession(missed);
    setCurrentIndex(0);
    setResults([]);
    setAnswer(emptyGNTAnswer());
    setCurrentResult(null);
    setIsReview(true);
    setPhase('question');
  }

  function handleSubmit() {
    const result = gradeGNTAnswer(session[currentIndex], answer);
    setCurrentResult(result);
    setPhase('feedback');
  }

  function handleNext() {
    if (!currentResult) return;
    const updated = [...results, currentResult];
    setResults(updated);
    if (currentIndex + 1 >= session.length) {
      // Persist cumulative parse history at session end
      const correct = updated.filter((r) => r.allCorrect).length;
      recordParseSession(passage.id, correct, updated.length);
      setPhase('results');
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswer(emptyGNTAnswer());
      setCurrentResult(null);
      setPhase('question');
    }
  }

  const sessionResults: SessionResults = {
    results: results.map((r) => ({
      tense: r.tense,
      voice: r.voice,
      mood: r.mood,
      person: r.person ?? true,
      number: r.number ?? true,
      allCorrect: r.allCorrect,
    })),
    total: session.length,
  };

  if (phase === 'question' && session[currentIndex]) {
    return (
      <div>
        <p className="text-center text-xs text-text-muted mb-4">{ref}</p>
        <GNTParseQuestion
          item={session[currentIndex]}
          index={currentIndex}
          total={session.length}
          answer={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  if (phase === 'feedback' && session[currentIndex] && currentResult) {
    return (
      <div>
        <p className="text-center text-xs text-text-muted mb-4">{ref}</p>
        <GNTFeedback
          item={session[currentIndex]}
          answer={answer}
          result={currentResult}
          onNext={handleNext}
          isLast={currentIndex + 1 >= session.length}
        />
      </div>
    );
  }

  if (phase === 'results') {
    return (
      <ParseResults
        sessionResults={sessionResults}
        onRetry={handleStart}
        onChangeSettings={() => {
          setPhase('select');
          setSession([]);
          setResults([]);
          setCurrentIndex(0);
          setIsReview(false);
        }}
        onReviewMissed={handleReviewMissed}
        isReview={isReview}
      />
    );
  }

  // Select phase
  return (
    <div className="max-w-lg mx-auto space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-1">
          Passage
        </h2>
        <p className="text-base font-semibold text-text">{ref}</p>
        <p className="mt-1 text-xs text-text-muted h-4">
          {loading && 'Loading…'}
          {!loading && verbCount === 0 && 'No verbs found in this passage.'}
          {!loading &&
            verbCount !== null &&
            verbCount > 0 &&
            `${verbCount} verb form${verbCount !== 1 ? 's' : ''} in this passage`}
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
          Forms per session
        </h2>
        <div className="flex gap-2">
          {SESSION_LENGTHS.map((n) => (
            <button
              key={n}
              onClick={() => setSessionLength(n)}
              disabled={n !== 'all' && verbCount !== null && verbCount < Number(n)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                sessionLength === n
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-bg-card bg-bg-card text-text-muted hover:border-[var(--color-accent)]',
              ].join(' ')}
            >
              {SESSION_LABELS[n]}
            </button>
          ))}
        </div>
      </section>

      <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          checked={skipRepeated}
          onChange={(e) => setSkipRepeated(e.target.checked)}
          className="w-4 h-4 rounded accent-[var(--color-accent)]"
        />
        <span className="text-sm text-text">Skip repeat verbs</span>
      </label>

      <button
        onClick={handleStart}
        disabled={loading || !verbCount || verbCount === 0}
        className={[
          'w-full py-3 rounded-xl text-base font-bold transition-colors',
          !loading && verbCount && verbCount > 0
            ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
            : 'bg-bg-card text-text-muted cursor-not-allowed',
        ].join(' ')}
      >
        {loading ? 'Loading…' : 'Start Parsing'}
      </button>
    </div>
  );
}
