import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusPassage } from '../data/focusPassages';
import { loadFocusPassages, saveFocusPassages } from '../data/focusPassages';
import FocusPassageList from './FocusPassageList';

vi.mock('../data/morphgnt', () => ({
  fetchBooks: vi.fn(),
}));

import { fetchBooks } from '../data/morphgnt';

const mockFetchBooks = vi.mocked(fetchBooks);

const STUB_BOOKS = [
  { code: 'REV', name: 'Revelation', chapters: 22 },
  { code: 'JHN', name: 'John', chapters: 21 },
];

function makePassage(overrides: Partial<FocusPassage> = {}): FocusPassage {
  return {
    id: 'passage-1',
    book: 'REV',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 11,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockFetchBooks.mockResolvedValue(STUB_BOOKS);
});

describe('FocusPassageList', () => {
  describe('empty state', () => {
    it('shows empty state when no passages saved', () => {
      render(<FocusPassageList />);
      expect(screen.getByText('No focus passages yet.')).toBeInTheDocument();
    });

    it('shows a "Create your first" link when empty', () => {
      render(<FocusPassageList />);
      expect(screen.getByRole('link', { name: /create your first/i })).toBeInTheDocument();
    });
  });

  describe('with passages', () => {
    it('shows passage count when passages exist', async () => {
      saveFocusPassages([makePassage()]);
      render(<FocusPassageList />);
      await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
      expect(screen.getByText(/1 passage saved/i)).toBeInTheDocument();
    });

    it('renders a passage card with its label', async () => {
      saveFocusPassages([makePassage({ label: 'My Study Passage' })]);
      render(<FocusPassageList />);
      await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
      expect(screen.getByText('My Study Passage')).toBeInTheDocument();
    });

    it('shows passage reference using book name from fetched books', async () => {
      saveFocusPassages([makePassage()]);
      render(<FocusPassageList />);
      await waitFor(() => {
        expect(screen.getByText(/Revelation/)).toBeInTheDocument();
      });
    });

    it('uses book code as fallback before books load', () => {
      mockFetchBooks.mockReturnValue(new Promise(() => {}));
      saveFocusPassages([makePassage()]);
      render(<FocusPassageList />);
      expect(screen.getByText(/REV/)).toBeInTheDocument();
    });

    it('shows plural passage count for multiple passages', async () => {
      saveFocusPassages([makePassage({ id: 'a' }), makePassage({ id: 'b' })]);
      render(<FocusPassageList />);
      await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());
      expect(screen.getByText(/2 passages saved/i)).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it('removes a passage after delete is confirmed', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      saveFocusPassages([makePassage({ id: 'del-1', label: 'To Delete' })]);
      render(<FocusPassageList />);
      await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());

      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteBtn);

      expect(screen.queryByText('To Delete')).not.toBeInTheDocument();
      expect(loadFocusPassages()).toHaveLength(0);
    });

    it('keeps passage if confirm is cancelled', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
      saveFocusPassages([makePassage({ id: 'keep-1', label: 'Keep Me' })]);
      render(<FocusPassageList />);
      await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());

      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteBtn);

      expect(screen.getByText('Keep Me')).toBeInTheDocument();
    });
  });

  describe('rename', () => {
    it('shows an input when pencil button is clicked', async () => {
      const user = userEvent.setup();
      saveFocusPassages([makePassage({ label: 'Original Label' })]);
      render(<FocusPassageList />);
      await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());

      const renameBtn = screen.getByRole('button', { name: /rename/i });
      await user.click(renameBtn);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('commits rename on Enter', async () => {
      const user = userEvent.setup();
      saveFocusPassages([makePassage({ id: 'rename-1', label: 'Old Name' })]);
      render(<FocusPassageList />);
      await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());

      const renameBtn = screen.getByRole('button', { name: /rename/i });
      await user.click(renameBtn);
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New Name{Enter}');

      expect(screen.getByText('New Name')).toBeInTheDocument();
    });

    it('cancels rename on Escape', async () => {
      const user = userEvent.setup();
      saveFocusPassages([makePassage({ label: 'Original' })]);
      render(<FocusPassageList />);
      await waitFor(() => expect(mockFetchBooks).toHaveBeenCalled());

      const renameBtn = screen.getByRole('button', { name: /rename/i });
      await user.click(renameBtn);
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'Abandoned{Escape}');

      expect(screen.queryByText('Abandoned')).not.toBeInTheDocument();
    });
  });
});
