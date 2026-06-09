import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FocusPassage } from '../data/focusPassages';
import { fetchBook } from '../data/morphgnt';
import {
  isDue,
  loadSRSStore,
  loadStats,
  newCard,
  nextSRS,
  normalizeKey,
  recordReview,
  type SRSCard,
  STREAK_THRESHOLD,
  saveSRSStore,
  saveStats,
} from '../data/srs';
import { type VocabWord, vocabulary } from '../data/vocabulary';
import { buildVocabMap, extractPassageLemmas } from '../lib/passage-deck';

type StudyMode = 'srs' | 'all';
type Direction = 'gr-en' | 'en-gr';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i - 1], dp[i]);
      prev = tmp;
    }
  }
  return dp[a.length];
}

function checkAnswer(input: string, gloss: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[()]/g, '').trim();
  const ans = norm(input);
  if (!ans) return false;
  const parts = gloss.split(/[,/]/).map(norm).filter(Boolean);
  return parts.some(
    (p) =>
      p === ans ||
      (ans.length >= 4 && p.startsWith(ans)) ||
      (p.length > 3 && levenshtein(p, ans) <= 1),
  );
}

function buildQueue(
  vocab: VocabWord[],
  mode: StudyMode,
  store: Record<string, SRSCard>,
): VocabWord[] {
  if (mode === 'all') return shuffle(vocab);
  const due: VocabWord[] = [];
  const fresh: VocabWord[] = [];
  for (const w of vocab) {
    const c = store[normalizeKey(w.greek)];
    if (!c) fresh.push(w);
    else if (isDue(c)) due.push(w);
  }
  return [...shuffle(due), ...shuffle(fresh)];
}

export default function FocusPassageVocab({ passage }: { passage: FocusPassage }) {
  const [passageVocab, setPassageVocab] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);

  const [srsStore, setSrsStore] = useState<Record<string, SRSCard>>(() => loadSRSStore());
  const [stats, setStats] = useState(() => loadStats());
  const srsStoreRef = useRef(srsStore);
  srsStoreRef.current = srsStore;

  const [studyMode, setStudyMode] = useState<StudyMode>('srs');
  const [direction, setDirection] = useState<Direction>('gr-en');
  const [answerMode, setAnswerMode] = useState<'flip' | 'type'>('flip');

  const [queue, setQueue] = useState<VocabWord[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState<'correct' | 'incorrect' | null>(null);
  const [sessionScore, setSessionScore] = useState({ known: 0, learning: 0 });
  const [sessionDone, setSessionDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load passage vocab
  useEffect(() => {
    setLoading(true);
    fetchBook(passage.book)
      .then((bookData) => {
        const vocabMap = buildVocabMap(vocabulary);
        const lemmaKeys = extractPassageLemmas(
          bookData,
          passage.startChapter,
          passage.startVerse,
          passage.endChapter,
          passage.endVerse,
          vocabMap,
        );
        const keySet = new Set(lemmaKeys);
        const filtered = vocabulary.filter((w) => keySet.has(normalizeKey(w.greek)));
        setPassageVocab(filtered);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [
    passage.book,
    passage.startChapter,
    passage.startVerse,
    passage.endChapter,
    passage.endVerse,
  ]);

  const startSession = useCallback(() => {
    if (passageVocab.length === 0) return;
    const q = buildQueue(passageVocab, studyMode, srsStoreRef.current);
    setQueue(q);
    setIndex(0);
    setFlipped(false);
    setTypedAnswer('');
    setAnswerResult(null);
    setSessionScore({ known: 0, learning: 0 });
    setSessionDone(false);
    posthog.capture('focus_vocab_session_started', { deck_size: q.length });
  }, [passageVocab, studyMode]);

  useEffect(() => {
    if (passageVocab.length > 0) startSession();
  }, [passageVocab, startSession]);

  const dueCount = useMemo(
    () =>
      passageVocab.filter((w) => {
        const c = srsStore[normalizeKey(w.greek)];
        return c ? isDue(c) : false;
      }).length,
    [passageVocab, srsStore],
  );
  const newCount = useMemo(
    () => passageVocab.filter((w) => !srsStore[normalizeKey(w.greek)]).length,
    [passageVocab, srsStore],
  );

  const card = queue[index];

  const handleReview = useCallback(
    (correct: boolean) => {
      if (!card) return;
      if (studyMode === 'srs') {
        setSrsStore((prev) => {
          const k = normalizeKey(card.greek);
          const existing = prev[k] ?? newCard(k);
          const updated = nextSRS(existing, correct ? 4 : 1);
          const next = { ...prev, [k]: updated };
          saveSRSStore(next);
          return next;
        });
      }
      setStats((prev) => {
        const next = recordReview(prev, correct);
        saveStats(next);
        return next;
      });
      setSessionScore((s) => ({
        known: s.known + (correct ? 1 : 0),
        learning: s.learning + (correct ? 0 : 1),
      }));
      if (index + 1 < queue.length) {
        setIndex((i) => i + 1);
        setFlipped(false);
        setTypedAnswer('');
        setAnswerResult(null);
      } else {
        setSessionDone(true);
      }
    },
    [card, studyMode, index, queue.length],
  );

  const handleFlip = useCallback(() => setFlipped((f) => !f), []);

  const handleTypeSubmit = useCallback(() => {
    if (!card || answerResult !== null) return;
    const expected = direction === 'gr-en' ? card.gloss : card.greek;
    const correct = checkAnswer(typedAnswer, expected);
    setAnswerResult(correct ? 'correct' : 'incorrect');
  }, [card, direction, typedAnswer, answerResult]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (sessionDone) return;
      if (answerMode === 'flip') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleFlip();
        }
        if (e.key === 'ArrowRight' && flipped) handleReview(true);
        if (e.key === 'ArrowLeft' && flipped) handleReview(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answerMode, flipped, sessionDone, handleFlip, handleReview]);

  useEffect(() => {
    if (answerMode === 'type' && !sessionDone) inputRef.current?.focus();
  }, [answerMode, sessionDone]);

  if (loading) {
    return <p className="text-text-muted text-center py-16">Loading vocabulary…</p>;
  }

  if (passageVocab.length === 0) {
    return (
      <p className="text-text-muted text-center py-16">
        No vocabulary words found in this passage.
      </p>
    );
  }

  const front = card ? (direction === 'gr-en' ? card.greek : card.gloss) : '';
  const back = card ? (direction === 'gr-en' ? card.gloss : card.greek) : '';
  const expectedAnswer = card ? (direction === 'gr-en' ? card.gloss : card.greek) : '';

  if (sessionDone) {
    const total = sessionScore.known + sessionScore.learning;
    const pct = total > 0 ? Math.round((sessionScore.known / total) * 100) : 0;
    return (
      <div className="text-center space-y-4 py-12">
        <div className="text-7xl font-bold" style={{ color: 'var(--color-grape)' }}>
          {pct}%
        </div>
        <h2 className="text-2xl font-bold text-text">Session Complete</h2>
        <p className="text-text-muted">
          {sessionScore.known} got it · {sessionScore.learning} still learning
        </p>
        <button
          onClick={startSession}
          className="px-5 py-2.5 bg-grape text-white rounded-lg hover:opacity-90 font-semibold shadow-sm"
        >
          Study Again
        </button>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-text-muted">
          {studyMode === 'srs'
            ? 'No cards due — all caught up!'
            : 'No cards match the current filters.'}
        </p>
        {studyMode === 'srs' && (
          <button
            onClick={() => setStudyMode('all')}
            className="px-5 py-2.5 bg-grape text-white rounded-lg hover:opacity-90 font-semibold"
          >
            Study all anyway
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-white border border-indigo-100 p-1 rounded-xl shadow-sm">
          {(['srs', 'all'] as StudyMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setStudyMode(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                studyMode === m
                  ? 'bg-grape text-white shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {m === 'srs' ? 'SRS Review' : 'Study All'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-white border border-indigo-100 p-1 rounded-xl shadow-sm">
            {(['gr-en', 'en-gr'] as Direction[]).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  direction === d
                    ? 'bg-grape text-white shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {d === 'gr-en' ? 'Gr → En' : 'En → Gr'}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white border border-indigo-100 p-1 rounded-xl shadow-sm">
            {(['flip', 'type'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setAnswerMode(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  answerMode === m
                    ? 'bg-grape text-white shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {m === 'flip' ? 'Flip' : 'Type'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-bg-card rounded-2xl border-2 border-indigo-100 px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-text-muted">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {studyMode === 'srs' ? (
              <>
                <span>
                  Due: <strong className="text-grape">{dueCount}</strong>
                </span>
                <span className="text-indigo-200">|</span>
                <span>
                  New: <strong className="text-primary">{newCount}</strong>
                </span>
                <span className="text-indigo-200">|</span>
              </>
            ) : (
              <>
                <span>
                  Card:{' '}
                  <strong className="text-grape">
                    {index + 1}/{queue.length}
                  </strong>
                </span>
                <span className="text-indigo-200">|</span>
              </>
            )}
            <span>
              Today:{' '}
              <strong className="text-text">
                {Math.min(stats.cardsStudiedToday, STREAK_THRESHOLD)}/{STREAK_THRESHOLD}
              </strong>
            </span>
          </div>
          <span className="text-xs shrink-0 font-medium">
            <span className="text-jade">✓ {sessionScore.known}</span>
            {' · '}
            <span className="text-coral">✗ {sessionScore.learning}</span>
          </span>
        </div>
      </div>

      {/* Card */}
      <div
        onClick={answerMode === 'flip' && !flipped ? handleFlip : undefined}
        className={`bg-bg-card rounded-2xl shadow-md border-2 border-indigo-100 px-4 py-6 sm:px-10 sm:py-8 text-center select-none min-h-[200px] flex flex-col items-center justify-center transition-all ${
          answerMode === 'flip' && !flipped
            ? 'cursor-pointer hover:shadow-lg hover:border-grape/30'
            : ''
        }`}
      >
        <p
          className="leading-tight"
          style={{
            fontSize: direction === 'gr-en' ? '3rem' : '1.8rem',
            fontFamily: direction === 'gr-en' ? 'var(--font-greek)' : 'var(--font-sans)',
            fontWeight: direction === 'gr-en' ? '700' : '600',
            color: direction === 'gr-en' ? 'var(--color-greek)' : 'var(--color-text)',
          }}
        >
          {front}
        </p>
        {direction === 'gr-en' && (
          <p className="text-text-muted text-sm mt-2 uppercase tracking-wide text-xs">
            {card.partOfSpeech}
          </p>
        )}

        {answerMode === 'flip' && !flipped && (
          <p className="text-text-muted/60 text-xs mt-6">
            <span className="sm:hidden">tap to reveal</span>
            <span className="hidden sm:inline">click or press space to reveal</span>
          </p>
        )}

        {answerMode === 'flip' && flipped && (
          <div className="mt-4 pt-4 border-t-2 border-indigo-50 w-full text-center">
            <p
              className="leading-tight"
              style={{
                fontSize: direction === 'en-gr' ? '3rem' : '1.8rem',
                fontFamily: direction === 'en-gr' ? 'var(--font-greek)' : 'var(--font-sans)',
                fontWeight: direction === 'en-gr' ? '700' : '600',
                color: direction === 'en-gr' ? 'var(--color-greek)' : 'var(--color-text)',
              }}
            >
              {back}
            </p>
          </div>
        )}

        {answerMode === 'type' && answerResult === null && (
          <div className="mt-6 flex flex-col sm:flex-row gap-2 w-full max-w-sm">
            <input
              ref={inputRef}
              type="text"
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTypeSubmit();
              }}
              placeholder={
                direction === 'gr-en' ? 'Type the English gloss…' : 'Type the Greek word…'
              }
              className="flex-1 px-3 py-2.5 border-2 border-indigo-100 rounded-xl focus:border-grape focus:outline-none text-base sm:text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={handleTypeSubmit}
              className="px-4 py-2.5 bg-grape text-white rounded-xl hover:opacity-90 text-sm font-semibold"
            >
              Check
            </button>
          </div>
        )}

        {answerMode === 'type' && answerResult !== null && (
          <div
            className={`mt-4 px-4 py-3 rounded-xl w-full max-w-sm text-center border-2 ${
              answerResult === 'correct' ? 'bg-jade/5 border-jade/30' : 'bg-coral/5 border-coral/30'
            }`}
          >
            {answerResult === 'correct' ? (
              <p className="font-bold" style={{ color: 'var(--color-jade)' }}>
                Correct!
              </p>
            ) : (
              <>
                <p className="font-bold" style={{ color: 'var(--color-coral)' }}>
                  Not quite
                </p>
                <p className="text-text-muted text-sm mt-1">
                  Answer: <span className="font-semibold text-text">{expectedAnswer}</span>
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {answerMode === 'flip' && flipped && (
        <div className="flex gap-3 sm:gap-4 sm:justify-center">
          <button
            onClick={() => handleReview(false)}
            className="flex-1 sm:flex-none px-6 py-3 sm:py-2.5 bg-coral/10 border-2 border-coral/30 text-coral rounded-xl hover:bg-coral/20 font-semibold"
          >
            ← Still Learning
          </button>
          <button
            onClick={() => handleReview(true)}
            className="flex-1 sm:flex-none px-6 py-3 sm:py-2.5 bg-jade/10 border-2 border-jade/30 text-jade rounded-xl hover:bg-jade/20 font-semibold"
          >
            Got It →
          </button>
        </div>
      )}

      {answerMode === 'type' && answerResult !== null && (
        <div className="flex gap-3 sm:gap-4 sm:justify-center">
          {answerResult === 'incorrect' && (
            <button
              onClick={() => handleReview(false)}
              className="flex-1 sm:flex-none px-6 py-3 sm:py-2.5 bg-coral/10 border-2 border-coral/30 text-coral rounded-xl hover:bg-coral/20 font-semibold"
            >
              ← Still Learning
            </button>
          )}
          <button
            onClick={() => handleReview(answerResult === 'correct')}
            className={`flex-1 sm:flex-none px-6 py-3 sm:py-2.5 rounded-xl border-2 font-semibold ${
              answerResult === 'correct'
                ? 'bg-jade/10 border-jade/30 text-jade hover:bg-jade/20'
                : 'bg-gray-100 border-gray-200 text-text hover:bg-gray-200'
            }`}
          >
            {answerResult === 'correct' ? 'Got It →' : 'Next →'}
          </button>
        </div>
      )}

      <div className="flex justify-center pt-1">
        <button
          onClick={startSession}
          className="text-sm text-text-muted hover:text-grape font-medium"
        >
          Restart session
        </button>
      </div>
    </div>
  );
}
