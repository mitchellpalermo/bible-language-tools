import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusPassage } from '../data/focusPassages';
import { saveFocusPassages } from '../data/focusPassages';
import type { MorphBook } from '../data/morphgnt';
import FocusPassageHub from './FocusPassageHub';

vi.mock('../data/morphgnt', () => ({
  fetchBooks: vi.fn(),
  fetchBook: vi.fn(),
  splitWordPunct: vi.fn((text: string) => [text, '']),
}));

vi.mock('../lib/passage-deck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/passage-deck')>();
  return {
    ...actual,
    extractPassageLemmas: vi.fn().mockReturnValue([]),
    buildVocabMap: vi.fn().mockReturnValue(new Map()),
  };
});

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), captureException: vi.fn() },
}));

import { fetchBook, fetchBooks } from '../data/morphgnt';

const mockFetchBooks = vi.mocked(fetchBooks);
const mockFetchBook = vi.mocked(fetchBook);

const STUB_BOOKS = [{ code: 'REV', name: 'Revelation', chapters: 22 }];

const STUB_BOOK: MorphBook = {
  '1': {
    '1': [{ text: 'λύει', lemma: 'test-verb', pos: 'V-', parsing: '3PAIS---' }],
  },
};

const STUB_PASSAGE: FocusPassage = {
  id: 'hub-test-1',
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
  mockFetchBooks.mockResolvedValue(STUB_BOOKS);
  mockFetchBook.mockResolvedValue(STUB_BOOK);
});

describe('FocusPassageHub', () => {
  it('shows "Passage not found" when passage id does not exist', async () => {
    render(<FocusPassageHub passageId="does-not-exist" />);
    await waitFor(() => {
      expect(screen.getByText(/passage not found/i)).toBeInTheDocument();
    });
  });

  it('links back to /focus when passage not found', async () => {
    render(<FocusPassageHub passageId="does-not-exist" />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /back to focus passages/i })).toBeInTheDocument();
    });
  });

  it('renders tab bar once passage loads', async () => {
    saveFocusPassages([STUB_PASSAGE]);
    render(<FocusPassageHub passageId="hub-test-1" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reader' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Vocab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parsing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Progress' })).toBeInTheDocument();
  });

  it('shows passage label in heading when set', async () => {
    saveFocusPassages([{ ...STUB_PASSAGE, label: 'My Passage' }]);
    render(<FocusPassageHub passageId="hub-test-1" />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'My Passage' })).toBeInTheDocument();
    });
  });

  it('switches to Vocab tab on click', async () => {
    const user = userEvent.setup();
    saveFocusPassages([STUB_PASSAGE]);
    render(<FocusPassageHub passageId="hub-test-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vocab' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Vocab' }));
    await waitFor(() =>
      expect(screen.getByText(/no vocabulary words found/i)).toBeInTheDocument(),
    );
  });

  it('switches to Parsing tab on click', async () => {
    const user = userEvent.setup();
    saveFocusPassages([STUB_PASSAGE]);
    render(<FocusPassageHub passageId="hub-test-1" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Parsing' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Parsing' }));
    expect(screen.getByText(/start parsing/i)).toBeInTheDocument();
  });

  it('switches to Progress tab on click', async () => {
    const user = userEvent.setup();
    saveFocusPassages([STUB_PASSAGE]);
    render(<FocusPassageHub passageId="hub-test-1" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Progress' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Progress' }));
    await waitFor(() => expect(screen.getByText(/parse grade/i)).toBeInTheDocument());
  });
});
