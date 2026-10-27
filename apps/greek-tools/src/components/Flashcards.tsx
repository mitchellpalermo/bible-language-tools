import DrillButtons from '@tools/shared/components/DrillButtons';
import GradeButtons from '@tools/shared/components/GradeButtons';
import ToggleSwitch from '@tools/shared/components/ToggleSwitch';
import {
  type AnswerMode,
  type FlashcardSessionEvent,
  type FlashcardStorage,
  type StudyMode,
  useFlashcardSession,
} from '@tools/shared/use-flashcard-session';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CustomDeck, loadCustomDecks } from '../data/customDecks';
import {
  loadSRSStore,
  loadStats,
  newCard,
  normalizeKey,
  STREAK_THRESHOLD,
  saveSRSStore,
  saveStats,
} from '../data/srs';
import { type VocabWord, vocabulary } from '../data/vocabulary';
import { loadFlashcardSettings, saveFlashcardSettings } from '../lib/flashcard-settings';
import DeckBuilder from './DeckBuilder';
import ErrorBoundary from './ErrorBoundary';

// The session itself — dealing, grading, the drill modes, typed-answer state
// and the keyboard — is `useFlashcardSession` in @tools/shared (#87). This file
// is the Greek card, the deck and filter controls, the marking of a typed
// answer, and the mapping onto this app's storage keys and analytics events.

// ─── Types ────────────────────────────────────────────────────────────────────

const STUDY_MODES: { mode: StudyMode; label: string }[] = [
  { mode: 'srs', label: 'SRS Review' },
  { mode: 'all', label: 'Study All' },
  { mode: 'endless', label: 'Endless' },
];
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

/** The SRS store key for a word. */
const srsKey = (word: VocabWord) => normalizeKey(word.greek);

const STORAGE: FlashcardStorage = {
  loadStore: loadSRSStore,
  saveStore: saveSRSStore,
  loadStats,
  saveStats,
};

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

/** What the student is asked to produce: the back of the card. */
function expectedAnswer(word: VocabWord, direction: Direction): string {
  return direction === 'gr-en' ? word.gloss : word.greek;
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
  // Mode / direction
  const [studyMode, setStudyMode] = useState<StudyMode>('srs');
  const [answerMode, setAnswerMode] = useState<AnswerMode>('flip');
  const [direction, setDirection] = useState<Direction>('gr-en');

  // Filters
  const [freqFilter, setFreqFilter] = useState<FreqFilter>(DEFAULT_FREQ_PRESET.filter);
  const [posFilter, setPosFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Card face — how much of the card is visible before you answer. Distinct
  // from the part-of-speech *filter* above: that decides which words are in the
  // deck, this decides what a card gives away.
  const [showPartOfSpeech, setShowPartOfSpeech] = useState(
    () => loadFlashcardSettings().showPartOfSpeech,
  );

  const togglePartOfSpeech = useCallback(() => {
    setShowPartOfSpeech((prev) => {
      const next = !prev;
      saveFlashcardSettings({ showPartOfSpeech: next });
      return next;
    });
  }, []);

  // Custom decks
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>(() => loadCustomDecks());
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

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

  // ─── Session ─────────────────────────────────────────────────────────────────

  // The words of the active custom deck, so editing a deck's words deals a new
  // session and renaming it does not. Sorted: the same words in another order
  // are the same deck.
  const activeDeckWordKeys =
    activeDeckId !== null
      ? [...(customDecks.find((d) => d.id === activeDeckId)?.wordKeys ?? [])].sort()
      : [];

  const onEvent = (event: FlashcardSessionEvent) => {
    switch (event.type) {
      case 'session_started':
        posthog.capture('flashcard_session_started', {
          deck_size: event.deckSize,
          study_mode: event.studyMode,
        });
        break;
      case 'reviewed':
        posthog.capture('flashcard_reviewed', {
          result: event.result,
          grade: event.grade,
          interval_days: event.intervalDays,
        });
        break;
      case 'drilled':
        posthog.capture('flashcard_reviewed', {
          result: event.result,
          study_mode: event.studyMode,
          first_attempt: event.firstAttempt,
        });
        break;
      case 'missed_added_to_review':
        posthog.capture('flashcard_missed_added_to_review', {
          count: event.count,
          study_mode: event.studyMode,
        });
        break;
    }
  };

  const {
    card,
    index,
    queue,
    flipped,
    flip: handleFlip,
    revealed,
    typedAnswer,
    setTypedAnswer,
    answerResult,
    submitTyped: handleTypeSubmit,
    review: handleReview,
    drill: handleDrill,
    sessionScore,
    sessionDone,
    startSession,
    finish,
    srsStore,
    stats,
    dueCount,
    newCount,
    accuracy,
    missedNotInReview,
    addMissedToReview,
    addedToReview,
  } = useFlashcardSession<VocabWord, boolean>({
    words: filteredVocab,
    getKey: srsKey,
    studyMode,
    // The inputs that define the deck. Direction, answer mode and the card
    // face are left out: they change how a card is asked, not which cards.
    restartKey: JSON.stringify([freqFilter, posFilter, activeDeckId, activeDeckWordKeys]),
    storage: STORAGE,
    onEvent,
    answerMode,
    // Read at Check time, so the direction toggle applies to the card on screen.
    checkAnswer: (input, word) => checkAnswer(input, expectedAnswer(word, direction)),
  });

  // Keep the type input focused on every new card, so a typed session never
  // needs a tap between answers. `answerResult` covers a one-card Endless deck,
  // where the next round deals the same card back.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new card is the trigger
  useEffect(() => {
    if (answerMode === 'type' && !sessionDone && answerResult === null) {
      inputRef.current?.focus();
    }
  }, [answerMode, sessionDone, card, answerResult]);

  // ─── Derived values ──────────────────────────────────────────────────────────

  const front = card ? (direction === 'gr-en' ? card.greek : card.gloss) : '';
  const back = card ? expectedAnswer(card, direction) : '';
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
        {/* A drill never writes the schedule, so its misses would be gone by
            tomorrow. This is the bridge to spaced review: missed words not yet
            scheduled join SRS Review as new cards, due today. */}
        {studyMode !== 'srs' &&
          (addedToReview !== null ? (
            <p role="status" className="text-text-muted text-sm px-4">
              Added {addedToReview} {addedToReview === 1 ? 'word' : 'words'} to SRS Review.
              {addedToReview === 1 ? ' It comes' : ' They come'} up first in your next review.
            </p>
          ) : (
            missedNotInReview.length > 0 && (
              <div className="mx-auto max-w-sm bg-bg-card rounded-2xl border-2 border-indigo-100 px-4 py-4 space-y-3 shadow-sm">
                <p className="text-sm text-text">
                  You missed {missedNotInReview.length}{' '}
                  {missedNotInReview.length === 1 ? 'word that isn’t' : 'words that aren’t'} in your
                  review schedule yet. Add {missedNotInReview.length === 1 ? 'it' : 'them'} so{' '}
                  {missedNotInReview.length === 1 ? 'it keeps' : 'they keep'} coming back over the
                  next few weeks, not just today.
                </p>
                <button
                  type="button"
                  onClick={addMissedToReview}
                  className="px-4 py-2 bg-grape text-white rounded-lg hover:opacity-90 transition-opacity font-semibold text-sm shadow-sm"
                >
                  Add {missedNotInReview.length} to SRS Review
                </button>
              </div>
            )
          ))}
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
        {studyMode !== 'srs' && hasActiveFilters && (
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
          {STUDY_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setStudyMode(mode)}
              aria-pressed={studyMode === mode}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                studyMode === mode
                  ? 'bg-grape text-white shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {label}
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

          {/* Card face. The part of speech is on the answer side either way —
              this decides only whether it is also on the front. A switch rather
              than a button because it is a setting that stays put — and because
              the Part of Speech *filter* in the panel below is a row of chips,
              which this must not be mistaken for. */}
          <div className="flex items-center bg-white border border-indigo-100 px-3 py-1 rounded-xl shadow-sm">
            <ToggleSwitch
              checked={showPartOfSpeech}
              onChange={togglePartOfSpeech}
              label="Part of speech"
              accent="var(--color-grape, #7C3AED)"
              title="Show the part of speech on the front of the card. It is always shown with the answer."
            />
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
            ) : studyMode === 'endless' ? (
              <>
                {/* "Card x/y" means nothing when the deck never ends. */}
                <span>
                  Reviewed:{' '}
                  <strong className="text-grape" data-testid="session-reviewed">
                    {sessionScore.known + sessionScore.learning}
                  </strong>{' '}
                  this session
                </span>
                <span className="hidden sm:inline text-indigo-200">|</span>
              </>
            ) : (
              <>
                <span>
                  Card:{' '}
                  <strong className="text-grape" data-testid="card-progress">
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
        {/* The part of speech is a hint before the answer and a fact after it.
            With the toggle off it waits for the reveal rather than
            disappearing: "verb" narrows a word to a fraction of the lexicon,
            which is help you did not ask for while recalling, and worth having
            once you have. (In English → Greek the front is the gloss and there
            is no such line to withhold; the back carries it as before.) */}
        {direction === 'gr-en' && (showPartOfSpeech || revealed) && (
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
              answerResult ? 'bg-jade/5 border-jade/30' : 'bg-coral/5 border-coral/30'
            }`}
          >
            {answerResult ? (
              <p className="font-bold" style={{ color: 'var(--color-jade)' }}>
                Correct!
              </p>
            ) : (
              <>
                <p className="font-bold" style={{ color: 'var(--color-coral)' }}>
                  Not quite
                </p>
                <p className="text-text-muted text-sm mt-1">
                  Answer: <span className="font-semibold text-text">{back}</span>
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      {/* The SRS grades schedule the card, so they preview the interval each
          would buy. A drill schedules nothing, so its row asks only whether
          the card should come back this round.

          Type mode answers through the same row, and never on its own: every
          button stays live whether or not the typed answer matched. Checking
          says whether the spelling was right, not how hard the recall was,
          and the student is the one who knows — the same reason /write leaves
          every grade button live. */}
      {revealed &&
        (studyMode === 'srs' ? (
          <GradeButtons
            card={srsStore[srsKey(card)] ?? newCard(srsKey(card))}
            onGrade={handleReview}
          />
        ) : (
          <DrillButtons onAnswer={handleDrill} />
        ))}

      {/* ── Keyboard hints (desktop only) ────────────────────────────────── */}
      <p className="hidden sm:block text-xs text-text-muted text-center">
        Keyboard: <Kbd>{answerMode === 'flip' ? 'Space' : 'Enter'}</Kbd>{' '}
        {answerMode === 'flip' ? 'flip' : 'check answer'} · <Kbd>1</Kbd>–
        <Kbd>{studyMode === 'srs' ? '4' : '2'}</Kbd>{' '}
        {studyMode === 'srs' ? 'grade (Again, Hard, Good, Easy)' : 'answer (Missed, Got it)'}
      </p>

      {/* ── Footer controls ───────────────────────────────────────────────── */}
      <div className="flex justify-center gap-4 pt-1">
        <button
          onClick={startSession}
          className="text-sm text-text-muted hover:text-grape transition-colors font-medium"
        >
          Restart session
        </button>
        {/* Endless never ends by itself, so this is its way to the summary —
            and to the offer of putting missed words into SRS Review. */}
        {studyMode === 'endless' && (
          <button
            type="button"
            onClick={finish}
            className="text-sm text-text-muted hover:text-grape transition-colors font-medium"
          >
            Finish session
          </button>
        )}
        {/* Resetting lives on the account page, behind a typed confirmation. */}
        {studyMode === 'srs' && (
          <a
            href="/account#reset-progress"
            className="text-sm text-text-muted hover:text-grape transition-colors font-medium"
          >
            Manage SRS progress
          </a>
        )}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="bg-indigo-50 border border-indigo-100 px-1.5 rounded text-primary font-mono">
      {children}
    </kbd>
  );
}

export default function Flashcards() {
  return (
    <ErrorBoundary component="Flashcards">
      <FlashcardsInner />
    </ErrorBoundary>
  );
}
