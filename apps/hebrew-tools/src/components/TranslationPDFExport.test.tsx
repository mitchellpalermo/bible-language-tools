import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data/morphhb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/morphhb')>()),
  fetchBook: vi.fn(),
  fetchBooks: vi.fn(),
}));

vi.mock('../lib/pdf-export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/pdf-export')>()),
  buildHebrewPDF: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

import posthog from 'posthog-js';
import { fetchBook, fetchBooks, READER_PREFS_KEY } from '../data/morphhb';
import { buildHebrewPDF } from '../lib/pdf-export';
import TranslationPDFExport from './TranslationPDFExport';

const word = (text: string) => ({ text, lemma: 'x', pos: 'Nc', parsing: 'HNcmsa' });
const BOOK = {
  '1': { '1': [word('א')], '2': [word('ב')], '3': [word('ג')], '4': [word('ד')] },
  '2': { '1': [word('ה')], '2': [word('ו')] },
};
const BOOKS = [
  {
    code: 'GEN',
    name: 'Genesis',
    hebrew: 'בראשית',
    section: 'torah' as const,
    chapters: 50,
    words: 1,
  },
  {
    code: 'EXO',
    name: 'Exodus',
    hebrew: 'שמות',
    section: 'torah' as const,
    chapters: 40,
    words: 1,
  },
];
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function setUrl(search: string) {
  window.history.replaceState(null, '', `/export${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setUrl('');
  vi.mocked(fetchBooks).mockResolvedValue(BOOKS);
  vi.mocked(fetchBook).mockResolvedValue(BOOK);
  vi.mocked(buildHebrewPDF).mockResolvedValue(PDF);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
});

const select = (name: RegExp | string) => screen.getByRole('combobox', { name });

describe('TranslationPDFExport', () => {
  it('renders the controls and a download button', async () => {
    render(<TranslationPDFExport />);
    expect(screen.getByRole('heading', { name: /export for translation practice/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Exodus' })).toBeInTheDocument());
  });

  it('opens on the first three verses of Genesis', async () => {
    render(<TranslationPDFExport />);
    expect(select('Start chapter')).toHaveValue('1');
    expect(select('End verse')).toHaveValue('3');
  });

  it('selects a whole chapter from ?ref=, once the book has loaded', async () => {
    setUrl('?ref=GEN.2');
    render(<TranslationPDFExport />);
    await waitFor(() => expect(select('End verse')).toHaveValue('2'));
    expect(select('Start chapter')).toHaveValue('2');
    expect(select('End chapter')).toHaveValue('2');
    expect(select('Start verse')).toHaveValue('1');
  });

  it('selects the single verse a ?ref= names', async () => {
    setUrl('?ref=GEN.1.2');
    render(<TranslationPDFExport />);
    await waitFor(() => expect(select('Start verse')).toHaveValue('2'));
    expect(select('End verse')).toHaveValue('2');
  });

  it('selects a whole chapter of the new book when the book changes', async () => {
    const user = userEvent.setup();
    render(<TranslationPDFExport />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Exodus' })).toBeInTheDocument());
    await user.selectOptions(select('Book'), 'EXO');
    await waitFor(() => expect(select('End verse')).toHaveValue('4'));
    expect(select('Start chapter')).toHaveValue('1');
  });

  it('keeps the end from falling before the start', async () => {
    const user = userEvent.setup();
    render(<TranslationPDFExport />);
    await waitFor(() => expect(fetchBook).toHaveBeenCalled());
    await user.selectOptions(select('Start verse'), '4');
    await waitFor(() => expect(select('End verse')).toHaveValue('4'));
  });

  it('moves the end to the last verse of a new end chapter', async () => {
    const user = userEvent.setup();
    render(<TranslationPDFExport />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Exodus' })).toBeInTheDocument());
    await user.selectOptions(select('End chapter'), '2');
    expect(select('End verse')).toHaveValue('2');
    await user.selectOptions(select('End verse'), '1');
    expect(select('End verse')).toHaveValue('1');
  });

  it('resets the start verse when the start chapter changes', async () => {
    const user = userEvent.setup();
    render(<TranslationPDFExport />);
    await waitFor(() => expect(fetchBook).toHaveBeenCalled());
    await user.selectOptions(select('Start verse'), '2');
    await user.selectOptions(select('Start chapter'), '2');
    expect(select('Start verse')).toHaveValue('1');
  });

  it('starts cantillation from the reader preference', async () => {
    localStorage.setItem(READER_PREFS_KEY, JSON.stringify({ cantillation: false }));
    render(<TranslationPDFExport />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cantillation' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
  });

  it('offers cantillation only on pointed text', async () => {
    const user = userEvent.setup();
    render(<TranslationPDFExport />);
    expect(screen.getByRole('button', { name: 'Cantillation' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vowel points' }));
    expect(screen.queryByRole('button', { name: 'Cantillation' })).not.toBeInTheDocument();
    expect(screen.getByText(/consonants only/i)).toBeInTheDocument();
  });

  it('builds the PDF with the chosen options and downloads it', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<TranslationPDFExport />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Exodus' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Cantillation' }));
    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    await waitFor(() => expect(buildHebrewPDF).toHaveBeenCalled());
    const [verses, ref, options] = vi.mocked(buildHebrewPDF).mock.calls[0];
    expect(verses).toHaveLength(3);
    expect(ref).toBe('Genesis 1:1–3');
    expect(options).toEqual({ pointing: 'pointed', cantillation: false });
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(posthog.capture).toHaveBeenCalledWith(
      'hebrew_translation_pdf_exported',
      expect.objectContaining({ book: 'GEN', verseCount: 3, pointing: 'pointed' }),
    );
  });

  it('says so when the range has no verses', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchBook).mockResolvedValue({});
    render(<TranslationPDFExport />);
    await user.click(screen.getByRole('button', { name: /download pdf/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no verses/i);
    expect(buildHebrewPDF).not.toHaveBeenCalled();
  });

  it('shows the error when the PDF cannot be built, and recovers', async () => {
    const user = userEvent.setup();
    vi.mocked(buildHebrewPDF).mockRejectedValue(new Error('font failed'));
    render(<TranslationPDFExport />);
    await user.click(screen.getByRole('button', { name: /download pdf/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('font failed');
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeEnabled();
  });

  it('shows the error when the book cannot be loaded', async () => {
    vi.mocked(fetchBook).mockRejectedValue(new Error('HTTP 500'));
    render(<TranslationPDFExport />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500');
  });

  it('still exports when the book list cannot be loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchBooks).mockRejectedValue(new Error('x'));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<TranslationPDFExport />);
    await user.click(screen.getByRole('button', { name: /download pdf/i }));
    await waitFor(() => expect(buildHebrewPDF).toHaveBeenCalled());
    expect(vi.mocked(buildHebrewPDF).mock.calls[0][1]).toBe('GEN 1:1–3');
  });
});
