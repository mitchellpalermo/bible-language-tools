/**
 * The flashcard session engine both apps study with (#87).
 *
 * Everything about a session that is not about a script lives here: which
 * cards are dealt, what an answer does to the queue, the SRS store and the
 * stats, first-attempt scoring, the bridge from a drill to SRS Review, typed
 * answers, and the keyboard. What stays in each app is what genuinely differs
 * by language — how a card is drawn, how a typed answer is marked, which decks
 * and filters exist, the storage keys and the analytics event names.
 *
 * The pure rules underneath (`shuffle`, `nextRound`, `requeueMissed`) are in
 * `./flashcard-session`. The research behind the drill rules is in the root
 * CLAUDE.md under "Drill modes answer Missed / Got it".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DRILL_RESULTS, type DrillResult } from './components/DrillButtons';
import { nextRound, requeueMissed, shuffle } from './flashcard-session';
import {
  GRADE_QUALITY,
  isDue,
  isPassingGrade,
  newCard,
  nextSRS,
  REVIEW_GRADES,
  type ReviewGrade,
  recordReview,
  type SRSCard,
  type StudyStats,
} from './srs';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * - `srs`: due cards, then new ones. Graded Again/Hard/Good/Easy, which writes
 *   the SRS store.
 * - `all`: one shuffled pass through the deck. A drill — no SRS writes. Graded
 *   Missed / Got it, and a missed card comes back a few cards later until it is
 *   got right once, so a pass ends with every card recalled correctly at least
 *   once.
 * - `endless`: `all` that never ends. When the deck runs out it is reshuffled
 *   and dealt again (#164). An endless *due* queue is incoherent — grading a
 *   card makes it not due — so Endless is a drill too.
 */
export type StudyMode = 'srs' | 'all' | 'endless';

/** Study All and Endless: they never write the schedule. */
export function isDrillMode(mode: StudyMode): boolean {
  return mode !== 'srs';
}

/**
 * - `flip`: reveal the back, then answer.
 * - `type`: type the answer and check it; the check reveals the back.
 */
export type AnswerMode = 'flip' | 'type';

export type SRSStore = Record<string, SRSCard>;

/**
 * Each app's persistence. The storage keys are per app (`greek-tools-srs-v1`,
 * `hebrew-tools-srs-v1`), so the hook is handed the functions, never a key.
 */
export interface FlashcardStorage {
  loadStore: () => SRSStore;
  saveStore: (store: SRSStore) => void;
  loadStats: () => StudyStats;
  saveStats: (stats: StudyStats) => void;
}

/**
 * What happened, for analytics. The hook names no events: each app maps these
 * to its own (`flashcard_*` on greek.tools, `hebrew_flashcard_*` on
 * hebrew.tools) and adds whatever of its own state it wants on them.
 */
export type FlashcardSessionEvent =
  | { type: 'session_started'; deckSize: number; studyMode: StudyMode }
  | {
      type: 'reviewed';
      result: 'correct' | 'incorrect';
      grade: ReviewGrade;
      /** The card's interval before this review. */
      intervalDays: number;
    }
  | {
      type: 'drilled';
      result: 'correct' | 'incorrect';
      studyMode: StudyMode;
      /** False for the re-asks of a missed card, which are not scored. */
      firstAttempt: boolean;
    }
  | { type: 'missed_added_to_review'; count: number; studyMode: StudyMode };

export interface FlashcardSessionOptions<T, R> {
  /** The cards in play, already filtered by the app's deck and filter controls. */
  words: readonly T[];
  /** The SRS store key for a card. Must be unique per card (mind homographs). */
  getKey: (word: T) => string;
  studyMode: StudyMode;
  /**
   * A new session is dealt whenever this or `studyMode` changes. Build it from
   * the app's own deck and filter state. It is explicit, rather than inferred
   * from `words`, so an app decides what counts as a different deck — renaming
   * a custom deck should not restart a session, editing its words should.
   */
  restartKey: string;
  storage: FlashcardStorage;
  onEvent?: (event: FlashcardSessionEvent) => void;
  /** Defaults to `flip`. */
  answerMode?: AnswerMode;
  /**
   * Marks a typed answer. Required for `type` mode. The result is whatever the
   * app's checker says — a boolean, or something richer such as Hebrew's
   * "right apart from the vowel points" — and is handed back untouched.
   */
  checkAnswer?: (input: string, card: T) => R;
  /** Defaults to true. Off, the app wires its own keys. */
  keyboard?: boolean;
  /** Injectable for tests; defaults to `Math.random`. */
  random?: () => number;
}

export interface SessionScore {
  known: number;
  learning: number;
}

// ─── Queue building ───────────────────────────────────────────────────────────

/**
 * The opening queue of a session. A drill is the whole deck shuffled; SRS
 * Review is the due cards, then the never-seen ones, each group shuffled.
 * Cards that are scheduled and not yet due are left out.
 */
export function buildQueue<T>(
  words: readonly T[],
  mode: StudyMode,
  store: SRSStore,
  getKey: (word: T) => string,
  random: () => number = Math.random,
): T[] {
  if (isDrillMode(mode)) return shuffle(words, random);
  const due: T[] = [];
  const fresh: T[] = [];
  for (const w of words) {
    const c = store[getKey(w)];
    if (!c) fresh.push(w);
    else if (isDue(c)) due.push(w);
  }
  return [...shuffle(due, random), ...shuffle(fresh, random)];
}

// ─── The hook ─────────────────────────────────────────────────────────────────

const EMPTY_SCORE: SessionScore = { known: 0, learning: 0 };

export function useFlashcardSession<T, R = never>(options: FlashcardSessionOptions<T, R>) {
  const { studyMode, restartKey, storage, getKey } = options;
  const answerMode = options.answerMode ?? 'flip';
  const keyboard = options.keyboard ?? true;

  // Options read inside callbacks go through refs, so the callbacks stay
  // stable and a session is only ever restarted by `restartKey`/`studyMode`.
  const latest = useRef(options);
  latest.current = options;
  const random = useCallback(() => (latest.current.random ?? Math.random)(), []);

  // Persistent state
  const [srsStore, setSrsStore] = useState<SRSStore>(() => storage.loadStore());
  const [stats, setStats] = useState<StudyStats>(() => storage.loadStats());
  const srsStoreRef = useRef(srsStore);
  srsStoreRef.current = srsStore;

  // Session state. `deck` is the session's cards once each, which an Endless
  // round is reshuffled from — `queue` holds repeats of missed cards, and
  // reshuffling it would compound them round after round.
  const [queue, setQueue] = useState<T[]>([]);
  const [deck, setDeck] = useState<T[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState<R | null>(null);
  const [sessionScore, setSessionScore] = useState<SessionScore>(EMPTY_SCORE);
  const [sessionDone, setSessionDone] = useState(false);

  // Drill state. `attemptedRef` is the cards already answered this round, so
  // only a first attempt is scored. `missedKeys` is every card missed this
  // session, offered to SRS Review when it ends.
  const attemptedRef = useRef(new Set<string>());
  const [missedKeys, setMissedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [addedToReview, setAddedToReview] = useState<number | null>(null);

  const emit = useCallback((event: FlashcardSessionEvent) => latest.current.onEvent?.(event), []);

  /** Per-card state, cleared on every move to another card. */
  const clearCard = useCallback(() => {
    setFlipped(false);
    setTypedAnswer('');
    setAnswerResult(null);
  }, []);

  // ─── Session lifecycle ──────────────────────────────────────────────────────

  const startSession = useCallback(() => {
    const { words, studyMode: mode, getKey: keyOf } = latest.current;
    const next = buildQueue(words, mode, srsStoreRef.current, keyOf, random);
    setQueue(next);
    setDeck(next);
    setIndex(0);
    clearCard();
    setSessionScore(EMPTY_SCORE);
    setSessionDone(false);
    attemptedRef.current = new Set();
    setMissedKeys(new Set());
    setAddedToReview(null);
    emit({ type: 'session_started', deckSize: next.length, studyMode: mode });
  }, [clearCard, emit, random]);

  // Deal on mount, and again whenever the deck or the mode changes. SRS writes
  // do not restart a session: the store is read through a ref.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are the restart triggers
  useEffect(() => {
    startSession();
  }, [restartKey, studyMode, startSession]);

  const finish = useCallback(() => setSessionDone(true), []);

  // ─── Answering ──────────────────────────────────────────────────────────────

  const card: T | undefined = queue[index];

  /** Move past the current card: to the next one, a new round, or the end. */
  const advance = useCallback(
    (nextQueue: T[]) => {
      if (index + 1 < nextQueue.length) {
        setQueue(nextQueue);
        setIndex((i) => i + 1);
      } else if (studyMode === 'endless' && card !== undefined) {
        // A filter change restarts the session instead, so the deck never
        // needs re-reading here.
        setQueue(nextRound(deck, card, getKey, random));
        setIndex(0);
        attemptedRef.current = new Set();
      } else {
        setSessionDone(true);
        return;
      }
      clearCard();
    },
    [index, studyMode, card, deck, getKey, clearCard, random],
  );

  const score = useCallback((correct: boolean) => {
    setStats((prev) => {
      const next = recordReview(prev, correct);
      latest.current.storage.saveStats(next);
      return next;
    });
    setSessionScore((s) => ({
      known: s.known + (correct ? 1 : 0),
      learning: s.learning + (correct ? 0 : 1),
    }));
  }, []);

  /** An SRS grade. Writes the schedule in SRS Review only. */
  const review = useCallback(
    (grade: ReviewGrade) => {
      if (card === undefined) return;
      const k = getKey(card);
      const correct = isPassingGrade(grade);

      if (studyMode === 'srs') {
        setSrsStore((prev) => {
          const updated = nextSRS(prev[k] ?? newCard(k), GRADE_QUALITY[grade]);
          const next = { ...prev, [k]: updated };
          latest.current.storage.saveStore(next);
          return next;
        });
      }

      emit({
        type: 'reviewed',
        result: correct ? 'correct' : 'incorrect',
        grade,
        intervalDays: srsStore[k]?.interval ?? 0,
      });
      score(correct);
      advance(queue);
    },
    [card, getKey, studyMode, srsStore, queue, advance, emit, score],
  );

  /** A drill answer. Never touches the SRS store. */
  const drill = useCallback(
    (result: DrillResult) => {
      if (card === undefined) return;
      const k = getKey(card);
      const correct = result === 'got-it';

      // Only a card's first attempt in a round is scored. A missed card comes
      // back until it is got right, and counting those repeats would inflate
      // accuracy with answers the student had just been shown.
      const firstAttempt = !attemptedRef.current.has(k);
      attemptedRef.current.add(k);

      emit({
        type: 'drilled',
        result: correct ? 'correct' : 'incorrect',
        studyMode,
        firstAttempt,
      });
      if (firstAttempt) score(correct);

      if (!correct) setMissedKeys((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
      advance(correct ? queue : requeueMissed(queue, index, random));
    },
    [card, getKey, studyMode, queue, index, advance, emit, score, random],
  );

  const flip = useCallback(() => setFlipped((f) => !f), []);

  /** Mark the typed answer. Once marked, the card is revealed. */
  const submitTyped = useCallback(() => {
    const check = latest.current.checkAnswer;
    if (card === undefined || answerResult !== null || !check) return;
    setAnswerResult(check(typedAnswer, card));
  }, [card, answerResult, typedAnswer]);

  /**
   * Whether the answer is on screen and the answer row is live. Flip and type
   * reach it by different routes.
   */
  const revealed = answerMode === 'flip' ? flipped : answerResult !== null;

  // ─── After a drill: the bridge to SRS Review ─────────────────────────────────

  // Missed cards not yet in the SRS store. Scheduled cards are left alone: a
  // drill must never move an interval, ease or due date.
  const missedNotInReview = useMemo(
    () => [...missedKeys].filter((k) => !srsStore[k]),
    [missedKeys, srsStore],
  );

  /**
   * Hand the session's missed cards to SRS Review, as new cards due today. A
   * cram helps tomorrow's quiz and fades by the exam; spaced review is what
   * keeps a word.
   */
  const addMissedToReview = useCallback(() => {
    setSrsStore((prev) => {
      const next = { ...prev };
      for (const k of missedKeys) if (!next[k]) next[k] = newCard(k);
      latest.current.storage.saveStore(next);
      return next;
    });
    setAddedToReview(missedNotInReview.length);
    emit({ type: 'missed_added_to_review', count: missedNotInReview.length, studyMode });
  }, [missedKeys, missedNotInReview, studyMode, emit]);

  /**
   * Empty the SRS store and deal again. Destructive and local only: anything
   * server-side is the caller's to clear.
   */
  const resetStore = useCallback(() => {
    srsStoreRef.current = {};
    setSrsStore({});
    latest.current.storage.saveStore({});
    startSession();
  }, [startSession]);

  // ─── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!keyboard || sessionDone) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (answerMode === 'flip' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        flip();
      }
      if (!revealed) return;
      // Numbers answer the card in the order the buttons are drawn: 1–4 for
      // the SRS grades, 1–2 for Missed / Got it. Left and Right are the fail
      // and pass ends of either row.
      if (studyMode === 'srs') {
        const byNumber = REVIEW_GRADES[Number(e.key) - 1];
        if (byNumber) review(byNumber);
        else if (e.key === 'ArrowRight') review('good');
        else if (e.key === 'ArrowLeft') review('again');
      } else {
        const byNumber = DRILL_RESULTS[Number(e.key) - 1];
        if (byNumber) drill(byNumber);
        else if (e.key === 'ArrowRight') drill('got-it');
        else if (e.key === 'ArrowLeft') drill('missed');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keyboard, sessionDone, answerMode, revealed, studyMode, flip, review, drill]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const words = options.words;
  const dueCount = useMemo(
    () =>
      words.filter((w) => {
        const c = srsStore[getKey(w)];
        return c ? isDue(c) : false;
      }).length,
    [words, srsStore, getKey],
  );
  const newCount = useMemo(
    () => words.filter((w) => !srsStore[getKey(w)]).length,
    [words, srsStore, getKey],
  );
  const accuracy =
    stats.totalReviewed > 0 ? Math.round((stats.totalCorrect / stats.totalReviewed) * 100) : null;

  return {
    // The card
    card,
    index,
    queue,
    flipped,
    flip,
    revealed,
    typedAnswer,
    setTypedAnswer,
    answerResult,
    submitTyped,
    // Answering
    review,
    drill,
    // The session
    sessionScore,
    sessionDone,
    startSession,
    finish,
    // The schedule and stats
    srsStore,
    stats,
    dueCount,
    newCount,
    accuracy,
    resetStore,
    // After a drill
    missedNotInReview,
    addMissedToReview,
    addedToReview,
  };
}

export type FlashcardSession<T, R = never> = ReturnType<typeof useFlashcardSession<T, R>>;
