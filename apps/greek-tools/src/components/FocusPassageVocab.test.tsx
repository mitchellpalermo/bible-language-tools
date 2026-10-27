import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusPassage } from '../data/focusPassages';
import type { MorphBook } from '../data/morphgnt';
import FocusPassageVocab from './FocusPassageVocab';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), captureException: vi.fn() },
}));

vi.mock('../data/morphgnt', () => ({
  fetchBook: vi.fn(),
}));

vi.mock('../data/vocabulary', () => ({
  vocabulary: [{ greek: 'καί', gloss: 'and', frequency: 9164, partOfSpeech: 'conjunction' }],
}));

vi.mock('../lib/passage-deck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/passage-deck')>();
  return {
    ...actual,
    extractPassageLemmas: vi.fn().mockReturnValue([]),
    buildVocabMap: vi.fn().mockReturnValue(new Map()),
  };
});

import { fetchBook } from '../data/morphgnt';
import { extractPassageLemmas } from '../lib/passage-deck';

const mockFetchBook = vi.mocked(fetchBook);
const mockExtractPassageLemmas = vi.mocked(extractPassageLemmas);

const STUB_BOOK: MorphBook = {
  '1': {
    '1': [{ text: 'λύει', lemma: 'test-verb', pos: 'V-', parsing: '3PAI-S--' }],
  },
};

const STUB_PASSAGE: FocusPassage = {
  id: 'vocab-test-1',
  book: 'REV',
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockFetchBook.mockResolvedValue(STUB_BOOK);
  mockExtractPassageLemmas.mockReturnValue([]);
});

describe('FocusPassageVocab', () => {
  it('shows loading state initially', () => {
    mockFetchBook.mockReturnValue(new Promise(() => {}));
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    expect(screen.getByText(/loading vocabulary/i)).toBeInTheDocument();
  });

  it('shows "No vocabulary words found" when passage has no matching vocab', async () => {
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => {
      expect(screen.getByText(/no vocabulary words found/i)).toBeInTheDocument();
    });
  });
});

describe('FocusPassageVocab loading lifecycle', () => {
  it('transitions out of loading state after fetch resolves', async () => {
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.queryByText(/loading vocabulary/i)).not.toBeInTheDocument());
  });
});

describe('FocusPassageVocab with vocab data', () => {
  beforeEach(() => {
    mockExtractPassageLemmas.mockReturnValue(['καί']);
  });

  it('shows the Greek word on the card', async () => {
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
  });

  it('shows SRS Review and Study All mode toggles', async () => {
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'SRS Review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Study All' })).toBeInTheDocument();
  });

  it('shows direction toggles', async () => {
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Gr → En' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En → Gr' })).toBeInTheDocument();
  });

  it('shows Flip and Type answer mode toggles', async () => {
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Flip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument();
  });

  it('flips card on click to reveal gloss', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByText('καί'));
    expect(screen.getByText('and')).toBeInTheDocument();
  });

  it('shows the four grade buttons after flip', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByText('καί'));
    expect(screen.getByRole('button', { name: /^good/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^again/i })).toBeInTheDocument();
  });

  it('shows Session Complete after grading Good on the last card', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByText('καί'));
    await waitFor(() => expect(screen.getByRole('button', { name: /^good/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^good/i }));
    await waitFor(() => expect(screen.getByText(/session complete/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /study again/i })).toBeInTheDocument();
  });

  it('shows Session Complete after grading Again on the last card', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByText('καί'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^again/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /^again/i }));
    await waitFor(() => expect(screen.getByText(/session complete/i)).toBeInTheDocument());
  });

  it('restarts session when Study Again is clicked', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    // Switch to Study All so the card is always available after restart
    await user.click(screen.getByRole('button', { name: 'Study All' }));
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByText('καί'));
    await user.click(screen.getByRole('button', { name: /^good/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /study again/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /study again/i }));
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
  });

  it('switches to Study All mode', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Study All' }));
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
  });

  it('switches direction to En → Gr and shows gloss on front', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'En → Gr' }));
    await waitFor(() => expect(screen.getByText('and')).toBeInTheDocument());
  });

  it('switches to Type mode and shows input field', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Type' }));
    expect(screen.getByPlaceholderText(/type the english gloss/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
  });

  it('type mode: correct answer shows Correct feedback', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Type' }));
    const input = screen.getByPlaceholderText(/type the english gloss/i);
    await user.type(input, 'and');
    await user.click(screen.getByRole('button', { name: /check/i }));
    await waitFor(() => expect(screen.getByText(/correct/i)).toBeInTheDocument());
  });

  it('type mode: wrong answer shows Not quite feedback', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Type' }));
    const input = screen.getByPlaceholderText(/type the english gloss/i);
    await user.type(input, 'wrong answer xyz');
    await user.click(screen.getByRole('button', { name: /check/i }));
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeInTheDocument());
  });

  it('type mode: after submitting shows the grade buttons', async () => {
    const user = userEvent.setup();
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Type' }));
    const input = screen.getByPlaceholderText(/type the english gloss/i);
    await user.type(input, 'and');
    await user.click(screen.getByRole('button', { name: /check/i }));
    await waitFor(() => expect(screen.getByText(/correct/i)).toBeInTheDocument());
    // After a checked answer the full grade row appears — auto-checking says
    // whether the spelling matched, not how hard the recall was.
    expect(screen.getByRole('button', { name: /^good/i })).toBeInTheDocument();
  });

  it('shows "No cards due" in SRS mode when all cards are reviewed', async () => {
    // Pre-populate SRS store with a future due date so the word is not due
    const futureStore = {
      καί: {
        key: 'καί',
        interval: 7,
        repetition: 3,
        easeFactor: 2.5,
        dueDate: '2099-12-31',
        lastReviewed: '2026-06-01',
      },
    };
    localStorage.setItem('greek-tools-srs-v2', JSON.stringify(futureStore));
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.getByText(/no cards due/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /study all anyway/i })).toBeInTheDocument();
  });

  it('"Study all anyway" switches to all mode from the no-cards-due state', async () => {
    const user = userEvent.setup();
    const futureStore = {
      καί: {
        key: 'καί',
        interval: 7,
        repetition: 3,
        easeFactor: 2.5,
        dueDate: '2099-12-31',
        lastReviewed: '2026-06-01',
      },
    };
    localStorage.setItem('greek-tools-srs-v2', JSON.stringify(futureStore));
    render(<FocusPassageVocab passage={STUB_PASSAGE} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /study all anyway/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /study all anyway/i }));
    await waitFor(() => expect(screen.getByText('καί')).toBeInTheDocument());
  });
});
