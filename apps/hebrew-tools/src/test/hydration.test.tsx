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
import DailyVerse from '../components/DailyVerse';
import Flashcards from '../components/Flashcards';
import GrammarReference from '../components/GrammarReference';
import HebrewKeyboard from '../components/HebrewKeyboard';
import HebrewReader from '../components/HebrewReader';
import ParadigmQuiz from '../components/ParadigmQuiz';
import ResetProgress from '../components/ResetProgress';
import SyncControls from '../components/SyncControls';
import Writing from '../components/Writing';
import { markReadToday } from '../data/dailyVerses';
import { newCard, nextSRS, recordReview, saveSRSStore, saveStats } from '../data/srs';
import { cardKey, vocabulary } from '../data/vocabulary';
import { buildDecks, writingCardKey } from '../data/writing';
import { saveSelection } from '../lib/deck-selection';
import { saveFlashcardSettings } from '../lib/flashcard-settings';
import { buildTableModels, getQuizCells } from '../lib/paradigm-quiz';
import { paradigmCardKey } from '../lib/paradigm-srs';
import { saveQuizSettings } from '../lib/quiz-settings';
import { setLastSyncedAt } from '../lib/sync-manager';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

/** Reviewed today, so due again in the future rather than now. */
const reviewed = (key: string) => nextSRS(newCard(key), 4);

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
  ]);
  saveSRSStore(store);

  let stats = emptyStats();
  for (let i = 0; i < 25; i++) stats = recordReview(stats, i % 3 !== 0);
  saveStats(stats);

  saveQuizSettings({ accentStrict: true, density: 'easy' });
  saveFlashcardSettings({ showPartOfSpeech: true });
  saveSelection({ deck: 'garrett-derouchie', chapters: [2, 3], categories: ['core'] });
  setLastSyncedAt(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
  markReadToday();
}

/** One case per island. The key is the component's name as the pages use it. */
const ISLANDS: Record<string, () => ReactElement> = {
  DailyVerse: () => <DailyVerse />,
  Flashcards: () => <Flashcards />,
  GrammarReference: () => <GrammarReference />,
  HebrewKeyboard: () => <HebrewKeyboard />,
  HebrewReader: () => <HebrewReader />,
  ParadigmQuiz: () => <ParadigmQuiz />,
  ResetProgress: () => <ResetProgress signedIn />,
  SyncControls: () => <SyncControls />,
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
