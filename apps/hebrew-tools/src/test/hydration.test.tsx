/**
 * Every island hydrates cleanly over its own server HTML for a returning
 * student — ADR 006, and the guard for issue #167.
 *
 * Production prerenders each `client:load` island on a server with no
 * storage, then hydrates it in a browser holding the student's progress. A
 * component whose first render reads that progress throws React #418, or —
 * where only an attribute differs — silently keeps the server's attribute.
 *
 * The page scan at the bottom is what keeps this honest: a new island on any
 * page fails the suite until it has a case here.
 */

import { emptyStats } from '@tools/shared/srs';
import { hydrationErrors } from '@tools/shared/test/hydration';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccentTrainer from '../components/AccentTrainer';
import DailyVerse from '../components/DailyVerse';
import Flashcards from '../components/Flashcards';
import FocusPassageHub from '../components/FocusPassageHub';
import FocusPassages from '../components/FocusPassages';
import GrammarReference from '../components/GrammarReference';
import HebrewKeyboard from '../components/HebrewKeyboard';
import HebrewReader from '../components/HebrewReader';
import ParadigmQuiz from '../components/ParadigmQuiz';
import ResetProgress from '../components/ResetProgress';
import SyncControls from '../components/SyncControls';
import TodaySession from '../components/TodaySession';
import Writing from '../components/Writing';
import { markReadToday } from '../data/dailyVerses';
import { newCard, nextSRS, recordReview, saveSRSStore, saveStats } from '../data/srs';
import { cardKey, vocabulary } from '../data/vocabulary';
import { buildDecks, writingCardKey } from '../data/writing';
import { accentCardKey, SCAFFOLD_HISTORY_KEY } from '../lib/accent-shift';
import { customDeckStore, deckKey } from '../lib/custom-decks';
import { saveSelection } from '../lib/deck-selection';
import { saveFlashcardSettings } from '../lib/flashcard-settings';
import { focusPassageStore } from '../lib/focus-passages';
import { buildTableModels, getQuizCells } from '../lib/paradigm-quiz';
import { paradigmCardKey } from '../lib/paradigm-srs';
import { saveQuizSettings } from '../lib/quiz-settings';
import { markSessionComplete } from '../lib/study-streak';
import { saveLadderProgress } from '../lib/suffix-ladder';
import { setLastSyncedAt } from '../lib/sync-manager';
import { saveBudget } from '../lib/today';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

/** Reviewed today, so due again in the future rather than now. */
const reviewed = (key: string) => nextSRS(newCard(key), 4);

/** The id the seeded focus passage is stored under, for the hub that is opened on it. */
const SEEDED_PASSAGE = 'seeded-passage';

/** A student who has been at it a while: every stored value off its default. */
function seedReturningStudent() {
  const store = Object.fromEntries([
    // Vocabulary: half reviewed, half still due.
    ...vocabulary
      .slice(0, 30)
      .map((w, i) => [cardKey(w), i % 2 ? reviewed(cardKey(w)) : newCard(cardKey(w))]),
    // Every letter of the first writing deck written recently, so nothing is
    // due there — the server, seeing no schedule, would deal the first letter.
    ...buildDecks()[0].glyphs.map((g) => [writingCardKey(g), reviewed(writingCardKey(g))]),
    // Part of a paradigm table answered, so its progress line has numbers in it.
    ...getQuizCells(buildTableModels()[0])
      .filter((c) => c.id)
      .slice(0, 4)
      .map((c) => [paradigmCardKey(c.id as string), reviewed(paradigmCardKey(c.id as string))]),
    // An accent-shift item worked through, so the queue is not all new.
    [accentCardKey('davar-pl'), reviewed(accentCardKey('davar-pl'))],
  ]);
  saveSRSStore(store);

  let stats = emptyStats();
  for (let i = 0; i < 25; i++) stats = recordReview(stats, i % 3 !== 0);
  saveStats(stats);

  saveQuizSettings({ accentStrict: true, density: 'easy' });
  // Two suffix-ladder rungs climbed, so the ladder tab has open rungs past the first.
  saveLadderProgress({ suffixes: 2, sus: 2 });
  saveFlashcardSettings({ showPartOfSpeech: true });
  saveSelection({
    deck: 'garrett-derouchie',
    customDeckId: null,
    chapters: [2, 3],
    categories: ['core'],
  });
  // Two custom decks, one of them deleted: the deck chips, the builder's list
  // and a tombstone in storage all differ from what the server rendered.
  customDeckStore.create('Genesis 1', vocabulary.slice(0, 8).map(deckKey));
  customDeckStore.remove(customDeckStore.create('Deleted', ['x']).id);
  // Two focus passages, one of them deleted: the list, the hub's title and a
  // tombstone in storage all differ from what the server rendered.
  const range = { book: 'GEN', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 5 };
  const stamp = '2026-11-01T00:00:00.000Z';
  focusPassageStore.saveAll([
    { ...range, id: SEEDED_PASSAGE, label: 'Creation', createdAt: stamp, updatedAt: stamp },
  ]);
  focusPassageStore.remove(focusPassageStore.create({ ...range, endVerse: 9 }).id);
  setLastSyncedAt(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
  markReadToday();
  // A Today session finished and a longer budget picked, so the streak line
  // and the picker both differ from the server's defaults.
  markSessionComplete();
  saveBudget(45);
  // Enough scaffold history to unlock speed mode, which changes the step row.
  localStorage.setItem(SCAFFOLD_HISTORY_KEY, JSON.stringify(Array(20).fill(true)));
}

/** One case per island. The key is the component's name as the pages use it. */
const ISLANDS: Record<string, () => ReactElement> = {
  AccentTrainer: () => <AccentTrainer />,
  DailyVerse: () => <DailyVerse />,
  Flashcards: () => <Flashcards />,
  FocusPassageHub: () => <FocusPassageHub passageId={SEEDED_PASSAGE} />,
  FocusPassages: () => <FocusPassages />,
  GrammarReference: () => <GrammarReference />,
  HebrewKeyboard: () => <HebrewKeyboard />,
  HebrewReader: () => <HebrewReader />,
  ParadigmQuiz: () => <ParadigmQuiz />,
  ResetProgress: () => <ResetProgress signedIn />,
  SyncControls: () => <SyncControls />,
  TodaySession: () => <TodaySession />,
  Writing: () => <Writing />,
};

beforeEach(() => {
  localStorage.clear();
  // Data files are fetched after mount. Left pending, so nothing lands
  // mid-test and the comparison is purely first render against first render.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hydration for a returning student', () => {
  it.each(Object.keys(ISLANDS))('%s matches its server HTML', async (name) => {
    expect(await hydrationErrors(ISLANDS[name](), { seed: seedReturningStudent })).toEqual([]);
  });
});

describe('hydration with a custom deck picked', () => {
  // The deck selection is read by Flashcards and by /write's word mode, and
  // Today deals due cards whatever is picked. All three must still match.
  function seedCustomDeckPicked() {
    seedReturningStudent();
    const deck = customDeckStore.load()[0];
    saveSelection({ deck: 'custom', customDeckId: deck.id, chapters: [], categories: ['core'] });
  }

  it.each(['Flashcards', 'Writing', 'TodaySession'])('%s matches its server HTML', async (name) => {
    expect(await hydrationErrors(ISLANDS[name](), { seed: seedCustomDeckPicked })).toEqual([]);
  });

  it('also when the picked deck has since been deleted', async () => {
    const seedGone = () => {
      seedReturningStudent();
      saveSelection({ deck: 'custom', customDeckId: 'gone', chapters: [], categories: ['core'] });
    };
    expect(await hydrationErrors(<Flashcards />, { seed: seedGone })).toEqual([]);
  });
});

describe('the island list', () => {
  it('covers every client:load island on every page', () => {
    const pages = import.meta.glob('../pages/**/*.astro', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const onPages = new Set(
      Object.values(pages).flatMap((src) =>
        [...src.matchAll(/<(\w+)\s[^>]*\bclient:(?:load|idle|visible)\b/g)].map((m) => m[1]),
      ),
    );

    expect([...onPages].sort()).toEqual(Object.keys(ISLANDS).sort());
  });
});
