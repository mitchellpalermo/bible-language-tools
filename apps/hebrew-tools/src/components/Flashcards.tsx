import DeckBuilder from '@tools/shared/components/DeckBuilder';
import DrillButtons from '@tools/shared/components/DrillButtons';
import GradeButtons from '@tools/shared/components/GradeButtons';
import ToggleSwitch from '@tools/shared/components/ToggleSwitch';
import { type CustomDeck, deckRestartPart, findDeck } from '@tools/shared/custom-decks';
import {
  type FlashcardSessionEvent,
  type FlashcardStorage,
  type StudyMode,
  useFlashcardSession,
} from '@tools/shared/use-flashcard-session';
import posthog from 'posthog-js';
import { useCallback, useMemo, useState } from 'react';
import {
  loadSRSStore,
  loadStats,
  newCard,
  normalizeKey,
  STREAK_THRESHOLD,
  saveSRSStore,
  saveStats,
} from '../data/srs';
import {
  categoryCounts,
  chapterStats,
  describeChapters,
  TEXTBOOK_IDS,
  TEXTBOOKS,
  type TextbookId,
  VOCAB_CATEGORIES,
  wordsInChapters,
} from '../data/textbooks';
import { cardKey, type HebrewVocabWord, vocabulary } from '../data/vocabulary';
import { builderWords, customDeckStore, wordsOfDeck } from '../lib/custom-decks';
import {
  type DeckSelection,
  effectiveSelection,
  loadSelection,
  saveSelection,
} from '../lib/deck-selection';
import { loadFlashcardSettings, saveFlashcardSettings } from '../lib/flashcard-settings';
import ChapterPicker from './ChapterPicker';
import ErrorBoundary from './ErrorBoundary';
import VocabCard from './VocabCard';

// Phase 2b scope: SRS, "all" and "endless" study modes, flip answer mode, Hebrew -> English
// direction, a frequency-band filter, and textbook chapter decks. Typing mode,
// the reverse direction, and part-of-speech/root filters are Phase 2c (#74).
//
// The session itself — dealing, grading, drills, the keyboard — is
// `useFlashcardSession` in @tools/shared (#87). This file is the Hebrew card,
// the deck and filter controls, and the mapping onto this app's storage keys
// and analytics events.

// ─── Types ────────────────────────────────────────────────────────────────────

const STUDY_MODES: { mode: StudyMode; label: string }[] = [
  { mode: 'srs', label: 'SRS Review' },
  { mode: 'all', label: 'Study All' },
  { mode: 'endless', label: 'Endless' },
];
type FreqFilter = 'all' | '2000+' | '500-1999' | '100-499' | '<100';

/** The SRS store key for a word. Homographs are separated by `cardKey`. */
const srsKey = (word: HebrewVocabWord) => normalizeKey(cardKey(word));

export const FREQ_FILTERS: { filter: FreqFilter; label: string }[] = [
  { filter: 'all', label: 'All' },
  { filter: '2000+', label: '2000+' },
  { filter: '500-1999', label: '500–1999' },
  { filter: '100-499', label: '100–499' },
  { filter: '<100', label: '<100' },
];

export { GENDER_LABELS } from './VocabCard';

// Chapter statistics are derived from static vocabulary data, so they're
// computed once at module scope rather than on every render.
const CHAPTER_STATS = Object.fromEntries(
  TEXTBOOK_IDS.map((id) => [id, chapterStats(id)]),
) as Record<TextbookId, ReturnType<typeof chapterStats>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Frequency bands only apply to words that have a count. Most now do — the
 * textbook import carries real occurrence counts over the Westminster Leningrad
 * Codex (see `vocabulary-garrett.ts`) — but the inflected and reading-vocabulary
 * cards deliberately do not, because their front is a form and the count would
 * be a fact about the lexeme behind it. Such a word is not "rare", it is
 * unmeasured, and putting it in the `<100` bucket would assert something the
 * data does not say.
 */
export function matchFreq(freq: number | undefined, f: FreqFilter): boolean {
  if (f === 'all') return true;
  if (freq === undefined) return false;
  if (f === '2000+') return freq >= 2000;
  if (f === '500-1999') return freq >= 500 && freq < 2000;
  if (f === '100-499') return freq >= 100 && freq < 500;
  return freq < 100;
}

const STORAGE: FlashcardStorage = {
  loadStore: loadSRSStore,
  saveStore: saveSRSStore,
  loadStats,
  saveStats,
};

// ─── Component ────────────────────────────────────────────────────────────────

function FlashcardsInner() {
  // Mode
  const [studyMode, setStudyMode] = useState<StudyMode>('srs');

  // Deck, chapters and categories — persisted across visits.
  const [storedSelection, setSelection] = useState<DeckSelection>(() => loadSelection());

  // The student's own decks. Read in an initializer: the first render is the
  // empty state either way, so this cannot differ from the server's (see
  // "Hydration" in the repo CLAUDE.md).
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>(() => customDeckStore.load());
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);

  // A custom deck that was deleted, here or on another device, is no deck.
  const selection = useMemo(
    () => effectiveSelection(storedSelection, customDecks),
    [storedSelection, customDecks],
  );
  const customDeck = findDeck(customDecks, selection.customDeckId);
  const builderVocabulary = useMemo(() => builderWords(), []);

  // Filter (only meaningful for the whole-vocabulary deck)
  const [freqFilter, setFreqFilter] = useState<FreqFilter>('all');

  // Card face — how much of the card is visible before you answer.
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

  const updateSelection = useCallback((patch: Partial<DeckSelection>) => {
    setSelection((prev) => {
      const next = { ...prev, ...patch };
      saveSelection(next);
      return next;
    });
  }, []);

  // ─── Filtered vocabulary ────────────────────────────────────────────────────

  const textbookId =
    selection.deck === 'all' || selection.deck === 'custom' ? null : selection.deck;

  // A textbook or custom selection is already a deliberate set, so the
  // frequency bands don't apply to it — they only narrow the whole vocabulary.
  const filteredVocab = useMemo(() => {
    if (customDeck) return wordsOfDeck(customDeck);
    return textbookId
      ? wordsInChapters(textbookId, selection.chapters, selection.categories)
      : vocabulary.filter((w) => matchFreq(w.frequency, freqFilter));
  }, [customDeck, textbookId, selection.chapters, selection.categories, freqFilter]);

  // Counts for the category chips reflect the chapters currently selected, so
  // switching a category on shows exactly how many cards it would add.
  const catCounts = useMemo(
    () => (textbookId ? categoryCounts(textbookId, selection.chapters) : null),
    [textbookId, selection.chapters],
  );

  // ─── Session ─────────────────────────────────────────────────────────────────

  const onEvent = (event: FlashcardSessionEvent) => {
    switch (event.type) {
      case 'session_started':
        posthog.capture('hebrew_flashcard_session_started', {
          deck_size: event.deckSize,
          deck: selection.deck === 'all' ? 'all-vocabulary' : selection.deck,
          chapters: selection.chapters.length > 0 ? selection.chapters.length : 'all',
          categories: selection.categories.join(','),
          study_mode: event.studyMode,
        });
        break;
      case 'reviewed':
        posthog.capture('hebrew_flashcard_reviewed', {
          result: event.result,
          grade: event.grade,
          interval_days: event.intervalDays,
        });
        break;
      case 'drilled':
        posthog.capture('hebrew_flashcard_reviewed', {
          result: event.result,
          study_mode: event.studyMode,
          first_attempt: event.firstAttempt,
        });
        break;
      case 'missed_added_to_review':
        posthog.capture('hebrew_flashcard_missed_added_to_review', {
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
  } = useFlashcardSession({
    words: filteredVocab,
    getKey: srsKey,
    studyMode,
    // A new deck or filter deals a new session. Compared by value, so
    // re-selecting what is already selected does not throw away the session.
    // A custom deck contributes its id and its *sorted words*, never its name:
    // renaming a deck keeps the session, editing its words deals a new one.
    restartKey: JSON.stringify([selection, freqFilter, deckRestartPart(customDeck)]),
    storage: STORAGE,
    onEvent,
  });

  // ─── Session complete screen ─────────────────────────────────────────────────

  if (sessionDone) {
    const total = sessionScore.known + sessionScore.learning;
    const pct = total > 0 ? Math.round((sessionScore.known / total) * 100) : 0;
    return (
      <div className="text-center space-y-4 py-12">
        <div className="text-7xl font-bold" style={{ color: 'var(--color-primary)' }}>
          {pct}%
        </div>
        <h2 className="text-2xl font-bold text-text">Session Complete</h2>
        <p className="text-text-muted">
          {sessionScore.known} got it &middot; {sessionScore.learning} still learning
        </p>
        {studyMode === 'srs' && dueCount === 0 && newCount === 0 && (
          <p className="text-text-muted text-sm">
            You're all caught up! Check back tomorrow for more reviews.
          </p>
        )}
        {studyMode !== 'srs' &&
          (addedToReview !== null ? (
            <p role="status" className="text-text-muted text-sm px-4">
              Added {addedToReview} {addedToReview === 1 ? 'word' : 'words'} to SRS Review.
              {addedToReview === 1 ? ' It comes' : ' They come'} up first in your next review.
            </p>
          ) : (
            missedNotInReview.length > 0 && (
              <div className="mx-auto max-w-sm bg-bg-card rounded-2xl border-2 border-primary/10 px-4 py-4 space-y-3 shadow-sm">
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
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold text-sm shadow-sm"
                >
                  Add {missedNotInReview.length} to SRS Review
                </button>
              </div>
            )
          ))}
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2 px-4 sm:px-0">
          <button
            type="button"
            onClick={startSession}
            className="px-5 py-3 sm:py-2.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold shadow-sm"
          >
            Study Again
          </button>
          {studyMode === 'srs' && (
            <button
              type="button"
              onClick={() => setStudyMode('all')}
              className="px-5 py-3 sm:py-2.5 border-2 border-primary/30 text-primary rounded-lg hover:bg-primary/5 transition-colors font-medium"
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
            : 'No cards match the current filter.'}
        </p>
        {studyMode === 'srs' && (
          <button
            type="button"
            onClick={() => setStudyMode('all')}
            className="px-5 py-2.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-semibold shadow-sm"
          >
            Study ahead anyway
          </button>
        )}
        {studyMode !== 'srs' &&
          (freqFilter !== 'all' || textbookId !== null || customDeck !== null) && (
            <button
              type="button"
              onClick={() => {
                setFreqFilter('all');
                updateSelection({ deck: 'all', customDeckId: null, chapters: [] });
              }}
              className="px-5 py-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Clear filter
            </button>
          )}
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Deck selector ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider shrink-0">
          Deck
        </span>
        <button
          type="button"
          onClick={() => updateSelection({ deck: 'all', customDeckId: null })}
          aria-pressed={selection.deck === 'all'}
          className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
            selection.deck === 'all'
              ? 'bg-primary text-white border-primary'
              : 'border-primary/10 text-text-muted hover:border-primary/40 hover:text-text'
          }`}
        >
          All vocabulary{' '}
          <span
            className={`text-xs ${selection.deck === 'all' ? 'text-white/70' : 'text-text-muted'}`}
          >
            ({vocabulary.length})
          </span>
        </button>

        {TEXTBOOK_IDS.map((id) => {
          const active = selection.deck === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => updateSelection({ deck: id, customDeckId: null })}
              aria-pressed={active}
              title={TEXTBOOKS[id].title}
              className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
                active
                  ? 'bg-primary text-white border-primary'
                  : 'border-primary/10 text-text-muted hover:border-primary/40 hover:text-text'
              }`}
            >
              {TEXTBOOKS[id].shortTitle}
            </button>
          );
        })}

        {customDecks.map((deck) => {
          const active = customDeck?.id === deck.id;
          return (
            <button
              type="button"
              key={deck.id}
              onClick={() => updateSelection({ deck: 'custom', customDeckId: deck.id })}
              aria-pressed={active}
              className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
                active
                  ? 'bg-primary text-white border-primary'
                  : 'border-primary/10 text-text-muted hover:border-primary/40 hover:text-text'
              }`}
            >
              {deck.name}{' '}
              <span className={`text-xs ${active ? 'text-white/70' : 'text-text-muted'}`}>
                ({deck.wordKeys.length})
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowDeckBuilder((open) => !open)}
          aria-expanded={showDeckBuilder}
          className="px-3 py-1 rounded-full text-sm border-2 border-dashed border-primary/30 text-primary font-medium hover:bg-primary/5 transition-colors"
        >
          {customDecks.length === 0 ? '+ Create deck' : 'Manage decks'}
        </button>
      </div>

      {showDeckBuilder && (
        <DeckBuilder
          decks={customDecks}
          words={builderVocabulary}
          store={customDeckStore}
          activeDeckId={customDeck?.id ?? null}
          onActivateDeck={(id) =>
            updateSelection(
              id === null
                ? { deck: 'all', customDeckId: null }
                : { deck: 'custom', customDeckId: id },
            )
          }
          onDecksChange={setCustomDecks}
          onClose={() => setShowDeckBuilder(false)}
          accent="var(--color-primary, #15803D)"
          labelDir="rtl"
          labelLang="he"
          labelFontFamily="var(--font-hebrew, 'Noto Sans Hebrew', sans-serif)"
        />
      )}

      {/* ── Chapter picker and category filter (textbook decks only) ──────── */}
      {textbookId !== null && catCounts !== null && (
        <div className="space-y-3">
          <ChapterPicker
            textbook={TEXTBOOKS[textbookId]}
            chapters={CHAPTER_STATS[textbookId]}
            selected={selection.chapters}
            onChange={(chapters) => updateSelection({ chapters })}
            wordCount={filteredVocab.length}
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider shrink-0">
              Show
            </span>
            {VOCAB_CATEGORIES.map(({ id, label, description }) => {
              const active = selection.categories.includes(id);
              const count = catCounts[id];
              return (
                <button
                  type="button"
                  key={id}
                  disabled={count === 0}
                  onClick={() => {
                    const next = active
                      ? selection.categories.filter((c) => c !== id)
                      : [...selection.categories, id];
                    // Every category off yields an empty deck with no visible
                    // cause; the last one on cannot be switched off.
                    if (next.length > 0) updateSelection({ categories: next });
                  }}
                  aria-pressed={active}
                  title={description}
                  className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'border-primary/10 text-text-muted hover:border-primary/40 hover:text-text'
                  }`}
                >
                  {label}{' '}
                  <span className={`text-xs ${active ? 'text-white/70' : 'text-text-muted'}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => updateSelection({ categories: VOCAB_CATEGORIES.map((c) => c.id) })}
              className="text-xs text-text-muted hover:text-primary transition-colors font-medium underline underline-offset-2"
            >
              All categories
            </button>
          </div>
        </div>
      )}

      {/* ── Top controls bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Study mode */}
          <div className="flex gap-1 bg-white border border-primary/10 p-1 rounded-xl shadow-sm">
            {STUDY_MODES.map(({ mode, label }) => (
              <button
                type="button"
                key={mode}
                onClick={() => setStudyMode(mode)}
                aria-pressed={studyMode === mode}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  studyMode === mode
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Card face. The part of speech is on the answer side either way —
              this decides only whether it is also on the front. A switch rather
              than a pill because it is a setting that stays put, not a filter
              chip picked from a row of alternatives. */}
          <div className="flex items-center bg-white border border-primary/10 px-3 py-1 rounded-xl shadow-sm">
            <ToggleSwitch
              checked={showPartOfSpeech}
              onChange={togglePartOfSpeech}
              label="Part of speech"
              accent="var(--color-primary, #15803D)"
              title="Show the part of speech on the front of the card. It is always shown with the answer."
            />
          </div>
        </div>

        {/* Frequency filter — only applies to the whole-vocabulary deck */}
        {customDeck ? (
          <p className="text-sm text-text-muted">
            {filteredVocab.length} words &middot; {customDeck.name}
          </p>
        ) : textbookId !== null ? (
          <p className="text-sm text-text-muted">
            {filteredVocab.length} words &middot; {describeChapters(textbookId, selection.chapters)}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {FREQ_FILTERS.map(({ filter, label }) => {
              const active = freqFilter === filter;
              const count = vocabulary.filter((w) => matchFreq(w.frequency, filter)).length;
              return (
                <button
                  type="button"
                  key={filter}
                  onClick={() => setFreqFilter(filter)}
                  aria-pressed={active}
                  className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
                    active
                      ? 'bg-primary text-white border-primary'
                      : 'border-primary/10 text-text-muted hover:border-primary/40 hover:text-text'
                  }`}
                >
                  {label}{' '}
                  <span className={`text-xs ${active ? 'text-white/70' : 'text-text-muted'}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="bg-bg-card rounded-2xl border-2 border-primary/10 px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-text-muted">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {studyMode === 'srs' ? (
              <>
                <span>
                  Due: <strong className="text-primary">{dueCount}</strong>
                </span>
                <span className="hidden sm:inline text-primary/20">|</span>
                <span>
                  New: <strong className="text-primary">{newCount}</strong>
                </span>
                <span className="hidden sm:inline text-primary/20">|</span>
              </>
            ) : studyMode === 'endless' ? (
              <>
                {/* "Card x/y" means nothing when the deck never ends. */}
                <span>
                  Reviewed:{' '}
                  <strong className="text-primary" data-testid="session-reviewed">
                    {sessionScore.known + sessionScore.learning}
                  </strong>{' '}
                  this session
                </span>
                <span className="hidden sm:inline text-primary/20">|</span>
              </>
            ) : (
              <>
                <span>
                  Card:{' '}
                  <strong className="text-primary" data-testid="card-progress">
                    {index + 1}/{queue.length}
                  </strong>
                </span>
                <span className="hidden sm:inline text-primary/20">|</span>
              </>
            )}
            <span>
              Today:{' '}
              <strong className="text-text">
                {Math.min(stats.cardsStudiedToday, STREAK_THRESHOLD)}/{STREAK_THRESHOLD}
              </strong>
            </span>
            <span className="hidden sm:inline text-primary/20">|</span>
            <span>
              Streak: <strong className="text-accent">{stats.streak}d</strong>
              {stats.cardsStudiedToday >= STREAK_THRESHOLD && (
                <span className="ml-1 text-jade text-xs font-bold">&#10003;</span>
              )}
            </span>
            {accuracy !== null && (
              <>
                <span className="hidden sm:inline text-primary/20">|</span>
                <span>
                  Accuracy: <strong className="text-text">{accuracy}%</strong>
                </span>
              </>
            )}
          </div>
          <span className="text-xs shrink-0 font-medium">
            <span className="text-jade">&#10003; {sessionScore.known}</span>
            {' · '}
            <span className="text-coral">&#10007; {sessionScore.learning}</span>
          </span>
        </div>
      </div>

      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <VocabCard
        card={card}
        flipped={flipped}
        onFlip={handleFlip}
        showPartOfSpeech={showPartOfSpeech}
      />

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      {/* The SRS grades schedule the card, so they preview the interval each
          would buy. A drill schedules nothing, so its row asks only whether
          the card should come back this round. */}
      {flipped &&
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
        Keyboard:{' '}
        <kbd className="bg-primary/5 border border-primary/10 px-1.5 rounded text-primary font-mono">
          Space
        </kbd>{' '}
        flip &middot;{' '}
        <kbd className="bg-primary/5 border border-primary/10 px-1.5 rounded text-primary font-mono">
          1
        </kbd>
        &ndash;
        <kbd className="bg-primary/5 border border-primary/10 px-1.5 rounded text-primary font-mono">
          {studyMode === 'srs' ? 4 : 2}
        </kbd>{' '}
        {studyMode === 'srs' ? 'grade (Again, Hard, Good, Easy)' : 'answer (Missed, Got it)'}
      </p>

      {/* ── Footer controls ───────────────────────────────────────────────── */}
      <div className="flex justify-center gap-4 pt-1">
        <button
          type="button"
          onClick={startSession}
          className="text-sm text-text-muted hover:text-primary transition-colors font-medium"
        >
          Restart session
        </button>
        {/* Endless never ends by itself, so this is its way to the summary —
            and to the offer of putting missed words into SRS Review. */}
        {studyMode === 'endless' && (
          <button
            type="button"
            onClick={finish}
            className="text-sm text-text-muted hover:text-primary transition-colors font-medium"
          >
            Finish session
          </button>
        )}
        {/* Resetting lives on the account page, behind a typed confirmation. */}
        {studyMode === 'srs' && (
          <a
            href="/account#reset-progress"
            className="text-sm text-text-muted hover:text-primary transition-colors font-medium"
          >
            Manage SRS progress
          </a>
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
