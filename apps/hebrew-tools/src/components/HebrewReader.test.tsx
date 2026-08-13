import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMorphhbCache,
  type HebrewBook,
  type HebrewBookMeta,
  READER_HISTORY_KEY,
} from '../data/morphhb';
import HebrewReader from './HebrewReader';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

const BOOKS: HebrewBookMeta[] = [
  { code: 'GEN', name: 'Genesis', hebrew: 'בְּרֵאשִׁית', section: 'torah', chapters: 3, words: 90 },
  { code: 'EXO', name: 'Exodus', hebrew: 'שְׁמוֹת', section: 'torah', chapters: 40, words: 80 },
  { code: 'ISA', name: 'Isaiah', hebrew: 'יְשַׁעְיָהוּ', section: 'neviim', chapters: 66, words: 70 },
  { code: 'PSA', name: 'Psalms', hebrew: 'תְּהִלִּים', section: 'ketuvim', chapters: 150, words: 60 },
];

// Genesis 1:1, as OSHB writes it — morpheme boundaries and all.
const GENESIS: HebrewBook = {
  '1': {
    '1': [
      { text: 'בְּ/רֵאשִׁ֖ית', lemma: '7225', pos: 'Nc', parsing: 'HR/Ncfsa' },
      { text: 'בָּרָ֣א', lemma: '1254a', pos: 'Vq', parsing: 'HVqp3ms' },
      { text: 'אֱלֹהִ֑ים', lemma: '430', pos: 'Nc', parsing: 'HNcmpa' },
      { text: 'הַ/שָּׁמַ֖יִם', lemma: '8064', pos: 'Nc', parsing: 'HTd/Ncmpa', after: '׃' },
    ],
    // Genesis 1:5's closing words: two maqqef-bound pairs in a row.
    '2': [
      { text: 'וַֽ/יְהִי', lemma: '1961', pos: 'Vq', parsing: 'HC/Vqw3ms', after: '־' },
      { text: 'עֶ֥רֶב', lemma: '6153', pos: 'Nc', parsing: 'HNcmsa' },
      { text: 'וַֽ/יְהִי', lemma: '1961', pos: 'Vq', parsing: 'HC/Vqw3ms', after: '־' },
      { text: 'בֹ֖קֶר', lemma: '1242', pos: 'Nc', parsing: 'HNcmsa', after: '׃' },
    ],
    '3': [
      // 1 Samuel 2:3's ketiv/qere, borrowed: written ולא, read ולו.
      { text: 'ו/לא', lemma: '3808', pos: 'Tn', parsing: 'HC/Tn', ketiv: true, qere: 'וְ/ל֥/וֹ' },
    ],
  },
  '2': { '1': [{ text: 'וַ/יְכֻלּ֛וּ', lemma: '3615', pos: 'Vq', parsing: 'HC/Vqw3mp' }] },
  '3': { '1': [{ text: 'וְ/הַ/נָּחָשׁ֙', lemma: '5175', pos: 'Nc', parsing: 'HC/Td/Ncmsa' }] },
};

const EXODUS: HebrewBook = {
  '1': { '1': [{ text: 'וְ/אֵ֗לֶּה', lemma: '428', pos: 'Pd', parsing: 'HC/Pdxcp' }] },
};

let failWith: string | null = null;

beforeEach(() => {
  localStorage.clear();
  clearMorphhbCache();
  vi.clearAllMocks();
  failWith = null;
  window.history.replaceState(null, '', '/reader');

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (failWith) return Promise.resolve({ ok: false, status: 404 } as Response);
      const body = url.endsWith('books.json')
        ? BOOKS
        : url.endsWith('GEN.json')
          ? GENESIS
          : url.endsWith('EXO.json')
            ? EXODUS
            : null;
      if (!body) return Promise.resolve({ ok: false, status: 404 } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }),
  );
});

const readerText = () => screen.getByTestId('reader-text');
const renderReader = async () => {
  render(<HebrewReader />);
  await waitFor(() => expect(screen.queryByTestId('reader-text')).toBeInTheDocument());
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HebrewReader', () => {
  it('opens at Genesis 1, where the Hebrew Bible opens', async () => {
    await renderReader();
    expect(screen.getByRole('heading', { name: 'Genesis 1' })).toBeInTheDocument();
    expect(readerText()).toHaveTextContent('בָּרָ֣א');
  });

  it('renders the Hebrew right to left and marks its language', async () => {
    await renderReader();
    expect(readerText()).toHaveAttribute('dir', 'rtl');
    expect(readerText()).toHaveAttribute('lang', 'he');
  });

  // The stored text keeps OSHB's `/` morpheme boundaries because they are real
  // information. Rendering them raw is the bug `readingText` exists to prevent.
  it('never lets a morpheme boundary reach the screen', async () => {
    await renderReader();
    expect(readerText().textContent).not.toContain('/');
    expect(readerText()).toHaveTextContent('בְּרֵאשִׁ֖ית');
  });

  it('shows the qere, which is what is read, and marks it as one', async () => {
    await renderReader();
    // ולא is written; ולו is read.
    expect(readerText()).toHaveTextContent('וְל֥וֹ');
    expect(readerText().textContent).not.toContain('ולא');
    expect(screen.getByTitle(/Qere/)).toBeInTheDocument();
  });

  it('keeps the punctuation that follows a word', async () => {
    await renderReader();
    expect(readerText()).toHaveTextContent('׃');
  });

  describe('verse numbers', () => {
    it('numbers each verse and anchors it', async () => {
      await renderReader();
      expect(document.getElementById('verse-1')).toBeInTheDocument();
      expect(document.getElementById('verse-3')).toBeInTheDocument();
    });

    // A bare LTR run inside an RTL paragraph takes its direction from its
    // neighbours, so an un-isolated number can jump to the wrong side of a word.
    it('isolates the number so it cannot reorder against the Hebrew', async () => {
      await renderReader();
      const number = within(document.getElementById('verse-1') as HTMLElement).getByText('1');
      expect(number).toHaveAttribute('dir', 'ltr');
      expect(number).toHaveStyle({ unicodeBidi: 'isolate' });
    });
  });

  // A maqqef binds words into one accentual unit, pronounced under one stress.
  // A line break inside עַל־כֵּן is a typographic error the printed text never makes.
  describe('maqqef', () => {
    it('wraps each bound unit in one non-breaking span', async () => {
      await renderReader();
      const verse = document.getElementById('verse-2') as HTMLElement;
      const nowrap = [...verse.querySelectorAll('span')].filter(
        (el) => el.style.whiteSpace === 'nowrap',
      );
      expect(nowrap).toHaveLength(2);
      expect(nowrap[0].textContent).toContain('־');
      expect(nowrap[0].textContent).toContain('עֶ֥רֶב');
    });

    it('leaves an unbound word in a unit of its own', async () => {
      await renderReader();
      const verse = document.getElementById('verse-1') as HTMLElement;
      const nowrap = [...verse.querySelectorAll('span')].filter(
        (el) => el.style.whiteSpace === 'nowrap',
      );
      expect(nowrap).toHaveLength(4);
    });
  });

  describe('the book selector', () => {
    it('groups the books into the three divisions of the Tanakh', async () => {
      await renderReader();
      const groups = [...screen.getByLabelText('Book').querySelectorAll('optgroup')].map(
        (group) => group.label,
      );
      expect(groups).toEqual(['Torah', "Nevi'im", 'Ketuvim']);
    });

    it('loads a different book and starts it at chapter 1', async () => {
      const user = userEvent.setup();
      await renderReader();
      await user.selectOptions(screen.getByLabelText('Chapter'), '3');
      expect(screen.getByRole('heading', { name: 'Genesis 3' })).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Book'), 'EXO');
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Exodus 1' })).toBeInTheDocument(),
      );
      expect(readerText()).toHaveTextContent('וְאֵ֗לֶּה');
    });
  });

  describe('chapter navigation', () => {
    it('moves forward and back', async () => {
      const user = userEvent.setup();
      await renderReader();
      await user.click(screen.getByLabelText('Next chapter'));
      expect(screen.getByRole('heading', { name: 'Genesis 2' })).toBeInTheDocument();
      expect(readerText()).toHaveTextContent('וַיְכֻלּ֛וּ');

      await user.click(screen.getByLabelText('Previous chapter'));
      expect(screen.getByRole('heading', { name: 'Genesis 1' })).toBeInTheDocument();
    });

    it('stops at both ends of the book', async () => {
      const user = userEvent.setup();
      await renderReader();
      expect(screen.getByLabelText('Previous chapter')).toBeDisabled();

      await user.selectOptions(screen.getByLabelText('Chapter'), '3');
      expect(screen.getByLabelText('Next chapter')).toBeDisabled();
    });

    it('offers every chapter the book has', async () => {
      await renderReader();
      expect(screen.getByLabelText('Chapter').querySelectorAll('option')).toHaveLength(3);
    });
  });

  describe('the passage in the URL', () => {
    it('opens where the reference says', async () => {
      window.history.replaceState(null, '', '/reader?ref=GEN.2');
      await renderReader();
      expect(screen.getByRole('heading', { name: 'Genesis 2' })).toBeInTheDocument();
    });

    it('opens at Genesis rather than an error when the reference is nonsense', async () => {
      window.history.replaceState(null, '', '/reader?ref=NOPE');
      await renderReader();
      expect(screen.getByRole('heading', { name: 'Genesis 1' })).toBeInTheDocument();
    });

    // `?ref=GEN.1.3` is what a "share this verse" link looks like. It scrolls
    // once, on the passage it was opened with — later navigation starts a
    // chapter at the top rather than jumping to the verse the link named.
    it('scrolls to a verse the reference names, once', async () => {
      const scrollIntoView = vi.fn();
      vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
      window.history.replaceState(null, '', '/reader?ref=GEN.1.3');

      const user = userEvent.setup();
      await renderReader();
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

      await user.click(screen.getByLabelText('Next chapter'));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('does not scroll when the reference names no verse', async () => {
      const scrollIntoView = vi.fn();
      vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
      window.history.replaceState(null, '', '/reader?ref=GEN.2');

      await renderReader();
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('writes the passage back as it is navigated', async () => {
      const user = userEvent.setup();
      await renderReader();
      await user.click(screen.getByLabelText('Next chapter'));
      expect(new URL(window.location.href).searchParams.get('ref')).toBe('GEN.2');
    });

    it('remembers the passage for the next visit', async () => {
      const user = userEvent.setup();
      await renderReader();
      await user.click(screen.getByLabelText('Next chapter'));
      expect(localStorage.getItem(READER_HISTORY_KEY)).toBe('GEN.2');
    });
  });

  describe('the bilingual heading', () => {
    it('names the book in both languages, numbering the chapter each way', async () => {
      const user = userEvent.setup();
      await renderReader();
      expect(screen.getByText('בְּרֵאשִׁית א')).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Chapter'), '2');
      expect(screen.getByText('בְּרֵאשִׁית ב')).toBeInTheDocument();
    });
  });

  it('says plainly when a chapter has no text rather than showing a blank page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(url.endsWith('books.json') ? BOOKS : {}),
        } as Response),
      ),
    );
    render(<HebrewReader />);
    await waitFor(() =>
      expect(screen.getByText('Genesis has no chapter 1.')).toBeInTheDocument(),
    );
  });

  describe('when the text will not load', () => {
    it('says so, and says what to do about it', async () => {
      failWith = 'boom';
      render(<HebrewReader />);
      await waitFor(() => expect(screen.getByText(/Could not load GEN/)).toBeInTheDocument());
      expect(screen.getByText(/pnpm build:data/)).toBeInTheDocument();
    });

    it('still reads the text when only the book index is missing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) =>
          url.endsWith('books.json')
            ? Promise.resolve({ ok: false, status: 404 } as Response)
            : Promise.resolve({ ok: true, json: () => Promise.resolve(GENESIS) } as Response),
        ),
      );
      await renderReader();
      expect(readerText()).toHaveTextContent('בָּרָ֣א');
    });
  });
});
