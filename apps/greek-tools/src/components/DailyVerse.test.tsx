import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MorphBook } from '../data/morphgnt';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), captureException: vi.fn() },
}));

vi.mock('../data/dailyDose', () => ({
  fetchDailyDoseVerse: vi.fn(),
}));

vi.mock('../data/morphgnt', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/morphgnt')>()),
  fetchBook: vi.fn(),
}));

import posthog from 'posthog-js';
import { fetchDailyDoseVerse } from '../data/dailyDose';
import { getTodayVerse } from '../data/dailyVerses';
import { fetchBook } from '../data/morphgnt';
import DailyVerse from './DailyVerse';

const mockFetchDailyDose = vi.mocked(fetchDailyDoseVerse);
const mockFetchBook = vi.mocked(fetchBook);
const mockCapture = vi.mocked(posthog.capture);

const LESSON_LINK = 'https://dailydoseofscripture.com/greek-matthew-2317/';

// Every chapter and verse resolves to the same two words, so the curated
// fallback verse renders whichever one today happens to be.
const ANY_VERSE = [
  { text: 'μωροὶ', lemma: 'μωρός', pos: 'A-', parsing: '----VPM-' },
  { text: 'καὶ', lemma: 'καί', pos: 'C-', parsing: '--------' },
];
const ANY_BOOK = new Proxy({} as MorphBook, {
  get: () => new Proxy({}, { get: () => ANY_VERSE }),
});

function dailyDoseLesson() {
  mockFetchDailyDose.mockResolvedValue({
    ok: true,
    verse: { book: 'MAT', chapter: 23, verse: 17, displayRef: 'Matthew 23:17' },
    link: LESSON_LINK,
  });
}

describe('DailyVerse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetchBook.mockResolvedValue(ANY_BOOK);
  });

  describe("when today's Daily Dose lesson loads", () => {
    beforeEach(dailyDoseLesson);

    it('shows that verse and links to its lesson', async () => {
      render(<DailyVerse />);

      expect(await screen.findByText('— Matthew 23:17')).toBeInTheDocument();
      expect(mockFetchBook).toHaveBeenCalledWith('MAT');
      expect(
        screen.getByRole('link', {
          name: 'Watch the lesson on this verse from Daily Dose of Scripture',
        }),
      ).toHaveAttribute('href', LESSON_LINK);
      expect(screen.getByRole('link', { name: 'Open chapter →' })).toHaveAttribute(
        'href',
        '/reader?ref=MAT.23.17',
      );
      expect(screen.queryByText(/didn't load/)).not.toBeInTheDocument();
    });

    it('reports the verse as coming from Daily Dose', async () => {
      render(<DailyVerse />);

      await waitFor(() =>
        expect(mockCapture).toHaveBeenCalledWith('daily_verse_viewed', {
          verse_reference: 'Matthew 23:17',
          source: 'daily_dose',
        }),
      );
    });
  });

  describe('when the Daily Dose lesson does not load', () => {
    beforeEach(() => {
      mockFetchDailyDose.mockResolvedValue({ ok: false, reason: 'network' });
    });

    it('shows the curated verse, says where it came from, and offers no lesson link', async () => {
      const curated = getTodayVerse();
      render(<DailyVerse />);

      expect(await screen.findByText(`— ${curated.displayRef}`)).toBeInTheDocument();
      expect(mockFetchBook).toHaveBeenCalledWith(curated.book);
      expect(screen.getByText(/greek\.tools reading list/)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Daily Dose/ })).not.toBeInTheDocument();
    });

    // Without this, a broken feed looks exactly like a working one in PostHog.
    it('reports the fallback and why it happened', async () => {
      render(<DailyVerse />);

      await waitFor(() =>
        expect(mockCapture).toHaveBeenCalledWith('daily_verse_viewed', {
          verse_reference: getTodayVerse().displayRef,
          source: 'curated',
          fallback_reason: 'network',
        }),
      );
    });
  });

  it('shows an error and records no view when the verse text cannot load', async () => {
    dailyDoseLesson();
    mockFetchBook.mockRejectedValue(new Error('404 MAT.json'));
    render(<DailyVerse />);

    expect(await screen.findByText('Could not load verse: 404 MAT.json')).toBeInTheDocument();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('counts the visit toward the reading streak', async () => {
    dailyDoseLesson();
    render(<DailyVerse />);

    expect(await screen.findByText('1-day streak — keep it going!')).toBeInTheDocument();
  });

  it('toggles glosses and opens a word on click', async () => {
    const user = userEvent.setup();
    dailyDoseLesson();
    render(<DailyVerse />);

    await user.click(await screen.findByRole('button', { name: 'Show glosses' }));
    expect(screen.getByRole('button', { name: 'Hide glosses' })).toBeInTheDocument();

    await user.click(screen.getByText('μωροὶ'));
    expect(screen.getByRole('dialog', { name: 'Word info: μωρός' })).toBeInTheDocument();
  });
});
