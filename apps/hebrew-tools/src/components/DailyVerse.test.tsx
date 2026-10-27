import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import posthog from 'posthog-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyVerseRef } from '../data/dailyVerses';
import {
  clearMorphhbCache,
  type HebrewBook,
  type HebrewBookMeta,
  type LemmaIndex,
  READER_PREFS_KEY,
} from '../data/morphhb';
import { newCard, saveSRSStore } from '../data/srs';
import { cardKey, vocabulary } from '../data/vocabulary';
import DailyVerse from './DailyVerse';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

// The curated verse for "today" is whatever a test says it is, so a test does
// not depend on the date it runs on. Everything else in the module is real.
let curated: DailyVerseRef;
vi.mock('../data/dailyVerses', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/dailyVerses')>()),
  getTodayVerse: () => curated,
}));

const BOOKS: HebrewBookMeta[] = [
  { code: 'GEN', name: 'Genesis', hebrew: 'בְּרֵאשִׁית', section: 'torah', chapters: 50, words: 9 },
  { code: 'ISA', name: 'Isaiah', hebrew: 'יְשַׁעְיָהוּ', section: 'neviim', chapters: 66, words: 9 },
];

const GENESIS: HebrewBook = {
  '1': {
    '1': [
      { text: 'בְּ/רֵאשִׁ֖ית', lemma: '7225', pos: 'Nc', parsing: 'HR/Ncfsa' },
      { text: 'בָּרָ֣א', lemma: '1254a', pos: 'Vq', parsing: 'HVqp3ms' },
      { text: 'אֱלֹהִ֑ים', lemma: '430', pos: 'Nc', parsing: 'HNcmpa', after: '׃' },
    ],
  },
  '32': {
    // A proper name, and a ketiv/qere, in one verse.
    '29': [
      { text: 'יִשְׂרָאֵ֑ל', lemma: '3478', pos: 'Np', parsing: 'HNp' },
      { text: 'ו/לא', lemma: '3808', pos: 'Tn', parsing: 'HC/Tn', ketiv: true, qere: 'וְ/ל֥/וֹ' },
    ],
  },
};

const ISAIAH: HebrewBook = {
  '9': { '5': [{ text: 'כִּֽי', lemma: '3588a', pos: 'Tc', parsing: 'HTc', after: '׃' }] },
};

const LEMMAS: LemmaIndex = {
  '7225': { count: 51, gloss: 'first, firstfruit' },
  '430': { count: 2598, pos: 'N', gloss: 'gods, God, magistrates' },
  '3478': { count: 2514, pos: 'Np', xlit: 'yiśrāʾēl', gloss: 'he will rule as God, Jisraël' },
};

const lessonPost = (title: string) => ({
  title: { rendered: title },
  link: 'https://dailydoseofscripture.com/hebrew-lesson/',
});

/** What the Daily Dose API answers: a list of posts, or a failure. */
let feed: unknown[] | 'offline';
let corpusDown: boolean;
let booksDown: boolean;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearMorphhbCache();
  vi.clearAllMocks();
  curated = { book: 'ISA', chapter: 9, verse: 5, displayRef: 'Isaiah 9:5', english: 'Isaiah 9:6' };
  feed = [lessonPost('Q&amp;A &#8211; Psalm 23:1'), lessonPost('Genesis 1:1')];
  corpusDown = false;
  booksDown = false;

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.startsWith('https://dailydoseofscripture.com')) {
        if (feed === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
        return Promise.resolve({ ok: true, json: async () => feed } as Response);
      }
      if (url.endsWith('books.json') && booksDown) {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      if (corpusDown && !url.endsWith('books.json')) {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      const body = url.endsWith('books.json')
        ? BOOKS
        : url.endsWith('lemmas.json')
          ? LEMMAS
          : url.endsWith('GEN.json')
            ? GENESIS
            : ISAIAH;
      return Promise.resolve({ ok: true, json: async () => body } as Response);
    }),
  );
});

const verseText = () => screen.findByTestId('daily-verse-text');

// ─── The verse ────────────────────────────────────────────────────────────────

describe('today’s Daily Dose lesson', () => {
  it('shows the lesson’s verse, past a Q&A at the top of the feed', async () => {
    render(<DailyVerse />);
    expect(await verseText()).toHaveTextContent('בָּרָ֣א');
    expect(screen.getByText('— Genesis 1:1')).toBeInTheDocument();
  });

  it('gives the reference as a Tanakh prints it, too', async () => {
    render(<DailyVerse />);
    await verseText();
    expect(screen.getByText('בְּרֵאשִׁית א:א')).toHaveAttribute('dir', 'rtl');
  });

  it('links to the lesson and says nothing about a fallback', async () => {
    render(<DailyVerse />);
    await verseText();
    expect(screen.getByRole('link', { name: /Watch the lesson/ })).toHaveAttribute(
      'href',
      'https://dailydoseofscripture.com/hebrew-lesson/',
    );
    expect(screen.queryByText(/reading list/)).not.toBeInTheDocument();
  });

  it('reports the view as a Daily Dose one', async () => {
    render(<DailyVerse />);
    await verseText();
    expect(posthog.capture).toHaveBeenCalledWith('hebrew_daily_verse_viewed', {
      verse_reference: 'Genesis 1:1',
      source: 'daily_dose',
    });
  });

  it('opens the chapter in the reader at the verse', async () => {
    render(<DailyVerse />);
    await verseText();
    expect(screen.getByRole('link', { name: 'Open chapter →' })).toHaveAttribute(
      'href',
      '/reader?ref=GEN.1.1',
    );
  });
});

describe('the curated fallback', () => {
  it('shows today’s curated verse when the feed is unreachable, and says so', async () => {
    feed = 'offline';
    render(<DailyVerse />);
    expect(await verseText()).toHaveTextContent('כִּֽי');
    expect(screen.getByText('— Isaiah 9:5')).toBeInTheDocument();
    expect(screen.getByText(/comes from the hebrew.tools reading list/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Watch the lesson/ })).not.toBeInTheDocument();
    expect(posthog.capture).toHaveBeenCalledWith('hebrew_daily_verse_viewed', {
      verse_reference: 'Isaiah 9:5',
      source: 'curated',
      fallback_reason: 'network',
    });
  });

  it('falls back when the feed has no verse lesson today', async () => {
    feed = [lessonPost('4c &#8211; Inseparable Prepositions')];
    render(<DailyVerse />);
    await verseText();
    expect(posthog.capture).toHaveBeenCalledWith(
      'hebrew_daily_verse_viewed',
      expect.objectContaining({ source: 'curated', fallback_reason: 'no_verse' }),
    );
  });

  it('falls back, and says why, when the lesson’s verse is not in the text', async () => {
    // How a switch to English numbering in the feed would first show up.
    feed = [lessonPost('Genesis 50:26')];
    render(<DailyVerse />);
    expect(await verseText()).toHaveTextContent('כִּֽי');
    expect(posthog.capture).toHaveBeenCalledWith(
      'hebrew_daily_verse_viewed',
      expect.objectContaining({ source: 'curated', fallback_reason: 'not_in_text' }),
    );
  });

  it('explains a verse English Bibles number differently', async () => {
    feed = 'offline';
    render(<DailyVerse />);
    await verseText();
    expect(screen.getByTestId('english-numbering')).toHaveTextContent(
      'English Bibles number this verse Isaiah 9:6',
    );
  });

  it('says nothing about numbering when the two agree', async () => {
    render(<DailyVerse />);
    await verseText();
    expect(screen.queryByTestId('english-numbering')).not.toBeInTheDocument();
  });

  it('still shows the curated verse when the book index will not load', async () => {
    booksDown = true;
    render(<DailyVerse />);
    expect(await verseText()).toHaveTextContent('כִּֽי');
    // Without the index there is no Hebrew book name to print.
    expect(screen.queryByText(/יְשַׁעְיָהוּ/)).not.toBeInTheDocument();
  });

  it('shows an error when the text itself will not load', async () => {
    corpusDown = true;
    render(<DailyVerse />);
    expect(await screen.findByText(/Could not load today’s verse/)).toBeInTheDocument();
  });
});

// ─── Reading aids ─────────────────────────────────────────────────────────────

describe('cantillation', () => {
  it('follows the reader’s preference, and saves a change back to it', async () => {
    const user = userEvent.setup();
    render(<DailyVerse />);
    expect(await verseText()).toHaveTextContent('בָּרָ֣א');

    await user.click(screen.getByRole('button', { name: 'Cantillation' }));
    expect(await verseText()).toHaveTextContent('בָּרָא');
    expect(JSON.parse(localStorage.getItem(READER_PREFS_KEY) ?? '{}')).toMatchObject({
      cantillation: false,
    });
  });
});

describe('words', () => {
  it('open the shared word popup, which closes on a tap elsewhere', async () => {
    const user = userEvent.setup();
    render(<DailyVerse />);
    const text = await verseText();

    await user.click(within(text).getByText('בָּרָ֣א'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByText('— Genesis 1:1'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks a studied word and explains the mark', async () => {
    const word = vocabulary.find((w) => w.strong === '430');
    if (!word) throw new Error('no vocabulary entry for 430');
    saveSRSStore({ [cardKey(word)]: { ...newCard(cardKey(word)), repetition: 2 } });

    render(<DailyVerse />);
    await verseText();
    expect(screen.getByText('dotted underline')).toBeInTheDocument();
    expect(screen.queryByText('dashed underline')).not.toBeInTheDocument();
  });

  it('explains a qere only when the verse carries one', async () => {
    feed = [lessonPost('Genesis 32:29')];
    render(<DailyVerse />);
    await verseText();
    expect(screen.getByText('dashed underline')).toBeInTheDocument();
  });
});

// ─── Streak ───────────────────────────────────────────────────────────────────

describe('the streak', () => {
  it('counts opening the page as today’s reading', async () => {
    render(<DailyVerse />);
    expect(await screen.findByText(/1-day streak/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('hebrew-tools-daily-v1') ?? '{}').streak).toBe(1);
  });

  it('carries on from yesterday', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    localStorage.setItem('hebrew-tools-daily-v1', JSON.stringify({ streak: 3, lastReadDate: y }));

    render(<DailyVerse />);
    expect(await screen.findByText('4-day streak')).toBeInTheDocument();
  });

  it('is its own key, not the flashcards streak', async () => {
    render(<DailyVerse />);
    await verseText();
    expect(localStorage.getItem('hebrew-tools-stats-v1')).toBeNull();
  });
});
