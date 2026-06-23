import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data/morphgnt', () => ({
  fetchBook: vi.fn(),
  fetchBooks: vi.fn(),
}));

vi.mock('../lib/pdf-export', () => ({
  extractVerses: vi.fn(),
  buildTranslationPDF: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

import posthog from 'posthog-js';
import { fetchBook, fetchBooks } from '../data/morphgnt';
import { buildTranslationPDF, extractVerses } from '../lib/pdf-export';
import TranslationPDFExport from './TranslationPDFExport';

const mockFetchBook = vi.mocked(fetchBook);
const mockFetchBooks = vi.mocked(fetchBooks);
const mockExtractVerses = vi.mocked(extractVerses);
const mockBuildPDF = vi.mocked(buildTranslationPDF);

const BOOK_DATA = { '1': { '1': [], '2': [], '3': [] } };
const BOOKS = [{ code: 'REV', name: 'Revelation', chapters: 22 }];
const FAKE_VERSE = { chapter: 1, verse: 1, words: [] };
const FAKE_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

function setupDefaultMocks() {
  mockFetchBooks.mockResolvedValue(BOOKS);
  mockFetchBook.mockResolvedValue(BOOK_DATA);
  mockExtractVerses.mockReturnValue([FAKE_VERSE]);
  mockBuildPDF.mockResolvedValue(FAKE_PDF);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

  // Reset location to base export page (no ref param)
  window.location.href = 'http://localhost/export';
});

describe('TranslationPDFExport — rendering', () => {
  it('renders the heading and description', async () => {
    render(<TranslationPDFExport />);
    expect(screen.getByText('Export for Translation Practice')).toBeInTheDocument();
    expect(screen.getByText(/printable PDF/i)).toBeInTheDocument();
  });

  it('renders the Download PDF button', async () => {
    render(<TranslationPDFExport />);
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
  });

  it('renders the passage selector', async () => {
    render(<TranslationPDFExport />);
    // CrossChapterSelector renders labels without htmlFor; query by visible text
    expect(screen.getByText('Book')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });
});

describe('TranslationPDFExport — export flow', () => {
  it('calls fetchBook, extractVerses, and buildTranslationPDF on export', async () => {
    const user = userEvent.setup();
    render(<TranslationPDFExport />);

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => expect(mockFetchBook).toHaveBeenCalled());
    expect(mockExtractVerses).toHaveBeenCalled();
    expect(mockBuildPDF).toHaveBeenCalled();
  });

  it('shows "Generating PDF…" while the export is in progress', async () => {
    let resolve!: (v: Uint8Array) => void;
    mockBuildPDF.mockReturnValue(new Promise((res) => { resolve = res; }));

    const user = userEvent.setup();
    render(<TranslationPDFExport />);

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    expect(await screen.findByRole('button', { name: /generating/i })).toBeDisabled();

    resolve(FAKE_PDF);
  });

  it('creates a blob URL and revokes it after the download', async () => {
    const user = userEvent.setup();
    render(<TranslationPDFExport />);

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob)));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('fires a posthog event after successful export', async () => {
    const user = userEvent.setup();
    render(<TranslationPDFExport />);

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() =>
      expect(posthog.capture).toHaveBeenCalledWith(
        'translation_pdf_exported',
        expect.objectContaining({ book: expect.any(String) }),
      ),
    );
  });
});

describe('TranslationPDFExport — error states', () => {
  it('shows an error message when extractVerses returns no verses', async () => {
    mockExtractVerses.mockReturnValue([]);
    const user = userEvent.setup();
    render(<TranslationPDFExport />);

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    expect(await screen.findByText(/no verses found/i)).toBeInTheDocument();
  });

  it('shows an error message when buildTranslationPDF rejects', async () => {
    mockBuildPDF.mockRejectedValue(new Error('Font load failed'));
    const user = userEvent.setup();
    render(<TranslationPDFExport />);

    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    expect(await screen.findByText(/font load failed/i)).toBeInTheDocument();
  });

  it('re-enables the button after an error', async () => {
    mockBuildPDF.mockRejectedValue(new Error('oops'));
    const user = userEvent.setup();
    render(<TranslationPDFExport />);

    await user.click(screen.getByRole('button', { name: /download pdf/i }));
    await screen.findByText(/oops/i);

    expect(screen.getByRole('button', { name: /download pdf/i })).not.toBeDisabled();
  });
});

describe('TranslationPDFExport — URL pre-population', () => {
  it('pre-fills book and chapter from ?ref= when present', async () => {
    window.location.href = 'http://localhost/export?ref=JHN.3';
    mockFetchBook.mockResolvedValue({
      '3': { '1': [], '2': [], '3': [], '36': [] },
    });

    render(<TranslationPDFExport />);

    // fetchBook is called twice: once for URL pre-population, once on export click
    await waitFor(() => expect(mockFetchBook).toHaveBeenCalledWith('JHN'));
  });

  it('does not crash when fetchBook fails during URL pre-population', async () => {
    window.location.href = 'http://localhost/export?ref=JHN.3';
    mockFetchBook.mockRejectedValueOnce(new Error('network error'));

    expect(() => render(<TranslationPDFExport />)).not.toThrow();
  });

  it('renders normally when no ?ref= param is present', async () => {
    render(<TranslationPDFExport />);
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
  });
});
