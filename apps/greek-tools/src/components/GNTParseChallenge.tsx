import { useEffect, useState } from 'react';
import type { MorphBook } from '../data/morphgnt';
import { fetchBook, fetchBooks } from '../data/morphgnt';
import type {
  GNTParseAnswer,
  GNTParseItem,
  GNTParseResult,
  GNTPassageSettings,
} from '../lib/gnt-parse';
import {
  DEFAULT_GNT_SETTINGS,
  deduplicateByLemma,
  emptyGNTAnswer,
  extractVerbs,
  filterMissedItems,
  formatRangeRef,
  gradeGNTAnswer,
  loadGNTSettings,
  sampleVerbs,
  saveGNTSettings,
} from '../lib/gnt-parse';
import ErrorBoundary from './ErrorBoundary';
import GNTFeedback from './GNTFeedback';
import GNTParseQuestion from './GNTParseQuestion';
import type { SessionResults } from './ParseResults';
import ParseResults from './ParseResults';
import PassageSelector from './PassageSelector';

type Phase = 'select' | 'question' | 'feedback' | 'results';

function GNTParseChallengeInner() {
  const [settings, setSettings] = useState<GNTPassageSettings>(DEFAULT_GNT_SETTINGS);
  const [bookData, setBookData] = useState<MorphBook | null>(null);
  const [bookName, setBookName] = useState('John');
  const [verbCount, setVerbCount] = useState<number | null>(null);
  const [verseCount, setVerseCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('select');
  const [session, setSession] = useState<GNTParseItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState<GNTParseAnswer>(emptyGNTAnswer());
  const [results, setResults] = useState<GNTParseResult[]>([]);
  const [currentResult, setCurrentResult] = useState<GNTParseResult | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isReview, setIsReview] = useState(false);

  // Load settings on mount
  useEffect(() => {
    setSettings(loadGNTSettings());
    setSettingsLoaded(true);
  }, []);

  // Fetch book data whenever book or chapter changes; recount verbs when range changes
  useEffect(() => {
    if (!settingsLoaded) return;
    setVerbCount(null);
    setVerseCount(null);
    setLoading(true);
    Promise.all([fetchBook(settings.book), fetchBooks()])
      .then(([data, books]) => {
        setBookData(data);
        const meta = books.find((b) => b.code === settings.book);
        if (meta) setBookName(meta.name);
        const chapterData = data[String(settings.chapter)];
        const numVerses = chapterData ? Object.keys(chapterData).length : 0;
        setVerseCount(numVerses);
        let verbs = extractVerbs(
          data,
          String(settings.chapter),
          meta?.name ?? settings.book,
          settings.verseStart,
          settings.verseEnd,
        );
        if (settings.skipRepeatedLemmas) verbs = deduplicateByLemma(verbs);
        setVerbCount(verbs.length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [
    settings.book,
    settings.chapter,
    settings.verseStart,
    settings.verseEnd,
    settings.skipRepeatedLemmas,
    settingsLoaded,
  ]);

  function handleSettingsChange(s: GNTPassageSettings) {
    setSettings(s);
    saveGNTSettings(s);
  }

  function handleStart() {
    if (!bookData) return;
    let all = extractVerbs(
      bookData,
      String(settings.chapter),
      bookName,
      settings.verseStart,
      settings.verseEnd,
    );
    if (settings.skipRepeatedLemmas) all = deduplicateByLemma(all);
    const count = settings.sessionLength === 'all' ? all.length : settings.sessionLength;
    const items = sampleVerbs(all, count);
    if (items.length === 0) return;
    setSession(items);
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
      setPhase('results');
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswer(emptyGNTAnswer());
      setCurrentResult(null);
      setPhase('question');
    }
  }

  // Adapt GNTParseResult[] → ParseResult[] for the shared ParseResults component
  const sessionResults: SessionResults = {
    results: results.map((r) => ({
      tense: r.tense,
      voice: r.voice,
      mood: r.mood,
      // For person/number/case/gender: count nulls as correct (not graded)
      person: r.person ?? true,
      number: r.number ?? true,
      allCorrect: r.allCorrect,
    })),
    total: session.length,
  };

  if (!settingsLoaded) return null;

  const sessionRef =
    verseCount !== null
      ? formatRangeRef(
          bookName,
          settings.chapter,
          settings.verseStart,
          settings.verseEnd,
          verseCount,
        )
      : `${bookName} ${settings.chapter}`;

  if (phase === 'select') {
    return (
      <PassageSelector
        settings={settings}
        verbCount={verbCount}
        verseCount={verseCount}
        onChange={handleSettingsChange}
        onStart={handleStart}
        loading={loading}
      />
    );
  }

  if (phase === 'question' && session[currentIndex]) {
    return (
      <div>
        <p className="text-center text-xs text-text-muted mb-4">{sessionRef}</p>
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
        <p className="text-center text-xs text-text-muted mb-4">{sessionRef}</p>
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

  return null;
}

export default function GNTParseChallenge() {
  return (
    <ErrorBoundary component="GNTParseChallenge">
      <GNTParseChallengeInner />
    </ErrorBoundary>
  );
}
