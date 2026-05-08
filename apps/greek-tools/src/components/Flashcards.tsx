import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CustomDeck, loadCustomDecks } from '../data/customDecks';
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
import DeckBuilder from './DeckBuilder';
import ErrorBoundary from './ErrorBoundary';

// ─── Types ────────────────────────────────────────────────────────────────────

type StudyMode = 'srs' | 'all';
type AnswerMode = 'flip' | 'type';
type Direction = 'gr-en' | 'en-gr';
type FreqFilter = 'all' | '500+' | '100-499' | '50-99' | '<50';

// ─── Frequency presets ────────────────────────────────────────────────────────

export const FREQ_PRESETS = [
  { id: 'all', label: 'All', filter: 'all' as FreqFilter },
  { id: 'top', label: 'Top 100', filter: '500+' as FreqFilter },
  { id: 'mid-hi', label: '101–300', filter: '100-499' as FreqFilter },
  { id: 'mid', label: '301–500', filter: '50-99' as FreqFilter },
  { id: 'rare', label: '500+', filter: '<50' as FreqFilter },
] as const;

export const DEFAULT_FREQ_PRESET = FREQ_PRESETS[1]; // Top 100 (500+ occurrences)

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function matchFreq(freq: number, f: FreqFilter): boolean {
  if (f === 'all') return true;
  if (f === '500+') return freq >= 500;
  if (f === '100-499') return freq >= 100 && freq < 500;
  if (f === '50-99') return freq >= 50 && freq < 100;
  return freq < 50;
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
  // Due cards first (shuffled), then new cards (shuffled)
  return [...shuffle(due), ...shuffle(fresh)];
}

// ─── Part-of-speech options present in the vocabulary ─────────────────────────

const ALL_POS = [
  'noun',
  'verb',
  'adjective',
  'pronoun',
  'preposition',
  'conjunction',
  'adverb',
  'article',
];

// ─── Component ────────────────────────────────────────────────────────────────

function FlashcardsInner() {
  // Persistent state (localStorage)
  const [srsStore, setSrsStore] = useState<Record<string, SRSCard>>(() => loadSRSStore());
  const [stats, setStats] = useState(() => loadStats());

  // Mode / direction
  const [studyMode, setStudyMode] = useState<StudyMode>('srs');
  const [answerMode, setAnswerMode] = useState<AnswerMode>('flip');
  const [direction, setDirection] = useState<Direction>('gr-en');

  // Filters
  const [freqFilter, setFreqFilter] = useState<FreqFilter>(DEFAULT_FREQ_PRESET.filter);
  const [posFilter, setPosFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Custom decks
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>(() => loadCustomDecks());
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);

  // Session state
  const [queue, setQueue] = useState<VocabWord[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState<'correct' | 'incorrect' | null>(null);
  const [sessionScore, setSessionScore] = useState({ known: 0, learning: 0 });
  const [sessionDone, setSessionDone] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  // Keep a ref to srsStore so buildQueue always uses latest without deps
  const srsStoreRef = useRef(srsStore);
  srsStoreRef.current = srsStore;

  // ─── Filtered vocabulary ────────────────────────────────────────────────────

  const filteredVocab = useMemo(() => {
    if (activeDeckId !== null) {
      const deck = customDecks.find((d) => d.id === activeDeckId);
      if (!deck) return [];
      const keySet = new Set(deck.wordKeys);
      return vocabulary.filter(
        (w) =>
          keySet.has(normalizeKey(w.greek)) &&
          (posFilter.length === 0 || posFilter.includes(w.partOfSpeech)),
      );
    }
    return vocabulary.filter(
      (w) =>
        matchFreq(w.frequency, freqFilter) &&
        (posFilter.length === 0 || posFilter.includes(w.partOfSpeech)),
    );
  }, [freqFilter, posFilter, activeDeckId, customDecks]);

  // SRS stats for display
  const dueCount = useMemo(
    () =>
      filteredVocab.filter((w) => {
        const c = srsStore[normalizeKey(w.greek)];
        return c ? isDue(c) : false;
      }).length,
    [filteredVocab, srsStore],
  );
  const newCount = useMemo(
    () => filteredVocab.filter((w) => !srsStore[normalizeKey(w.greek)]).length,
    [filteredVocab, srsStore],
  );

  // ─── Session management ─────────────────────────────────────────────────────

  const startSession = useCallback(() => {
    const queue = buildQueue(filteredVocab, studyMode, srsStoreRef.current);
    setQueue(queue);
    setIndex(0);
    setFlipped(false);
    setTypedAnswer('');
    setAnswerResult(null);
    setSessionScore({ known: 0, learning: 0 });
    setSessionDone(false);
    posthog.capture('flashcard_session_started', { deck_size: queue.length });
  }, [filteredVocab, studyMode]);

  // Mount: start initial session
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    startSession();
  }, [startSession]);

  // Restart when mode or filters change (not on srsStore changes)
  const posFilterKey = posFilter.join(',');
  const activeDeckWordKeysKey =
    activeDeckId !== null
      ? (customDecks.find((d) => d.id === activeDeckId)?.wordKeys.join(',') ?? '')
      : '';
  const prevStudyMode = useRef(studyMode);
  const prevFreqFilter = useRef(freqFilter);
  const prevPosFilterKey = useRef(posFilterKey);
  const prevActiveDeckId = useRef(activeDeckId);
  const prevActiveDeckWordKeysKey = useRef(activeDeckWordKeysKey);

  useEffect(() => {
    if (
      studyMode !== prevStudyMode.current ||
      freqFilter !== prevFreqFilter.current ||
      posFilterKey !== prevPosFilterKey.current ||
      activeDeckId !== prevActiveDeckId.current ||
      activeDeckWordKeysKey !== prevActiveDeckWordKeysKey.current
    ) {
      prevStudyMode.current = studyMode;
      prevFreqFilter.current = freqFilter;
      prevPosFilterKey.current = posFilterKey;
      prevActiveDeckId.current = activeDeckId;
      prevActiveDeckWordKeysKey.current = activeDeckWordKeysKey;
      startSession();
    }
  });

  // ─── Review handler ─────────────────────────────────────────────────────────

  const card = queue[index];

  const handleReview = useCallback(
    (correct: boolean) => {
      if (!card) return;

      const intervalDays = srsStore[normalizeKey(card.greek)]?.interval ?? 0;

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

      posthog.capture('flashcard_reviewed', {
        result: correct ? 'correct' : 'incorrect',
        interval_days: intervalDays,
      });

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
    [card, studyMode, srsStore, index, queue.length],
  );

  const handleFlip = useCallback(() => setFlipped((f) => !f), []);

  const handleTypeSubmit = useCallback(() => {
    if (!card || answerResult !== null) return;
    const expected = direction === 'gr-en' ? card.gloss : card.greek;
    const correct = checkAnswer(typedAnswer, expected);
    setAnswerResult(correct ? 'correct' : 'incorrect');
  }, [card, direction, typedAnswer, answerResult]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────

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

  // Focus type input when card changes
  useEffect(() => {
    if (answerMode === 'type' && !sessionDone) {
      inputRef.current?.focus();
    }
  }, [answerMode, sessionDone]);

  // ─── Derived values ──────────────────────────────────────────────────────────

  const accuracy =
    stats.totalReviewed > 0 ? Math.round((stats.totalCorrect / stats.totalReviewed) * 100) : null;
  const front = card ? (direction === 'gr-en' ? card.greek : card.gloss) : '';
  const back = card ? (direction === 'gr-en' ? card.gloss : card.greek) : '';
  const expectedAnswer = card ? (direction === 'gr-en' ? card.gloss : card.greek) : '';
  const hasActiveFilters = freqFilter !== 'all' || posFilter.length > 0 || activeDeckId !== null;
  const activePreset = FREQ_PRESETS.find((p) => p.filter === freqFilter) ?? FREQ_PRESETS[0];

  // ─── Session complete screen ─────────────────────────────────────────────────

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
        {studyMode === 'srs' && dueCount === 0 && newCount === 0 && (
          <p className="text-text-muted text-sm">
            You're all caught up! Check back tomorrow for more reviews.
          </p>
        )}
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2 px-4 sm:px-0">
          <button
            onClick={startSession}
            className="px-5 py-3 sm:py-2.5 bg-grape text-white rounded-lg hover:opacity-90 transition-opacity font-semibold shadow-sm"
          >
            Study Again
          </button>
          {studyMode === 'srs' && (
            <button
              onClick={() => setStudyMode('all')}
              className="px-5 py-3 sm:py-2.5 border-2 border-grape/30 text-grape rounded-lg hover:bg-grape/5 transition-colors font-medium"
            >
              Study All Cards
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────────────────────

  if (!card) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-lg text-text-muted">
          {studyMode === 'srs'
            ? "You're all caught up — no cards due for review."
            : 'No cards match the current filters.'}
        </p>
        {studyMode === 'srs' && (
          <button
            onClick={() => setStudyMode('all')}
            className="px-5 py-2.5 bg-grape text-white rounded-lg hover:opacity-90 transition-opacity font-semibold shadow-sm"
          >
            Study ahead anyway
          </button>
        )}
        {studyMode === 'all' && hasActiveFilters && (
          <button
            onClick={() => {
              setFreqFilter('all');
              setPosFilter([]);
              setActiveDeckId(null);
            }}
            className="px-5 py-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Top controls bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Study mode */}
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
          {/* Direction */}
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
                {d === 'gr-en' ? 'Greek → English' : 'English → Greek'}
              </button>
            ))}
          </div>

          {/* Answer mode */}
          <div className="flex gap-1 bg-white border border-indigo-100 p-1 rounded-xl shadow-sm">
            {(['flip', 'type'] as AnswerMode[]).map((m) => (
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

          {/* Filters toggle */}
          <button
            onClick={() => {
              setShowFilters((f) => !f);
              setShowDeckBuilder(false);
            }}
            aria-label="Toggle filters"
            className={`px-3 py-1.5 rounded-xl text-sm border-2 font-semibold transition-colors ${
              hasActiveFilters
                ? 'border-grape text-grape bg-grape/5'
                : showFilters
                  ? 'border-gray-300 text-text bg-gray-50'
                  : 'border-gray-200 text-text-muted hover:border-grape/40'
            }`}
          >
            {freqFilter !== 'all' ? activePreset.label : 'Filters'}
            {hasActiveFilters ? ' ●' : ''}
          </button>
        </div>
      </div>

      {/* ── Preset selector ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider shrink-0">
          Preset
        </span>
        {FREQ_PRESETS.map((preset) => {
          const active = freqFilter === preset.filter;
          const count =
            preset.filter !== 'all'
              ? vocabulary.filter((w) => matchFreq(w.frequency, preset.filter)).length
              : null;
          return (
            <button
              key={preset.id}
              onClick={() => setFreqFilter(preset.filter)}
              aria-pressed={active}
              className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
                active
                  ? 'bg-grape text-white border-grape'
                  : 'border-indigo-100 text-text-muted hover:border-grape/40 hover:text-text'
              }`}
            >
              {preset.label}
              {count !== null && (
                <span className={`ml-1 text-xs ${active ? 'text-white/70' : 'text-text-muted'}`}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── My Decks row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider shrink-0">
          My Decks
        </span>
        {customDecks.map((deck) => {
          const active = activeDeckId === deck.id;
          return (
            <button
              key={deck.id}
              onClick={() => setActiveDeckId(active ? null : deck.id)}
              aria-pressed={active}
              className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
                active
                  ? 'bg-grape text-white border-grape'
                  : 'border-indigo-100 text-text-muted hover:border-grape/40 hover:text-text'
              }`}
            >
              {deck.name}
              <span className={`ml-1 text-xs ${active ? 'text-white/70' : 'text-text-muted'}`}>
                ({deck.wordKeys.length})
              </span>
            </button>
          );
        })}
        <button
          onClick={() => {
            setShowDeckBuilder((d) => !d);
            setShowFilters(false);
          }}
          aria-label="Manage custom decks"
          className={`px-3 py-1 rounded-full text-sm border-2 border-dashed font-medium transition-colors ${
            showDeckBuilder
              ? 'border-grape/40 text-grape bg-grape/5'
              : 'border-indigo-200 text-text-muted hover:border-grape/40 hover:text-text'
          }`}
        >
          {customDecks.length === 0 ? '+ Create deck' : 'Manage'}
        </button>
      </div>

      {/* ── Filter panel ──────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-bg-card rounded-2xl border-2 border-indigo-100 p-4 space-y-4 shadow-sm">
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              Frequency (occurrences in GNT)
            </p>
            <div className="flex flex-wrap gap-2">
              {(['all', '500+', '100-499', '50-99', '<50'] as FreqFilter[]).map((f) => {
                const count = vocabulary.filter((w) => matchFreq(w.frequency, f)).length;
                return (
                  <button
                    key={f}
                    onClick={() => setFreqFilter(f)}
                    className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
                      freqFilter === f
                        ? 'bg-grape text-white border-grape'
                        : 'border-indigo-100 text-text-muted hover:border-grape/40 hover:text-text'
                    }`}
                  >
                    {f === 'all' ? 'All' : `${f}×`}{' '}
                    <span
                      className={`text-xs ${freqFilter === f ? 'text-white/70' : 'text-text-muted'}`}
                    >
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
              Part of Speech
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_POS.map((pos) => {
                const count = vocabulary.filter((w) => w.partOfSpeech === pos).length;
                if (count === 0) return null;
                const active = posFilter.includes(pos);
                return (
                  <button
                    key={pos}
                    onClick={() =>
                      setPosFilter((prev) =>
                        active ? prev.filter((p) => p !== pos) : [...prev, pos],
                      )
                    }
                    className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
                      active
                        ? 'bg-grape text-white border-grape'
                        : 'border-indigo-100 text-text-muted hover:border-grape/40 hover:text-text'
                    }`}
                  >
                    {pos}{' '}
                    <span className={`text-xs ${active ? 'text-white/70' : 'text-text-muted'}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-text-muted">
              <strong className="text-text">{filteredVocab.length}</strong> words match
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFreqFilter('all');
                  setPosFilter([]);
                  setActiveDeckId(null);
                }}
                className="text-sm text-coral hover:opacity-80 font-semibold transition-opacity"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Deck builder panel ───────────────────────────────────────────── */}
      {showDeckBuilder && (
        <DeckBuilder
          decks={customDecks}
          activeDeckId={activeDeckId}
          onActivateDeck={(id) => {
            setActiveDeckId(id);
            setShowDeckBuilder(false);
          }}
          onDecksChange={setCustomDecks}
          onClose={() => setShowDeckBuilder(false)}
        />
      )}

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="bg-bg-card rounded-2xl border-2 border-indigo-100 px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-text-muted">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {studyMode === 'srs' ? (
              <>
                <span>
                  Due: <strong className="text-grape">{dueCount}</strong>
                </span>
                <span className="hidden sm:inline text-indigo-200">|</span>
                <span>
                  New: <strong className="text-primary">{newCount}</strong>
                </span>
                <span className="hidden sm:inline text-indigo-200">|</span>
              </>
            ) : (
              <>
                <span>
                  Card:{' '}
                  <strong className="text-grape">
                    {index + 1}/{queue.length}
                  </strong>
                </span>
                <span className="hidden sm:inline text-indigo-200">|</span>
              </>
            )}
            <span>
              Today:{' '}
              <strong className="text-text">
                {Math.min(stats.cardsStudiedToday, STREAK_THRESHOLD)}/{STREAK_THRESHOLD}
              </strong>
            </span>
            <span className="hidden sm:inline text-indigo-200">|</span>
            <span>
              Streak: <strong className="text-accent">{stats.streak}d</strong>
              {stats.cardsStudiedToday >= STREAK_THRESHOLD && (
                <span className="ml-1 text-jade text-xs font-bold">✓</span>
              )}
            </span>
            {accuracy !== null && (
              <>
                <span className="hidden sm:inline text-indigo-200">|</span>
                <span>
                  Accuracy: <strong className="text-text">{accuracy}%</strong>
                </span>
              </>
            )}
          </div>
          <span className="text-xs shrink-0 font-medium">
            <span className="text-jade">✓ {sessionScore.known}</span>
            {' · '}
            <span className="text-coral">✗ {sessionScore.learning}</span>
          </span>
        </div>
      </div>

      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <div
        onClick={answerMode === 'flip' && !flipped ? handleFlip : undefined}
        className={`bg-bg-card rounded-2xl shadow-md border-2 border-indigo-100 px-4 py-6 sm:px-10 sm:py-8 text-center select-none min-h-[200px] sm:min-h-[220px] flex flex-col items-center justify-center transition-all ${
          answerMode === 'flip' && !flipped
            ? 'cursor-pointer active:shadow-lg hover:shadow-lg hover:border-grape/30'
            : ''
        }`}
      >
        {/* Front side */}
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
          <p className="text-text-muted text-sm mt-2 font-medium uppercase tracking-wide text-xs">
            {card.partOfSpeech}
          </p>
        )}

        {/* Flip mode: reveal hint */}
        {answerMode === 'flip' && !flipped && (
          <p className="text-text-muted/60 text-xs mt-6">
            <span className="sm:hidden">tap to reveal</span>
            <span className="hidden sm:inline">click or press space to reveal</span>
          </p>
        )}

        {/* Flip mode: back side */}
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
            <p className="text-text-muted text-xs mt-2 uppercase tracking-wide font-medium">
              {direction === 'gr-en'
                ? `occurs ${card.frequency.toLocaleString()}× in GNT`
                : card.partOfSpeech}
            </p>
          </div>
        )}

        {/* Type mode: input */}
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
              className="px-4 py-2.5 bg-grape text-white rounded-xl hover:opacity-90 text-sm font-semibold transition-opacity shadow-sm"
            >
              Check
            </button>
          </div>
        )}

        {/* Type mode: result feedback */}
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

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      {answerMode === 'flip' && flipped && (
        <div className="flex gap-3 sm:gap-4 sm:justify-center">
          <button
            onClick={() => handleReview(false)}
            className="flex-1 sm:flex-none px-6 py-3 sm:py-2.5 bg-coral/10 border-2 border-coral/30 text-coral rounded-xl hover:bg-coral/20 active:bg-coral/20 transition-colors font-semibold"
          >
            ← Still Learning
          </button>
          <button
            onClick={() => handleReview(true)}
            className="flex-1 sm:flex-none px-6 py-3 sm:py-2.5 bg-jade/10 border-2 border-jade/30 text-jade rounded-xl hover:bg-jade/20 active:bg-jade/20 transition-colors font-semibold"
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
              className="flex-1 sm:flex-none px-6 py-3 sm:py-2.5 bg-coral/10 border-2 border-coral/30 text-coral rounded-xl hover:bg-coral/20 active:bg-coral/20 transition-colors font-semibold"
            >
              ← Still Learning
            </button>
          )}
          <button
            onClick={() => handleReview(answerResult === 'correct')}
            className={`flex-1 sm:flex-none px-6 py-3 sm:py-2.5 rounded-xl border-2 transition-colors font-semibold ${
              answerResult === 'correct'
                ? 'bg-jade/10 border-jade/30 text-jade hover:bg-jade/20 active:bg-jade/20'
                : 'bg-gray-100 border-gray-200 text-text hover:bg-gray-200 active:bg-gray-200'
            }`}
          >
            {answerResult === 'correct' ? 'Got It →' : 'Next →'}
          </button>
        </div>
      )}

      {/* ── Keyboard hints (desktop only) ────────────────────────────────── */}
      {answerMode === 'flip' && (
        <p className="hidden sm:block text-xs text-text-muted text-center">
          Keyboard:{' '}
          <kbd className="bg-indigo-50 border border-indigo-100 px-1.5 rounded text-primary font-mono">
            Space
          </kbd>{' '}
          flip ·{' '}
          <kbd className="bg-indigo-50 border border-indigo-100 px-1.5 rounded text-primary font-mono">
            →
          </kbd>{' '}
          got it ·{' '}
          <kbd className="bg-indigo-50 border border-indigo-100 px-1.5 rounded text-primary font-mono">
            ←
          </kbd>{' '}
          still learning
        </p>
      )}
      {answerMode === 'type' && (
        <p className="hidden sm:block text-xs text-text-muted text-center">
          Keyboard:{' '}
          <kbd className="bg-indigo-50 border border-indigo-100 px-1.5 rounded text-primary font-mono">
            Enter
          </kbd>{' '}
          check answer
        </p>
      )}

      {/* ── Footer controls ───────────────────────────────────────────────── */}
      <div className="flex justify-center gap-4 pt-1">
        <button
          onClick={startSession}
          className="text-sm text-text-muted hover:text-grape transition-colors font-medium"
        >
          Restart session
        </button>
        {studyMode === 'srs' && (
          <button
            onClick={() => {
              if (confirm('Reset all SRS progress? This cannot be undone.')) {
                setSrsStore({});
                saveSRSStore({});
                startSession();
              }
            }}
            className="text-sm text-text-muted hover:text-coral transition-colors font-medium"
          >
            Reset SRS
          </button>
        )}
      </div>
    </div>
  );
}

export default function Flashcards() {
  return (
    <ErrorBoundary component="Flashcards">
      <FlashcardsInner />
    </ErrorBoundary>
  );
}
