import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GNTPassageSettings } from '../lib/gnt-parse';
import { DEFAULT_GNT_SETTINGS } from '../lib/gnt-parse';
import PassageSelector from './PassageSelector';

vi.mock('../data/morphgnt', () => ({
  fetchBooks: vi.fn(),
}));

import { fetchBooks } from '../data/morphgnt';

const mockFetchBooks = vi.mocked(fetchBooks);

const STUB_BOOKS = [
  { code: 'JHN', name: 'John', chapters: 21 },
  { code: 'REV', name: 'Revelation', chapters: 22 },
];

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockFetchBooks.mockResolvedValue(STUB_BOOKS);
});

function renderSelector(
  settings: GNTPassageSettings = DEFAULT_GNT_SETTINGS,
  opts: { verbCount?: number | null; verseCount?: number | null; loading?: boolean } = {},
  onChange = vi.fn(),
  onStart = vi.fn(),
) {
  const { verbCount = 5, verseCount = 20, loading = false } = opts;
  return render(
    <PassageSelector
      settings={settings}
      verbCount={verbCount}
      verseCount={verseCount}
      onChange={onChange}
      onStart={onStart}
      loading={loading}
    />,
  );
}

describe('PassageSelector', () => {
  it('renders book, chapter, and verse selects', async () => {
    renderSelector();
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
    expect(screen.getByLabelText('Book')).toBeInTheDocument();
    expect(screen.getByLabelText('Chapter')).toBeInTheDocument();
    expect(screen.getByLabelText('Verse')).toBeInTheDocument();
  });

  it('shows verb count text', () => {
    renderSelector(DEFAULT_GNT_SETTINGS, { verbCount: 7, verseCount: 20 });
    expect(screen.getByText(/7 verb forms in this passage/i)).toBeInTheDocument();
  });

  it('shows "No verbs found" when verbCount is 0', () => {
    renderSelector(DEFAULT_GNT_SETTINGS, { verbCount: 0, verseCount: 20 });
    expect(screen.getByText(/no verbs found/i)).toBeInTheDocument();
  });

  it('shows loading text when loading', () => {
    renderSelector(DEFAULT_GNT_SETTINGS, { loading: true, verbCount: null, verseCount: null });
    expect(screen.getByRole('button', { name: /loading…/i })).toBeDisabled();
  });

  it('Start Parsing is enabled when verbCount > 0 and not loading', () => {
    renderSelector(DEFAULT_GNT_SETTINGS, { verbCount: 5, verseCount: 20, loading: false });
    expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled();
  });

  it('Start Parsing is disabled when verbCount is 0', () => {
    renderSelector(DEFAULT_GNT_SETTINGS, { verbCount: 0, verseCount: 20 });
    expect(screen.getByRole('button', { name: /start parsing/i })).toBeDisabled();
  });

  it('Start Parsing is disabled while loading', () => {
    renderSelector(DEFAULT_GNT_SETTINGS, { loading: true, verbCount: null, verseCount: null });
    expect(screen.getByRole('button', { name: /loading…/i })).toBeDisabled();
  });

  it('calls onStart when Start Parsing is clicked', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    renderSelector(DEFAULT_GNT_SETTINGS, { verbCount: 5, verseCount: 20 }, vi.fn(), onStart);
    await user.click(screen.getByRole('button', { name: /start parsing/i }));
    expect(onStart).toHaveBeenCalled();
  });

  it('calls onChange when book changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(DEFAULT_GNT_SETTINGS, { verbCount: 5, verseCount: 20 }, onChange);
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
    const bookSelect = screen.getByLabelText('Book');
    await user.selectOptions(bookSelect, 'REV');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ book: 'REV', chapter: 1, verseStart: 1 }),
    );
  });

  it('calls onChange when chapter changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(
      { ...DEFAULT_GNT_SETTINGS, book: 'JHN' },
      { verbCount: 5, verseCount: 21 },
      onChange,
    );
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
    const chapterSelect = screen.getByLabelText('Chapter');
    await user.selectOptions(chapterSelect, '3');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ chapter: 3, verseStart: 1 }));
  });

  it('calls onChange when start verse changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(
      { ...DEFAULT_GNT_SETTINGS, verseStart: 1 },
      { verbCount: 5, verseCount: 20 },
      onChange,
    );
    const verseSelect = screen.getByLabelText('Verse');
    await user.selectOptions(verseSelect, '3');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ verseStart: 3 }));
  });

  it('shows session length buttons with All', () => {
    renderSelector();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('shows "Skip repeat verbs" checkbox', () => {
    renderSelector();
    expect(screen.getByRole('checkbox', { name: /skip repeat verbs/i })).toBeInTheDocument();
  });

  it('calls onChange when skip repeated lemmas checkbox changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector(DEFAULT_GNT_SETTINGS, {}, onChange);
    const checkbox = screen.getByRole('checkbox', { name: /skip repeat verbs/i });
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ skipRepeatedLemmas: true }));
  });
});
