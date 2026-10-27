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

import { emptyStats, normalizeKey } from '@tools/shared/srs';
import { hydrationErrors } from '@tools/shared/test/hydration';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DailyVerse from '../components/DailyVerse';
import Flashcards from '../components/Flashcards';
import FocusPassageHub from '../components/FocusPassageHub';
import FocusPassageList from '../components/FocusPassageList';
import FocusPassageNew from '../components/FocusPassageNew';
import GNTParseChallenge from '../components/GNTParseChallenge';
import GNTReader from '../components/GNTReader';
import GrammarReference from '../components/GrammarReference';
import GreekInputHub from '../components/GreekInputHub';
import ParadigmQuiz from '../components/ParadigmQuiz';
import ResetProgress from '../components/ResetProgress';
import SyncControls from '../components/SyncControls';
import TranslationPDFExport from '../components/TranslationPDFExport';
import VerbParseChallenge from '../components/VerbParseChallenge';
import { saveCustomDecks } from '../data/customDecks';
import { markReadToday } from '../data/dailyVerses';
import { saveFocusPassages } from '../data/focusPassages';
import { newCard, nextSRS, recordReview, saveSRSStore, saveStats } from '../data/srs';
import { vocabulary } from '../data/vocabulary';
import { saveFlashcardSettings } from '../lib/flashcard-settings';
import { saveQuizSettings } from '../lib/quiz-settings';
import { setLastSyncedAt } from '../lib/sync-manager';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

const PASSAGE_ID = 'returning-student-passage';

/** A student who has been at it a while: every stored value off its default. */
function seedReturningStudent() {
  const keys = vocabulary.slice(0, 30).map((w) => normalizeKey(w.greek));
  const store = Object.fromEntries(
    keys.map((k, i) => [k, i % 2 ? nextSRS(newCard(k), 4) : newCard(k)]),
  );
  saveSRSStore(store);

  let stats = emptyStats();
  for (let i = 0; i < 25; i++) stats = recordReview(stats, i % 3 !== 0);
  saveStats(stats);

  saveQuizSettings({ accentStrict: true, density: 'hard' });
  saveFlashcardSettings({ showPartOfSpeech: true });
  saveCustomDecks([
    { id: 'deck-1', name: 'Romans 8', wordKeys: keys.slice(0, 10), createdAt: '2026-10-01' },
  ]);
  saveFocusPassages([
    {
      id: PASSAGE_ID,
      label: 'Prologue',
      book: 'JHN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 18,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ]);
  setLastSyncedAt(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
  markReadToday();
}

/** One case per island. The key is the component's name as the pages use it. */
const ISLANDS: Record<string, () => ReactElement> = {
  DailyVerse: () => <DailyVerse />,
  Flashcards: () => <Flashcards />,
  FocusPassageHub: () => <FocusPassageHub passageId={PASSAGE_ID} />,
  FocusPassageList: () => <FocusPassageList />,
  FocusPassageNew: () => <FocusPassageNew />,
  GNTParseChallenge: () => <GNTParseChallenge />,
  GNTReader: () => <GNTReader />,
  GrammarReference: () => <GrammarReference />,
  GreekInputHub: () => <GreekInputHub />,
  ParadigmQuiz: () => <ParadigmQuiz />,
  ResetProgress: () => <ResetProgress signedIn />,
  SyncControls: () => <SyncControls />,
  TranslationPDFExport: () => <TranslationPDFExport />,
  VerbParseChallenge: () => <VerbParseChallenge />,
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
