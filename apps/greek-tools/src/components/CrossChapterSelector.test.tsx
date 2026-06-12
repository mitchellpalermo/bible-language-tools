import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MorphBook } from '../data/morphgnt';
import CrossChapterSelector, {
  DEFAULT_CROSS_CHAPTER_RANGE,
  type CrossChapterRange,
} from './CrossChapterSelector';

vi.mock('../data/morphgnt', () => ({
  fetchBooks: vi.fn(),
  fetchBook: vi.fn(),
}));

import { fetchBook, fetchBooks } from '../data/morphgnt';

const mockFetchBooks = vi.mocked(fetchBooks);
const mockFetchBook = vi.mocked(fetchBook);

const STUB_BOOKS = [
  { code: 'REV', name: 'Revelation', chapters: 22 },
  { code: 'JHN', name: 'John', chapters: 21 },
];

const STUB_BOOK: MorphBook = {
  '1': {
    '1': [{ text: 'λύει', lemma: 'test-verb', pos: 'V-', parsing: '3PAIS---' }],
    '2': [{ text: 'λόγος', lemma: 'test-noun', pos: 'N-', parsing: '--------' }],
    '3': [{ text: 'θεός', lemma: 'test-noun2', pos: 'N-', parsing: '--------' }],
  },
  '2': {
    '1': [{ text: 'ἐν', lemma: 'test-prep', pos: 'P-', parsing: '--------' }],
  },
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockFetchBooks.mockResolvedValue(STUB_BOOKS);
  mockFetchBook.mockResolvedValue(STUB_BOOK);
});

function renderSelector(
  value: CrossChapterRange = DEFAULT_CROSS_CHAPTER_RANGE,
  onChange = vi.fn(),
) {
  return render(<CrossChapterSelector value={value} onChange={onChange} />);
}

describe('CrossChapterSelector', () => {
  it('renders book, start, and end selects', async () => {
    renderSelector();
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
    expect(screen.getByLabelText('Book')).toBeInTheDocument();
    expect(screen.getAllByText('Chapter').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Verse').length).toBeGreaterThan(0);
  });

  it('shows GNT_BOOKS fallback while books are loading', () => {
    mockFetchBooks.mockReturnValue(new Promise(() => {}));
    renderSelector();
    const bookSelect = screen.getByLabelText('Book');
    expect(bookSelect.querySelectorAll('option').length).toBeGreaterThan(0);
  });

  it('populates book options once books load', async () => {
    renderSelector();
    await waitFor(() => {
      const bookSelect = screen.getByLabelText('Book');
      expect(bookSelect.querySelector('option[value="JHN"]')).toBeInTheDocument();
    });
  });

  it('calls onChange when book is changed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(DEFAULT_CROSS_CHAPTER_RANGE, onChange);
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
    const bookSelect = screen.getByLabelText('Book');
    await user.selectOptions(bookSelect, 'JHN');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ book: 'JHN', startChapter: 1, startVerse: 1 }),
    );
  });

  it('calls onChange when start chapter changes, advancing end chapter if needed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(
      { book: 'REV', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 3 },
      onChange,
    );
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    const [startChapterSelect] = screen.getAllByLabelText('Chapter');
    await user.selectOptions(startChapterSelect, '2');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ startChapter: 2, endChapter: 2 }),
    );
  });

  it('calls onChange when start verse changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(
      { book: 'REV', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 3 },
      onChange,
    );
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    const [startVerseSelect] = screen.getAllByLabelText('Verse');
    await user.selectOptions(startVerseSelect, '2');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ startVerse: 2 }));
  });

  it('calls onChange when end chapter changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(
      { book: 'REV', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 2 },
      onChange,
    );
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    const chapterSelects = screen.getAllByLabelText('Chapter');
    await user.selectOptions(chapterSelects[1], '2');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ endChapter: 2 }));
  });

  it('calls onChange when end verse changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(
      { book: 'REV', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 2 },
      onChange,
    );
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    const verseSelects = screen.getAllByLabelText('Verse');
    await user.selectOptions(verseSelects[1], '2');
    expect(onChange).toHaveBeenCalled();
  });

  it('limits end chapter options to those >= start chapter', async () => {
    renderSelector({ book: 'REV', startChapter: 3, startVerse: 1, endChapter: 3, endVerse: 1 });
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    const chapterSelects = screen.getAllByLabelText('Chapter');
    const endChapterOptions = Array.from(chapterSelects[1].querySelectorAll('option')).map(
      (o) => Number((o as HTMLOptionElement).value),
    );
    expect(endChapterOptions.every((n) => n >= 3)).toBe(true);
  });
});
