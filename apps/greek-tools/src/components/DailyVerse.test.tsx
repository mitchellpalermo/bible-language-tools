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
import { loadAttempts } from '../lib/attempt-log';
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

  describe('parsing the verse (#249)', () => {
    // One finite verb and one participle, around a word that is not a verb.
    const VERBS_VERSE = [
      { text: 'ἦν', lemma: 'εἰμί', pos: 'V-', parsing: '3IAI-S--' },
      { text: 'ὁ', lemma: 'ὁ', pos: 'RA', parsing: '----NSM-' },
      { text: 'λέγων.', lemma: 'λέγω', pos: 'V-', parsing: '-PAPNSM-' },
    ];
    const VERBS_BOOK = new Proxy({} as MorphBook, {
      get: () => new Proxy({}, { get: () => VERBS_VERSE }),
    });

    beforeEach(() => mockFetchBook.mockResolvedValue(VERBS_BOOK));

    const highlighted = () => document.querySelector('[data-highlighted]');

    async function start(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: 'Parse this verse' }));
    }

    async function answerFinite(user: ReturnType<typeof userEvent.setup>) {
      await user.selectOptions(screen.getByLabelText('Tense'), 'imperfect');
      await user.selectOptions(screen.getByLabelText('Voice'), 'active');
      await user.selectOptions(screen.getByLabelText('Mood'), 'indicative');
      await user.selectOptions(screen.getByLabelText('Person'), '3rd');
      await user.selectOptions(screen.getByLabelText('Number'), 'singular');
      await user.click(screen.getByRole('button', { name: 'Submit' }));
    }

    // Wrong on tense: the participle is present, answered aorist.
    async function missParticiple(user: ReturnType<typeof userEvent.setup>) {
      await user.selectOptions(screen.getByLabelText('Tense'), 'aorist');
      await user.selectOptions(screen.getByLabelText('Voice'), 'active');
      await user.selectOptions(screen.getByLabelText('Mood'), 'participle');
      await user.selectOptions(screen.getByLabelText('Case'), 'nominative');
      await user.selectOptions(screen.getByLabelText('Number'), 'singular');
      await user.selectOptions(screen.getByLabelText('Gender'), 'masculine');
      await user.click(screen.getByRole('button', { name: 'Submit' }));
    }

    it('opens in reading mode, and offers the quiz only when the verse has a verb', async () => {
      dailyDoseLesson();
      render(<DailyVerse />);

      expect(await screen.findByRole('button', { name: 'Parse this verse' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
      expect(highlighted()).toBeNull();
    });

    it('hides the button when the verse has no verb MorphGNT can parse', async () => {
      mockFetchBook.mockResolvedValue(ANY_BOOK);
      dailyDoseLesson();
      render(<DailyVerse />);

      await screen.findByText('— Matthew 23:17');
      expect(screen.queryByRole('button', { name: 'Parse this verse' })).not.toBeInTheDocument();
    });

    it('asks each verb in text order, inline, with the verse still in view', async () => {
      const user = userEvent.setup();
      const path = window.location.href;
      dailyDoseLesson();
      render(<DailyVerse />);
      await start(user);

      expect(screen.getByText('— Matthew 23:17')).toBeInTheDocument();
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(highlighted()).toHaveTextContent('ἦν');
      // The verse is on screen already; the question does not draw it again.
      expect(screen.getAllByText('λέγων')).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Parse this verse' })).not.toBeInTheDocument();

      await answerFinite(user);
      expect(screen.getByText('Correct!')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Next Form' }));

      expect(highlighted()).toHaveTextContent('λέγων');
      expect(window.location.href).toBe(path);
    });

    it('keeps the word popup shut while a verb is being asked', async () => {
      const user = userEvent.setup();
      dailyDoseLesson();
      render(<DailyVerse />);
      await start(user);

      await user.click(highlighted() as Element);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes an open popup when the quiz starts', async () => {
      const user = userEvent.setup();
      dailyDoseLesson();
      render(<DailyVerse />);

      await user.click(await screen.findByText('ἦν'));
      expect(screen.getByRole('dialog', { name: 'Word info: εἰμί' })).toBeInTheDocument();
      await start(user);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ends on a summary that reviews the missed verb, and logs every answer', async () => {
      const user = userEvent.setup();
      dailyDoseLesson();
      render(<DailyVerse />);
      await start(user);

      await answerFinite(user);
      await user.click(screen.getByRole('button', { name: 'Next Form' }));
      await missParticiple(user);
      expect(screen.getByText('Not quite — review the corrections above.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'See Results' }));

      expect(screen.getByText('Session Score')).toBeInTheDocument();
      expect(highlighted()).toBeNull();
      expect(loadAttempts().map((a) => [a.concept, a.correct])).toEqual([
        ['parse/daily/imperfect-active-indicative', true],
        ['parse/daily/present-active-participle', false],
      ]);

      await user.click(screen.getByRole('button', { name: 'Review Missed (1)' }));
      expect(screen.getByText('1 / 1')).toBeInTheDocument();
      expect(highlighted()).toHaveTextContent('λέγων');
    });

    it('scrolls the quiz into view when it opens and when a round restarts', async () => {
      // On a phone the quiz opens below a long verse; without this the only
      // visible change is the highlight.
      const scrollIntoView = vi.fn();
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = scrollIntoView;
      try {
        const user = userEvent.setup();
        dailyDoseLesson();
        render(<DailyVerse />);
        await start(user);
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }));

        // Answering does not move the page.
        await answerFinite(user);
        await user.click(screen.getByRole('button', { name: 'Next Form' }));
        await missParticiple(user);
        await user.click(screen.getByRole('button', { name: 'See Results' }));
        expect(scrollIntoView).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button', { name: 'Try Again' }));
        expect(scrollIntoView).toHaveBeenCalledTimes(2);
      } finally {
        Element.prototype.scrollIntoView = original;
      }
    });

    it('starts the round again from the summary', async () => {
      const user = userEvent.setup();
      dailyDoseLesson();
      render(<DailyVerse />);
      await start(user);
      await answerFinite(user);
      await user.click(screen.getByRole('button', { name: 'Next Form' }));
      await missParticiple(user);
      await user.click(screen.getByRole('button', { name: 'See Results' }));

      await user.click(screen.getByRole('button', { name: 'Try Again' }));
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(highlighted()).toHaveTextContent('ἦν');
    });

    it('goes back to reading at any point, keeping the answers given', async () => {
      const user = userEvent.setup();
      dailyDoseLesson();
      render(<DailyVerse />);
      await start(user);
      await answerFinite(user);

      await user.click(screen.getByRole('button', { name: 'Close quiz' }));

      expect(screen.queryByRole('button', { name: 'Next Form' })).not.toBeInTheDocument();
      expect(highlighted()).toBeNull();
      expect(loadAttempts()).toHaveLength(1);
      // Reading mode again: the popup works and the quiz can start over.
      await user.click(screen.getByText('ἦν'));
      expect(screen.getByRole('dialog', { name: 'Word info: εἰμί' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Parse this verse' })).toBeInTheDocument();
    });

    it('goes back to reading from the summary', async () => {
      const user = userEvent.setup();
      dailyDoseLesson();
      render(<DailyVerse />);
      await start(user);
      await answerFinite(user);
      await user.click(screen.getByRole('button', { name: 'Next Form' }));
      await missParticiple(user);
      await user.click(screen.getByRole('button', { name: 'See Results' }));

      await user.click(screen.getByRole('button', { name: 'Close quiz' }));
      expect(screen.queryByText('Session Score')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Parse this verse' })).toBeInTheDocument();
    });

    it('reports the start, each answer and the finish', async () => {
      const user = userEvent.setup();
      dailyDoseLesson();
      render(<DailyVerse />);
      await start(user);
      await answerFinite(user);
      await user.click(screen.getByRole('button', { name: 'Next Form' }));
      await missParticiple(user);
      await user.click(screen.getByRole('button', { name: 'See Results' }));

      expect(mockCapture).toHaveBeenCalledWith('daily_verse_parse_started', {
        verse_reference: 'Matthew 23:17',
        source: 'daily_dose',
        verb_count: 2,
      });
      expect(mockCapture).toHaveBeenCalledWith('daily_verse_parse_answered', {
        verse_reference: 'Matthew 23:17',
        verb_type: 'finite',
        all_correct: true,
      });
      expect(mockCapture).toHaveBeenCalledWith('daily_verse_parse_answered', {
        verse_reference: 'Matthew 23:17',
        verb_type: 'participle',
        all_correct: false,
      });
      expect(mockCapture).toHaveBeenCalledWith('daily_verse_parse_finished', {
        verse_reference: 'Matthew 23:17',
        correct: 1,
        total: 2,
      });
    });

    it('works on the curated fallback verse, and says so', async () => {
      const user = userEvent.setup();
      mockFetchDailyDose.mockResolvedValue({ ok: false, reason: 'network' });
      render(<DailyVerse />);
      await start(user);

      expect(mockCapture).toHaveBeenCalledWith(
        'daily_verse_parse_started',
        expect.objectContaining({ source: 'curated', verse_reference: getTodayVerse().displayRef }),
      );
      expect(highlighted()).toHaveTextContent('ἦν');
    });
  });
});
