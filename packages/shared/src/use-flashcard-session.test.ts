import { act, fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REQUEUE_GAP } from './flashcard-session';
import { daysFromNow, emptyStats, newCard, type StudyStats } from './srs';
import {
  buildQueue,
  type FlashcardSessionOptions,
  isDrillMode,
  type SRSStore,
  useFlashcardSession,
} from './use-flashcard-session';

// These are the session rules for both apps. Each app's own Flashcards tests
// cover only what that app adds: its card, its decks and filters, its storage
// keys and analytics names.

interface Word {
  id: string;
  gloss: string;
}

const word = (id: string): Word => ({ id, gloss: `gloss of ${id}` });
const deckOf = (n: number) => Array.from({ length: n }, (_, i) => word(`w${i}`));
const getKey = (w: Word) => w.id;

/** An in-memory stand-in for an app's localStorage layer. */
function memoryStorage(store: SRSStore = {}, stats: StudyStats = emptyStats()) {
  const state = { store, stats };
  return {
    state,
    storage: {
      loadStore: () => state.store,
      saveStore: vi.fn((next: SRSStore) => {
        state.store = next;
      }),
      loadStats: () => state.stats,
      saveStats: vi.fn((next: StudyStats) => {
        state.stats = next;
      }),
    },
  };
}

type Options<R> = FlashcardSessionOptions<Word, R>;

function setup<R = never>(
  overrides: Partial<Options<R>> = {},
  seed: { store?: SRSStore; stats?: StudyStats } = {},
) {
  const mem = memoryStorage(seed.store, seed.stats);
  const onEvent = vi.fn();
  const props: Options<R> = {
    words: deckOf(5),
    getKey,
    studyMode: 'srs',
    restartKey: 'deck-a',
    storage: mem.storage,
    onEvent,
    ...overrides,
  };
  const hook = renderHook((p: Options<R>) => useFlashcardSession<Word, R>(p), {
    initialProps: props,
  });
  const rerender = (patch: Partial<Options<R>>) => hook.rerender({ ...props, ...patch });
  return { result: hook.result, rerender, unmount: hook.unmount, mem, onEvent };
}

type Session = ReturnType<typeof setup>['result'];

const key = (s: Session) => {
  const c = s.current.card;
  if (!c) throw new Error('no card dealt');
  return c.id;
};

function press(k: string, target: Element | Window = window) {
  act(() => {
    fireEvent.keyDown(target, { key: k });
  });
}

// ─── buildQueue ───────────────────────────────────────────────────────────────

describe('buildQueue', () => {
  const words = deckOf(4);

  it('deals the whole deck in a drill', () => {
    for (const mode of ['all', 'endless'] as const) {
      const q = buildQueue(words, mode, { w0: newCard('w0') }, getKey);
      expect(q.map(getKey).sort()).toEqual(['w0', 'w1', 'w2', 'w3']);
    }
  });

  it('deals due cards, then new ones, and leaves out cards not yet due', () => {
    const store: SRSStore = {
      w0: { ...newCard('w0'), dueDate: daysFromNow(3) },
      w1: newCard('w1'),
      w2: newCard('w2'),
    };
    const q = buildQueue(words, 'srs', store, getKey).map(getKey);
    expect(q).toHaveLength(3);
    expect(q.slice(0, 2).sort()).toEqual(['w1', 'w2']);
    expect(q[2]).toBe('w3');
  });

  it('only SRS Review is not a drill', () => {
    expect(isDrillMode('srs')).toBe(false);
    expect(isDrillMode('all')).toBe(true);
    expect(isDrillMode('endless')).toBe(true);
  });
});

// ─── Session lifecycle ────────────────────────────────────────────────────────

describe('session lifecycle', () => {
  it('deals on mount and reports the session', () => {
    const { result, onEvent } = setup({ studyMode: 'all' });
    expect(result.current.queue).toHaveLength(5);
    expect(result.current.index).toBe(0);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'session_started',
      deckSize: 5,
      studyMode: 'all',
    });
  });

  it('deals again when the restart key changes, reading the new words', () => {
    const { result, rerender, onEvent } = setup({ studyMode: 'all' });
    act(() => result.current.drill('got-it'));
    rerender({ words: deckOf(2), restartKey: 'deck-b' });
    expect(result.current.queue).toHaveLength(2);
    expect(result.current.index).toBe(0);
    expect(result.current.sessionScore).toEqual({ known: 0, learning: 0 });
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ deckSize: 2 }));
  });

  it('deals again when the study mode changes', () => {
    const { rerender, onEvent } = setup();
    rerender({ studyMode: 'endless' });
    expect(onEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'session_started', studyMode: 'endless' }),
    );
  });

  it('does not deal again for a new words array with the same restart key', () => {
    const { result, rerender, onEvent } = setup({ studyMode: 'all' });
    act(() => result.current.drill('got-it'));
    rerender({ words: deckOf(5) });
    expect(result.current.index).toBe(1);
    expect(onEvent).toHaveBeenCalledTimes(2); // started + drilled
  });

  it('does not deal again when grading writes the store', () => {
    const { result } = setup();
    act(() => result.current.review('good'));
    expect(result.current.index).toBe(1);
  });

  it('starts over on request', () => {
    const { result } = setup({ studyMode: 'all' });
    act(() => result.current.drill('missed'));
    act(() => result.current.startSession());
    expect(result.current.index).toBe(0);
    expect(result.current.queue).toHaveLength(5);
    expect(result.current.missedNotInReview).toEqual([]);
  });

  it('finishes on request', () => {
    const { result } = setup({ studyMode: 'endless' });
    act(() => result.current.finish());
    expect(result.current.sessionDone).toBe(true);
  });

  it('flips and flips back', () => {
    const { result } = setup();
    act(() => result.current.flip());
    expect(result.current.flipped).toBe(true);
    expect(result.current.revealed).toBe(true);
    act(() => result.current.flip());
    expect(result.current.flipped).toBe(false);
  });

  it('has no card for an empty deck, and answering does nothing', () => {
    const { result, mem } = setup({ words: [] });
    expect(result.current.card).toBeUndefined();
    act(() => result.current.review('good'));
    act(() => result.current.drill('missed'));
    expect(mem.storage.saveStore).not.toHaveBeenCalled();
    expect(mem.storage.saveStats).not.toHaveBeenCalled();
  });
});

// ─── SRS Review ───────────────────────────────────────────────────────────────

describe('SRS Review', () => {
  it('schedules the card, records stats, and reports the prior interval', () => {
    const seeded = { ...newCard('w0'), interval: 6, repetition: 2 };
    const { result, mem, onEvent } = setup({ words: [word('w0')] }, { store: { w0: seeded } });
    act(() => result.current.review('good'));

    expect(mem.state.store.w0.interval).toBeGreaterThan(6);
    expect(mem.state.stats.totalReviewed).toBe(1);
    expect(mem.state.stats.totalCorrect).toBe(1);
    expect(onEvent).toHaveBeenLastCalledWith({
      type: 'reviewed',
      result: 'correct',
      grade: 'good',
      intervalDays: 6,
    });
  });

  it('counts a fail as still learning', () => {
    const { result, onEvent } = setup();
    act(() => result.current.review('again'));
    expect(result.current.sessionScore).toEqual({ known: 0, learning: 1 });
    expect(onEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ result: 'incorrect', intervalDays: 0 }),
    );
  });

  it('ends after the last card', () => {
    const { result } = setup({ words: deckOf(2) });
    act(() => result.current.review('good'));
    expect(result.current.sessionDone).toBe(false);
    act(() => result.current.review('easy'));
    expect(result.current.sessionDone).toBe(true);
    expect(result.current.sessionScore).toEqual({ known: 2, learning: 0 });
  });

  it('counts due and new cards in the current deck', () => {
    const { result } = setup(
      {},
      { store: { w0: newCard('w0'), w1: { ...newCard('w1'), dueDate: daysFromNow(5) } } },
    );
    expect(result.current.dueCount).toBe(1);
    expect(result.current.newCount).toBe(3);
  });

  it('reports lifetime accuracy, or null before any review', () => {
    expect(setup().result.current.accuracy).toBeNull();
    const stats = { ...emptyStats(), totalReviewed: 4, totalCorrect: 3 };
    expect(setup({}, { stats }).result.current.accuracy).toBe(75);
  });

  it('a review outside SRS Review records stats but never writes the schedule', () => {
    const { result, mem } = setup({ studyMode: 'all' });
    act(() => result.current.review('good'));
    expect(mem.storage.saveStore).not.toHaveBeenCalled();
    expect(mem.state.stats.totalReviewed).toBe(1);
  });
});

// ─── Drills ───────────────────────────────────────────────────────────────────

describe('drills', () => {
  it('never writes the SRS store, missed or not', () => {
    const { result, mem } = setup({ studyMode: 'all' });
    act(() => result.current.drill('missed'));
    act(() => result.current.drill('got-it'));
    expect(mem.storage.saveStore).not.toHaveBeenCalled();
  });

  it('brings a missed card back a few cards later, never straight away', () => {
    for (const r of [0, 0.5, 0.99]) {
      const { result, unmount } = setup({ studyMode: 'all', words: deckOf(10), random: () => r });
      const missed = key(result);
      act(() => result.current.drill('missed'));
      let between = 0;
      while (key(result) !== missed) {
        between++;
        act(() => result.current.drill('got-it'));
      }
      expect(between).toBeGreaterThanOrEqual(REQUEUE_GAP.min);
      expect(between).toBeLessThanOrEqual(REQUEUE_GAP.max);
      unmount();
    }
  });

  it('ends a pass only once every card has been got right', () => {
    const { result } = setup({ studyMode: 'all', words: deckOf(3) });
    act(() => result.current.drill('missed'));
    expect(result.current.queue).toHaveLength(4);
    for (let i = 0; i < 3; i++) {
      expect(result.current.sessionDone).toBe(false);
      act(() => result.current.drill('got-it'));
    }
    expect(result.current.sessionDone).toBe(true);
  });

  it('scores only the first attempt at each card', () => {
    const { result, mem, onEvent } = setup({ studyMode: 'all', words: deckOf(3) });
    act(() => result.current.drill('missed'));
    act(() => result.current.drill('got-it'));
    act(() => result.current.drill('got-it'));
    act(() => result.current.drill('got-it')); // the re-ask
    expect(result.current.sessionScore).toEqual({ known: 2, learning: 1 });
    expect(mem.state.stats.totalReviewed).toBe(3);
    expect(onEvent).toHaveBeenLastCalledWith({
      type: 'drilled',
      result: 'correct',
      studyMode: 'all',
      firstAttempt: false,
    });
  });

  it('keys cards by getKey, so two cards with the same text stay apart', () => {
    // Homographs: same front, different card.
    const words = [
      { id: 'af#also', gloss: 'also' },
      { id: 'af#nose', gloss: 'nose' },
    ];
    const { result } = setup({ studyMode: 'all', words });
    act(() => result.current.drill('missed'));
    act(() => result.current.drill('missed'));
    expect([...result.current.missedNotInReview].sort()).toEqual(['af#also', 'af#nose']);
  });
});

// ─── Endless ──────────────────────────────────────────────────────────────────

describe('endless', () => {
  it('deals a new round instead of ending, never opening on the last card', () => {
    const { result } = setup({ studyMode: 'endless', words: deckOf(3) });
    const firstRound: string[] = [];
    for (let i = 0; i < 3; i++) {
      firstRound.push(key(result));
      act(() => result.current.drill('got-it'));
    }
    expect(result.current.sessionDone).toBe(false);
    expect(result.current.index).toBe(0);
    expect(key(result)).not.toBe(firstRound[2]);
    expect(result.current.queue.map(getKey).sort()).toEqual([...firstRound].sort());
  });

  it('reshuffles the deck, not the queue, so repeats do not compound', () => {
    const { result } = setup({ studyMode: 'endless', words: deckOf(3) });
    act(() => result.current.drill('missed'));
    expect(result.current.queue).toHaveLength(4);
    for (let i = 0; i < 3; i++) act(() => result.current.drill('got-it'));
    expect(result.current.index).toBe(0);
    expect(result.current.queue).toHaveLength(3);
  });

  it('scores each card again in a new round', () => {
    const { result, onEvent } = setup({ studyMode: 'endless', words: deckOf(2) });
    act(() => result.current.drill('got-it'));
    act(() => result.current.drill('got-it'));
    act(() => result.current.drill('got-it'));
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ firstAttempt: true }));
    expect(result.current.sessionScore.known).toBe(3);
  });
});

// ─── From a drill to SRS Review ───────────────────────────────────────────────

describe('adding missed cards to SRS Review', () => {
  it('adds missed cards not yet scheduled, as new cards due today', () => {
    const { result, mem, onEvent } = setup({ studyMode: 'all', words: deckOf(3) });
    const missed = key(result);
    act(() => result.current.drill('missed'));
    expect(result.current.missedNotInReview).toEqual([missed]);

    act(() => result.current.addMissedToReview());

    expect(mem.state.store).toEqual({ [missed]: newCard(missed) });
    expect(result.current.addedToReview).toBe(1);
    expect(result.current.missedNotInReview).toEqual([]);
    expect(onEvent).toHaveBeenLastCalledWith({
      type: 'missed_added_to_review',
      count: 1,
      studyMode: 'all',
    });
  });

  it('leaves a card already in SRS Review exactly as it was', () => {
    const history = { ...newCard('w0'), interval: 12, repetition: 3, dueDate: '2099-01-01' };
    const { result, mem } = setup(
      { studyMode: 'all', words: [word('w0'), word('w1')] },
      { store: { w0: history } },
    );
    act(() => result.current.drill('missed'));
    act(() => result.current.drill('missed'));
    expect(result.current.missedNotInReview).toHaveLength(1);

    act(() => result.current.addMissedToReview());

    expect(mem.state.store.w0).toBe(history);
    expect(Object.keys(mem.state.store).sort()).toEqual(['w0', 'w1']);
  });

  it('counts a card missed twice once', () => {
    const { result } = setup({ studyMode: 'all', words: deckOf(1) });
    act(() => result.current.drill('missed'));
    act(() => result.current.drill('missed'));
    expect(result.current.missedNotInReview).toHaveLength(1);
  });
});

// ─── Resetting the schedule ───────────────────────────────────────────────────

describe('resetStore', () => {
  it('empties the store and deals again from it', () => {
    const { result, mem } = setup(
      { words: deckOf(2) },
      { store: { w0: { ...newCard('w0'), dueDate: daysFromNow(9) } } },
    );
    expect(result.current.queue).toHaveLength(1); // w0 is not due
    act(() => result.current.resetStore());
    expect(mem.state.store).toEqual({});
    expect(result.current.srsStore).toEqual({});
    expect(result.current.queue).toHaveLength(2);
  });
});

// ─── Typed answers ────────────────────────────────────────────────────────────

describe('typed answers', () => {
  const checkAnswer = (input: string, card: Word) =>
    input === card.gloss ? ('correct' as const) : ('incorrect' as const);

  it('marks the typed answer with the app checker and reveals the card', () => {
    const { result } = setup({ answerMode: 'type', checkAnswer });
    expect(result.current.revealed).toBe(false);
    act(() => result.current.setTypedAnswer(`gloss of ${key(result)}`));
    act(() => result.current.submitTyped());
    expect(result.current.answerResult).toBe('correct');
    expect(result.current.revealed).toBe(true);
  });

  it('marks once: a second check is ignored', () => {
    const checker = vi.fn(checkAnswer);
    const { result } = setup({ answerMode: 'type', checkAnswer: checker });
    act(() => result.current.setTypedAnswer('wrong'));
    act(() => result.current.submitTyped());
    act(() => result.current.submitTyped());
    expect(checker).toHaveBeenCalledTimes(1);
    expect(result.current.answerResult).toBe('incorrect');
  });

  it('does nothing without a checker', () => {
    const { result } = setup({ answerMode: 'type' });
    act(() => result.current.submitTyped());
    expect(result.current.answerResult).toBeNull();
  });

  it('clears the typed answer and its mark on every advance, round boundary included', () => {
    // A boundary that skipped the reset left the last card's "Not quite" on
    // the first card of the next round.
    const { result } = setup({
      studyMode: 'endless',
      words: deckOf(2),
      answerMode: 'type',
      checkAnswer,
    });
    for (let i = 0; i < 3; i++) {
      act(() => result.current.setTypedAnswer('wrong'));
      act(() => result.current.submitTyped());
      expect(result.current.answerResult).toBe('incorrect');
      act(() => result.current.drill('got-it'));
      expect(result.current.typedAnswer).toBe('');
      expect(result.current.answerResult).toBeNull();
      expect(result.current.revealed).toBe(false);
    }
  });
});

// ─── Keyboard ─────────────────────────────────────────────────────────────────

describe('keyboard', () => {
  it('flips on Space and Enter', () => {
    const { result } = setup();
    press(' ');
    expect(result.current.flipped).toBe(true);
    press('Enter');
    expect(result.current.flipped).toBe(false);
  });

  it('grades 1–4 in SRS Review, only once the answer is showing', () => {
    const { result, onEvent } = setup();
    press('3');
    expect(result.current.index).toBe(0);
    press(' ');
    press('4');
    expect(result.current.index).toBe(1);
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ grade: 'easy' }));
  });

  it('maps Right to Good and Left to Again in SRS Review', () => {
    const { onEvent } = setup();
    press(' ');
    press('ArrowRight');
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ grade: 'good' }));
    press(' ');
    press('ArrowLeft');
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ grade: 'again' }));
  });

  it('answers 1 Missed and 2 Got it in a drill, with Left and Right as aliases', () => {
    const { result } = setup({ studyMode: 'all' });
    press(' ');
    press('1');
    expect(result.current.sessionScore.learning).toBe(1);
    press(' ');
    press('2');
    expect(result.current.sessionScore.known).toBe(1);
    press(' ');
    press('ArrowLeft');
    expect(result.current.sessionScore.learning).toBe(2);
    press(' ');
    press('ArrowRight');
    expect(result.current.sessionScore.known).toBe(2);
  });

  it('ignores keys typed into a field', () => {
    const { result } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    press(' ', input);
    expect(result.current.flipped).toBe(false);
    input.remove();
  });

  it('does not flip in type mode, but answers once the typed answer is marked', () => {
    const { result } = setup({
      studyMode: 'all',
      answerMode: 'type',
      checkAnswer: () => true,
    });
    press(' ');
    expect(result.current.flipped).toBe(false);
    act(() => result.current.submitTyped());
    press('2');
    expect(result.current.index).toBe(1);
  });

  it('can be switched off', () => {
    const { result } = setup({ keyboard: false });
    press(' ');
    expect(result.current.flipped).toBe(false);
  });

  it('stops listening once the session is done', () => {
    const { result } = setup({ words: deckOf(1) });
    press(' ');
    press('3');
    expect(result.current.sessionDone).toBe(true);
    const before = result.current.flipped;
    press(' ');
    expect(result.current.flipped).toBe(before);
  });
});
