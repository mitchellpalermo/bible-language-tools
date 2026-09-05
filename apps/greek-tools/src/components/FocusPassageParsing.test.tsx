import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusPassage } from '../data/focusPassages';
import type { MorphBook } from '../data/morphgnt';
import FocusPassageParsing from './FocusPassageParsing';

vi.mock('../data/morphgnt', () => ({
  fetchBook: vi.fn(),
  fetchBooks: vi.fn(),
  splitWordPunct: vi.fn((text: string) => [text, '']),
}));

import { fetchBook, fetchBooks } from '../data/morphgnt';

const mockFetchBook = vi.mocked(fetchBook);
const mockFetchBooks = vi.mocked(fetchBooks);

const STUB_BOOKS = [{ code: 'REV', name: 'Revelation', chapters: 22 }];

const STUB_BOOK: MorphBook = {
  '1': {
    '1': [
      { text: 'λύει', lemma: 'λύω', pos: 'V-', parsing: '3PAI-S--' },
      { text: 'λύεις', lemma: 'λύω', pos: 'V-', parsing: '2PAI-S--' },
      { text: 'λύω', lemma: 'λύω', pos: 'V-', parsing: '1PAI-S--' },
    ],
  },
};

const STUB_PASSAGE: FocusPassage = {
  id: 'parsing-test-1',
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
  mockFetchBooks.mockResolvedValue(STUB_BOOKS);
});

describe('FocusPassageParsing', () => {
  it('shows loading state initially', () => {
    mockFetchBook.mockReturnValue(new Promise(() => {}));
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    expect(screen.getByRole('button', { name: /loading…/i })).toBeDisabled();
  });

  it('shows verb count after loading', async () => {
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    await waitFor(() => {
      expect(screen.getByText(/3 verb forms in this passage/i)).toBeInTheDocument();
    });
  });

  it('shows session length buttons', async () => {
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('shows Start Parsing button', async () => {
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /start parsing/i })).toBeInTheDocument();
  });

  it('shows "No verbs found" when passage has no verbs', async () => {
    mockFetchBook.mockResolvedValue({
      '1': { '1': [{ text: 'ἐν', lemma: 'ἐν', pos: 'P-', parsing: '--------' }] },
    });
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    await waitFor(() => {
      expect(screen.getByText(/no verbs found/i)).toBeInTheDocument();
    });
  });

  it('starts a session and shows parse question', async () => {
    const user = userEvent.setup();
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: /start parsing/i }));
    expect(screen.getByText(/parse the highlighted form/i)).toBeInTheDocument();
  });

  it('toggles skip repeat verbs checkbox', async () => {
    const user = userEvent.setup();
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    const checkbox = screen.getByRole('checkbox', { name: /skip repeat verbs/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('changes session length when a button is clicked', async () => {
    const user = userEvent.setup();
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: '10' }));
    // The 10 button should now be active (accent border/bg style)
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });

  it('completes a full session and shows Session Score', async () => {
    const user = userEvent.setup();
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );

    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('button', { name: /start parsing/i }));

    // 3 verbs in the stub book — cycle through all of them
    for (let i = 0; i < 3; i++) {
      await waitFor(() =>
        expect(screen.getByText(/parse the highlighted form/i)).toBeInTheDocument(),
      );
      await user.selectOptions(screen.getByLabelText('Tense'), 'present');
      await user.selectOptions(screen.getByLabelText('Voice'), 'active');
      await user.selectOptions(screen.getByLabelText('Mood'), 'indicative');
      await waitFor(() => expect(screen.getByLabelText('Person')).toBeInTheDocument());
      await user.selectOptions(screen.getByLabelText('Person'), '1st');
      await user.selectOptions(screen.getByLabelText('Number'), 'singular');
      await user.click(screen.getByRole('button', { name: /submit/i }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /next form|see results/i })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: /next form|see results/i }));
    }

    await waitFor(() => {
      expect(screen.getByText(/session score/i)).toBeInTheDocument();
    });
  }, 30000);

  it('skips repeated verbs by lemma when checkbox is checked', async () => {
    const user = userEvent.setup();
    // All 3 stub verbs share the same lemma λύω; with deduplication only 1 remains
    render(<FocusPassageParsing passage={STUB_PASSAGE} bookName="Revelation" />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    const checkbox = screen.getByRole('checkbox', { name: /skip repeat verbs/i });
    await user.click(checkbox);
    await waitFor(() =>
      expect(screen.getByText(/1 verb form in this passage/i)).toBeInTheDocument(),
    );
  });
});
