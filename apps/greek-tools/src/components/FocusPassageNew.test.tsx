import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MorphBook } from '../data/morphgnt';
import FocusPassageNew from './FocusPassageNew';

vi.mock('../data/morphgnt', () => ({
  fetchBooks: vi.fn(),
  fetchBook: vi.fn(),
}));

vi.mock('../lib/passage-deck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/passage-deck')>();
  return {
    ...actual,
    extractPassageLemmas: vi.fn().mockReturnValue(['test-lemma']),
    buildVocabMap: vi.fn().mockReturnValue(new Map()),
  };
});

vi.mock('../lib/gnt-parse', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/gnt-parse')>();
  return {
    ...actual,
    extractVerbsMultiChapter: vi.fn().mockReturnValue([]),
  };
});

import { fetchBook, fetchBooks } from '../data/morphgnt';

const mockFetchBooks = vi.mocked(fetchBooks);
const mockFetchBook = vi.mocked(fetchBook);

const STUB_BOOKS = [
  { code: 'REV', name: 'Revelation', chapters: 22 },
  { code: 'JHN', name: 'John', chapters: 21 },
];

const STUB_BOOK: MorphBook = {
  '1': {
    '1': [
      { text: 'λύει', lemma: 'test-verb', pos: 'V-', parsing: '3PAIS---' },
      { text: 'λόγος', lemma: 'test-noun', pos: 'N-', parsing: '--------' },
    ],
    '2': [{ text: 'θεός', lemma: 'test-noun2', pos: 'N-', parsing: '--------' }],
  },
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockFetchBooks.mockResolvedValue(STUB_BOOKS);
  mockFetchBook.mockResolvedValue(STUB_BOOK);
});

describe('FocusPassageNew', () => {
  it('shows "New Focus Passage" heading on initial render', () => {
    render(<FocusPassageNew />);
    expect(screen.getByRole('heading', { name: /new focus passage/i })).toBeInTheDocument();
  });

  it('renders the CrossChapterSelector', async () => {
    render(<FocusPassageNew />);
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
    expect(screen.getByLabelText('Book')).toBeInTheDocument();
  });

  it('shows "Preview Passage" button on select step', () => {
    render(<FocusPassageNew />);
    expect(screen.getByRole('button', { name: /preview passage/i })).toBeInTheDocument();
  });

  it('disables preview button while loading', async () => {
    const user = userEvent.setup();
    mockFetchBook.mockReturnValue(new Promise(() => {}));
    render(<FocusPassageNew />);
    await user.click(screen.getByRole('button', { name: /preview passage/i }));
    expect(screen.getByRole('button', { name: /loading…/i })).toBeDisabled();
  });

  it('advances to preview step after clicking Preview', async () => {
    const user = userEvent.setup();
    render(<FocusPassageNew />);
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());

    const previewBtn = screen.getByRole('button', { name: /preview passage/i });
    await user.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create focus passage/i })).toBeInTheDocument();
    });
  });

  it('shows vocab and verb counts on preview step', async () => {
    const user = userEvent.setup();
    render(<FocusPassageNew />);
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /preview passage/i }));

    await waitFor(() => {
      expect(screen.getByText(/vocabulary words/i)).toBeInTheDocument();
      expect(screen.getByText(/verb forms/i)).toBeInTheDocument();
    });
  });

  it('shows Back button on preview step', async () => {
    const user = userEvent.setup();
    render(<FocusPassageNew />);
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /preview passage/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /← back/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /← back/i }));
    expect(screen.getByRole('button', { name: /preview passage/i })).toBeInTheDocument();
  });

  it('shows name input on preview step', async () => {
    const user = userEvent.setup();
    render(<FocusPassageNew />);
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /preview passage/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\./i)).toBeInTheDocument();
    });
  });
});
