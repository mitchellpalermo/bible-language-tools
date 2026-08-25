import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MorphBook, MorphVerse } from '../data/morphgnt';
import CrossChapterSelector, {
  type CrossChapterRange,
  DEFAULT_CROSS_CHAPTER_RANGE,
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
    const endChapterOptions = Array.from(chapterSelects[1].querySelectorAll('option')).map((o) =>
      Number((o as HTMLOptionElement).value),
    );
    expect(endChapterOptions.every((n) => n >= 3)).toBe(true);
  });
});

// The export page mounts on the default book and switches to the `?ref=` book a
// tick later, so two fetches are in flight at once. The larger book's response
// tends to land second — Revelation is roughly fifty times the size of Philemon
// — which is how Philemon's dropdowns ended up capped at Revelation 1's verse
// count of 20.
describe('CrossChapterSelector — overlapping book fetches', () => {
  function bookOf(verses: number): MorphBook {
    const chapter: Record<string, MorphVerse> = {};
    for (let v = 1; v <= verses; v++) chapter[String(v)] = [];
    return { '1': chapter };
  }

  const RACE_BOOKS = [
    { code: 'REV', name: 'Revelation', chapters: 22 },
    { code: 'PHM', name: 'Philemon', chapters: 1 },
  ];
  const REV_VERSES = 20;
  const PHM_VERSES = 25;

  /** A promise plus the handle to settle it, so tests control resolution order. */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  function verseOptions(which: 'start' | 'end'): number[] {
    const [startVerse, endVerse] = screen.getAllByLabelText('Verse');
    const select = which === 'start' ? startVerse : endVerse;
    return Array.from(select.querySelectorAll('option')).map((o) =>
      Number((o as HTMLOptionElement).value),
    );
  }

  /** Mirrors the export page: default book on mount, `?ref=` book a tick later. */
  function Harness() {
    const [range, setRange] = useState<CrossChapterRange>(DEFAULT_CROSS_CHAPTER_RANGE);
    useEffect(() => {
      setRange((r) => ({ ...r, book: 'PHM', endVerse: 1 }));
    }, []);
    return <CrossChapterSelector value={range} onChange={setRange} />;
  }

  it('ignores the previous book when its response lands last', async () => {
    const rev = deferred<MorphBook>();
    const phm = deferred<MorphBook>();
    mockFetchBooks.mockResolvedValue(RACE_BOOKS);
    mockFetchBook.mockImplementation((code: string) =>
      code === 'PHM' ? phm.promise : rev.promise,
    );

    render(<Harness />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalledWith('PHM'));
    expect(mockFetchBook).toHaveBeenCalledWith('REV');

    // Philemon first, then the superseded Revelation request — the order that
    // used to overwrite Philemon's data.
    await act(async () => {
      phm.resolve(bookOf(PHM_VERSES));
      await phm.promise;
    });
    await act(async () => {
      rev.resolve(bookOf(REV_VERSES));
      await rev.promise;
    });

    await waitFor(() => expect(verseOptions('start')).toHaveLength(PHM_VERSES));
    expect(verseOptions('end')).toHaveLength(PHM_VERSES);
    expect(verseOptions('end').at(-1)).toBe(PHM_VERSES);
  });

  it('never sizes the dropdowns from a book other than the selected one', async () => {
    const rev = deferred<MorphBook>();
    const phm = deferred<MorphBook>();
    mockFetchBooks.mockResolvedValue(RACE_BOOKS);
    mockFetchBook.mockImplementation((code: string) =>
      code === 'PHM' ? phm.promise : rev.promise,
    );

    render(<Harness />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalledWith('PHM'));

    // Revelation lands while Philemon is still in flight: the dropdowns must
    // not show Revelation's 20 verses, even briefly.
    await act(async () => {
      rev.resolve(bookOf(REV_VERSES));
      await rev.promise;
    });
    expect(verseOptions('end')).not.toHaveLength(REV_VERSES);

    await act(async () => {
      phm.resolve(bookOf(PHM_VERSES));
      await phm.promise;
    });
    await waitFor(() => expect(verseOptions('end')).toHaveLength(PHM_VERSES));
  });
});
