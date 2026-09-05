import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MorphBook } from '../data/morphgnt';
import GNTParseChallenge from './GNTParseChallenge';

vi.mock('../data/morphgnt', () => ({
  fetchBooks: vi.fn(),
  fetchBook: vi.fn(),
  splitWordPunct: vi.fn((text: string) => [text, '']),
}));

import { fetchBook, fetchBooks } from '../data/morphgnt';

const mockFetchBooks = vi.mocked(fetchBooks);
const mockFetchBook = vi.mocked(fetchBook);

const STUB_BOOKS = [
  { code: 'JHN', name: 'John', chapters: 21 },
  { code: 'REV', name: 'Revelation', chapters: 22 },
];

const STUB_BOOK: MorphBook = {
  '1': {
    '1': [
      { text: 'λύει', lemma: 'λύω', pos: 'V-', parsing: '3PAI-S--' },
      { text: 'λύεις', lemma: 'λύω', pos: 'V-', parsing: '2PAI-S--' },
      { text: 'λύω', lemma: 'λύω', pos: 'V-', parsing: '1PAI-S--' },
    ],
    '2': [{ text: 'λύομεν', lemma: 'λύω', pos: 'V-', parsing: '1PAI-P--' }],
  },
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockFetchBooks.mockResolvedValue(STUB_BOOKS);
  mockFetchBook.mockResolvedValue(STUB_BOOK);
});

describe('GNTParseChallenge', () => {
  it('renders the PassageSelector on initial load', async () => {
    render(<GNTParseChallenge />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /start parsing/i })).toBeInTheDocument();
  });

  it('shows verb count after loading', async () => {
    render(<GNTParseChallenge />);
    await waitFor(() => {
      expect(screen.getByText(/verb form/)).toBeInTheDocument();
    });
  });

  it('shows book selector', async () => {
    render(<GNTParseChallenge />);
    await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
    expect(screen.getByLabelText('Book')).toBeInTheDocument();
  });

  it('starts a session and shows a parse question', async () => {
    const user = userEvent.setup();
    render(<GNTParseChallenge />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: /start parsing/i }));
    expect(screen.getByText(/parse the highlighted form/i)).toBeInTheDocument();
  });

  it('shows session length selector buttons', async () => {
    render(<GNTParseChallenge />);
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    mockFetchBook.mockReturnValue(new Promise(() => {}));
    render(<GNTParseChallenge />);
    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();
  });

  it('completes a full question → feedback → results flow', async () => {
    const user = userEvent.setup();
    render(<GNTParseChallenge />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );
    // Use "All" so we use all available verbs
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('button', { name: /start parsing/i }));

    // Fill in answer
    await user.selectOptions(screen.getByLabelText('Tense'), 'present');
    await user.selectOptions(screen.getByLabelText('Voice'), 'active');
    await user.selectOptions(screen.getByLabelText('Mood'), 'indicative');
    // Finite fields should appear
    await waitFor(() => expect(screen.getByLabelText('Person')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Person'), '3rd');
    await user.selectOptions(screen.getByLabelText('Number'), 'singular');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Should be on feedback
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('shows Session Score after completing all verbs', async () => {
    const user = userEvent.setup();
    render(<GNTParseChallenge />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('button', { name: /start parsing/i }));

    // 4 verbs in the stub book — cycle through all of them
    for (let i = 0; i < 4; i++) {
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

  it('can return to settings via Change Settings from results', async () => {
    const user = userEvent.setup();
    render(<GNTParseChallenge />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: 'All' }));
    await user.click(screen.getByRole('button', { name: /start parsing/i }));

    for (let i = 0; i < 4; i++) {
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

    await waitFor(() => expect(screen.getByText(/session score/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /change settings/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).toBeInTheDocument(),
    );
  }, 30000);
});
