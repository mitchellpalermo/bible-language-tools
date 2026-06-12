import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FocusPassage } from '../data/focusPassages';
import { recordParseSession } from '../data/focusPassages';
import type { MorphBook } from '../data/morphgnt';
import FocusPassageProgress from './FocusPassageProgress';

vi.mock('../data/morphgnt', () => ({
  fetchBook: vi.fn(),
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

const mockFetchBook = vi.mocked(fetchBook);

const STUB_BOOK: MorphBook = {
  '1': {
    '1': [{ text: 'λύει', lemma: 'test-verb', pos: 'V-', parsing: '3PAIS---' }],
  },
};

const STUB_PASSAGE: FocusPassage = {
  id: 'prog-test-1',
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
});

describe('FocusPassageProgress', () => {
  it('shows loading state initially', () => {
    mockFetchBook.mockReturnValue(new Promise(() => {}));
    render(<FocusPassageProgress passage={STUB_PASSAGE} />);
    expect(screen.getByText(/loading progress/i)).toBeInTheDocument();
  });

  it('shows "No vocabulary data yet" when passage has no matched vocab', async () => {
    render(<FocusPassageProgress passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.queryByText(/loading progress/i)).not.toBeInTheDocument());
    expect(screen.getByText(/no vocabulary data yet/i)).toBeInTheDocument();
  });

  it('shows parse grade section', async () => {
    render(<FocusPassageProgress passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.queryByText(/loading progress/i)).not.toBeInTheDocument());
    expect(screen.getByText(/parse grade/i)).toBeInTheDocument();
  });

  it('shows "—" grade when no parse sessions have been recorded', async () => {
    render(<FocusPassageProgress passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.queryByText(/loading progress/i)).not.toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows "No parse sessions yet" when no history exists', async () => {
    render(<FocusPassageProgress passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.queryByText(/loading progress/i)).not.toBeInTheDocument());
    expect(screen.getByText(/no parse sessions yet/i)).toBeInTheDocument();
  });

  it('shows accuracy and grade when parse history exists', async () => {
    recordParseSession('prog-test-1', 9, 10);
    render(<FocusPassageProgress passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.queryByText(/loading progress/i)).not.toBeInTheDocument());
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
    expect(screen.getByText(/90% accuracy/)).toBeInTheDocument();
  });

  it('shows grade scale legend when grade is not "—"', async () => {
    recordParseSession('prog-test-1', 5, 10);
    render(<FocusPassageProgress passage={STUB_PASSAGE} />);
    await waitFor(() => expect(screen.queryByText(/loading progress/i)).not.toBeInTheDocument());
    expect(screen.getByText(/≥90%/)).toBeInTheDocument();
  });
});
