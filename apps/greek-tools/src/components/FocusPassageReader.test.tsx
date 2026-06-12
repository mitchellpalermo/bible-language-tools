import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusPassage } from '../data/focusPassages';
import type { MorphBook } from '../data/morphgnt';
import FocusPassageReader from './FocusPassageReader';

vi.mock('../data/morphgnt', () => ({
  fetchBook: vi.fn(),
  splitWordPunct: vi.fn((text: string) => [text, '']),
}));

vi.mock('../data/srs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/srs')>();
  return { ...actual, getStudiedLemmas: vi.fn().mockReturnValue(new Set()) };
});

vi.mock('./GreekText', () => ({
  WordToken: ({ word }: { word: { text: string } }) => <span>{word.text}</span>,
  WordPopup: () => <div data-testid="word-popup" />,
}));

import { fetchBook } from '../data/morphgnt';

const mockFetchBook = vi.mocked(fetchBook);

const STUB_BOOK: MorphBook = {
  '1': {
    '1': [
      { text: 'Ἐν', lemma: 'ἐν', pos: 'P-', parsing: '--------' },
      { text: 'ἀρχῇ', lemma: 'ἀρχή', pos: 'N-', parsing: '--------' },
    ],
    '2': [{ text: 'ἦν', lemma: 'εἰμί', pos: 'V-', parsing: '3IAISF--' }],
  },
  '2': {
    '1': [{ text: 'ὁ', lemma: 'ὁ', pos: 'RA', parsing: '--------' }],
  },
};

const SINGLE_CHAPTER_PASSAGE: FocusPassage = {
  id: 'reader-test-1',
  book: 'JHN',
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const MULTI_CHAPTER_PASSAGE: FocusPassage = {
  id: 'reader-test-2',
  book: 'JHN',
  startChapter: 1,
  startVerse: 1,
  endChapter: 2,
  endVerse: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockFetchBook.mockResolvedValue(STUB_BOOK);
});

describe('FocusPassageReader', () => {
  it('shows loading state initially', () => {
    mockFetchBook.mockReturnValue(new Promise(() => {}));
    render(<FocusPassageReader passage={SINGLE_CHAPTER_PASSAGE} />);
    expect(screen.getByText(/loading…/i)).toBeInTheDocument();
  });

  it('shows error when book fetch fails', async () => {
    mockFetchBook.mockResolvedValue(null as unknown as MorphBook);
    render(<FocusPassageReader passage={SINGLE_CHAPTER_PASSAGE} />);
    await waitFor(() => {
      expect(screen.getByText(/could not load passage/i)).toBeInTheDocument();
    });
  });

  it('renders passage words after loading', async () => {
    render(<FocusPassageReader passage={SINGLE_CHAPTER_PASSAGE} />);
    await waitFor(() => {
      expect(screen.getByText('Ἐν')).toBeInTheDocument();
    });
  });

  it('shows Show/Hide glosses toggle button', async () => {
    render(<FocusPassageReader passage={SINGLE_CHAPTER_PASSAGE} />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /show glosses/i })).toBeInTheDocument();
  });

  it('toggles to "Hide glosses" after clicking', async () => {
    const user = userEvent.setup();
    render(<FocusPassageReader passage={SINGLE_CHAPTER_PASSAGE} />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /show glosses/i });
    await user.click(btn);
    expect(screen.getByRole('button', { name: /hide glosses/i })).toBeInTheDocument();
  });

  it('shows chapter headings for multi-chapter passages', async () => {
    render(<FocusPassageReader passage={MULTI_CHAPTER_PASSAGE} />);
    await waitFor(() => {
      expect(screen.getByText(/chapter 1/i)).toBeInTheDocument();
    });
  });

  it('does not show chapter headings for single-chapter passages', async () => {
    render(<FocusPassageReader passage={SINGLE_CHAPTER_PASSAGE} />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    expect(screen.queryByText(/chapter \d/i)).not.toBeInTheDocument();
  });

  it('only renders verses within the passage range', async () => {
    const passage: FocusPassage = {
      ...SINGLE_CHAPTER_PASSAGE,
      startVerse: 2,
      endVerse: 2,
    };
    render(<FocusPassageReader passage={passage} />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    expect(screen.getByText('ἦν')).toBeInTheDocument();
    expect(screen.queryByText('Ἐν')).not.toBeInTheDocument();
  });
});
