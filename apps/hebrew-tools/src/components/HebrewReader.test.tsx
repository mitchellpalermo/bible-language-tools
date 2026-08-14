import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMorphhbCache,
  type HebrewBook,
  type HebrewBookMeta,
  type LemmaIndex,
  READER_HISTORY_KEY,
  READER_PREFS_KEY,
} from '../data/morphhb';
import { newCard, saveSRSStore } from '../data/srs';
import { cardKey, vocabulary } from '../data/vocabulary';
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
    // Genesis 1:29's בּוֹ — a preposition carrying its own suffix, whose lemma
    // is the prefix letter code `b` rather than a Strong's number. There are 470
    // such words in Genesis alone and no lexicon entry for any of them.
    '4': [{ text: 'בּ֥/וֹ', lemma: 'b', pos: 'R', parsing: 'HR/Sp3ms', after: '׃' }],
  },
  '2': { '1': [{ text: 'וַ/יְכֻלּ֛וּ', lemma: '3615', pos: 'Vq', parsing: 'HC/Vqw3mp' }] },
  '3': { '1': [{ text: 'וְ/הַ/נָּחָשׁ֙', lemma: '5175', pos: 'Nc', parsing: 'HC/Td/Ncmsa' }] },
};

const EXODUS: HebrewBook = {
  '1': { '1': [{ text: 'וְ/אֵ֗לֶּה', lemma: '428', pos: 'Pd', parsing: 'HC/Pdxcp' }] },
};

// Enough of `lemmas.json` for the popup. The real index is ~140 KB and fetched
// lazily, which is the behaviour the popup tests below pin.
const LEMMAS: LemmaIndex = {
  '430': {
    count: 2598,
    hebrew: 'אֱלֹהִים',
    xlit: 'ʾĕlōhîm',
    pos: 'N',
    gender: 'm',
    root: 'אלה',
    gloss: 'God, gods',
  },
  '1961': { count: 3576, hebrew: 'הָיָה', xlit: 'hāyâ', pos: 'V', root: 'היה', gloss: 'to be' },
  // A lemma the lexicon cannot reach: it keeps its count and gets no fields.
  '5175': { count: 31 },
};

/** The SRS key the flashcards would have stored for a lemma of the corpus. */
const cardKeyFor = (strong: string): string => {
  const word = vocabulary.find((w) => w.strong === strong);
  if (!word) throw new Error(`no vocabulary entry for ${strong}`);
  return cardKey(word);
};

const studyWord = (strong: string): void => {
  const key = cardKeyFor(strong);
  saveSRSStore({ [key]: { ...newCard(key), repetition: 3 } });
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
        : url.endsWith('lemmas.json')
          ? LEMMAS
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

// ─── The word popup (#120) ────────────────────────────────────────────────────

describe('the word popup', () => {
  // The first match: a word can occur more than once in a chapter, and any of
  // them opens the same popup.
  const openWord = async (text: string) => {
    const user = userEvent.setup();
    await renderReader();
    await user.click(within(readerText()).getAllByText(text)[0]);
    return within(await screen.findByRole('dialog'));
  };

  it('opens on the word that was tapped', async () => {
    const popup = await openWord('הַשָּׁמַ֖יִם');
    expect(popup.getByText('הַשָּׁמַ֖יִם')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'About הַשָּׁמַ֖יִם');
  });

  // This is the thing greek.tools has no analog for, and the thing a first-year
  // student most needs: that וַיְהִי is וַ + יְהִי.
  it('takes the word apart into morphemes, each with its own parse', async () => {
    const popup = await openWord('וַֽיְהִי');
    expect(popup.getByText('וַֽ')).toBeInTheDocument();
    expect(popup.getByText('יְהִי')).toBeInTheDocument();
    expect(popup.getByText('Conjunction')).toBeInTheDocument();
    expect(popup.getByText('Qal wayyiqtol 3ms')).toBeInTheDocument();
  });

  it('names the article on a prefixed noun', async () => {
    const popup = await openWord('הַשָּׁמַ֖יִם');
    expect(popup.getByText('Definite article')).toBeInTheDocument();
    expect(popup.getByText('Noun mp')).toBeInTheDocument();
  });

  // The stem is part of every verbal analysis, and it is spelled out rather
  // than left as the letter the code carries.
  it('spells out the binyan for a verb', async () => {
    const popup = await openWord('וַֽיְהִי');
    expect(popup.getByText('Stem')).toBeInTheDocument();
    expect(popup.getByText('Qal')).toBeInTheDocument();
  });

  it('says nothing about a stem on a word that has none', async () => {
    const popup = await openWord('אֱלֹהִ֑ים');
    expect(popup.queryByText('Stem')).not.toBeInTheDocument();
  });

  it('gives the citation form, gloss, transliteration, root and count', async () => {
    const popup = await openWord('אֱלֹהִ֑ים');
    await waitFor(() => expect(popup.getByText('God, gods')).toBeInTheDocument());
    expect(popup.getByText('אֱלֹהִים')).toBeInTheDocument();
    expect(popup.getByText('ʾĕlōhîm')).toBeInTheDocument();
    expect(popup.getByText('אלה')).toBeInTheDocument();
    expect(popup.getByText('2,598× in the Hebrew Bible')).toBeInTheDocument();
  });

  // The index is ~140 KB. It is fetched when a popup first needs it, not on
  // page load, and the parse is on screen either way.
  it('fetches the lemma index on the first popup rather than on page load', async () => {
    const fetched = () =>
      (fetch as ReturnType<typeof vi.fn>).mock.calls.filter((call) =>
        String(call[0]).endsWith('lemmas.json'),
      );

    const user = userEvent.setup();
    await renderReader();
    expect(fetched()).toHaveLength(0);

    await user.click(within(readerText()).getByText('אֱלֹהִ֑ים'));
    await screen.findByText('God, gods');
    expect(fetched()).toHaveLength(1);
  });

  // Seven lemmas have no lexicon entry, and neither does any inseparable
  // prefix. A missing field renders as nothing at all — never as "unknown",
  // which reads like a claim about the word.
  it('leaves an absent field absent rather than calling it unknown', async () => {
    const user = userEvent.setup();
    await renderReader();
    await user.selectOptions(screen.getByLabelText('Chapter'), '3');
    await user.click(within(readerText()).getByText('וְהַנָּחָשׁ֙'));

    const popup = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(popup.getByText('31× in the Hebrew Bible')).toBeInTheDocument());
    expect(popup.queryByText(/unknown/i)).not.toBeInTheDocument();
    expect(popup.queryByText('Root')).not.toBeInTheDocument();
  });

  // A prefix has no Strong's entry at all, and it is a third of the tokens on
  // the page. `gloss.ts` answers for those without the index.
  it('glosses an inseparable prefix the lexicon has no entry for', async () => {
    const user = userEvent.setup();
    await renderReader();
    await user.selectOptions(screen.getByLabelText('Chapter'), '1');
    await user.click(within(readerText()).getByText('בּ֥וֹ'));

    const popup = within(await screen.findByRole('dialog'));
    expect(popup.getByText('in, at, by, with')).toBeInTheDocument();
    expect(popup.getByText('Preposition')).toBeInTheDocument();
    expect(popup.getByText('Pronominal suffix 3ms')).toBeInTheDocument();
  });

  it('shows the ketiv beside the qere where they differ', async () => {
    const popup = await openWord('וְל֥וֹ');
    expect(popup.getByText('Ketiv')).toBeInTheDocument();
    expect(popup.getByText('ולא')).toBeInTheDocument();
    expect(popup.getByText('Qere')).toBeInTheDocument();
  });

  it('links to the flashcards', async () => {
    const popup = await openWord('בָּרָ֣א');
    expect(popup.getByRole('link', { name: /Study in Flashcards/ })).toHaveAttribute(
      'href',
      '/flashcards',
    );
  });

  // The popup is English chrome around Hebrew runs. An un-scoped Hebrew word
  // inside an English sentence takes its direction from its neighbours.
  it('runs its chrome left to right and each Hebrew run right to left', async () => {
    const popup = await openWord('הַשָּׁמַ֖יִם');
    expect(popup.getByText('הַשָּׁמַ֖יִם').closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('dialog')).toHaveAttribute('dir', 'ltr');
  });

  describe('dismissal', () => {
    it('closes on the close button', async () => {
      const user = userEvent.setup();
      const popup = await openWord('בָּרָ֣א');
      await user.click(popup.getByLabelText('Close'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      await openWord('בָּרָ֣א');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // A word is its own dismissal — tapping it again puts the popup away.
    it('closes when the same word is tapped again', async () => {
      const user = userEvent.setup();
      await openWord('בָּרָ֣א');
      await user.click(within(readerText()).getByText('בָּרָ֣א'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('moves to another word when that one is tapped', async () => {
      const user = userEvent.setup();
      await openWord('בָּרָ֣א');
      await user.click(within(readerText()).getByText('אֱלֹהִ֑ים'));
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'About אֱלֹהִ֑ים');
    });

    it('stays open when the popup itself is clicked', async () => {
      const user = userEvent.setup();
      const popup = await openWord('בָּרָ֣א');
      await user.click(popup.getAllByText('בָּרָ֣א')[0]);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes on a click anywhere else', async () => {
      const user = userEvent.setup();
      await openWord('בָּרָ֣א');
      await user.click(screen.getByRole('heading', { name: 'Genesis 1' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes when the passage changes', async () => {
      const user = userEvent.setup();
      await openWord('בָּרָ֣א');
      await user.click(screen.getByLabelText('Next chapter'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

// ─── Reading aids (#121) ──────────────────────────────────────────────────────

describe('the cantillation toggle', () => {
  it('strips the accents and keeps the vowel points', async () => {
    const user = userEvent.setup();
    await renderReader();
    expect(readerText()).toHaveTextContent('בְּרֵאשִׁ֖ית');

    await user.click(screen.getByRole('button', { name: 'Cantillation' }));
    // Same word, same vowel points, no accent.
    expect(readerText()).toHaveTextContent('בְּרֵאשִׁית');
    expect(readerText().textContent).not.toContain('֖');
    expect(readerText().textContent).toContain('ְ');
  });

  it('starts on, because the WLC is an accented text', async () => {
    await renderReader();
    expect(screen.getByRole('button', { name: 'Cantillation' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('keeps the sof pasuq, which is punctuation rather than an accent', async () => {
    const user = userEvent.setup();
    await renderReader();
    await user.click(screen.getByRole('button', { name: 'Cantillation' }));
    expect(readerText()).toHaveTextContent('׃');
  });

  it('remembers the setting for the next visit', async () => {
    const user = userEvent.setup();
    await renderReader();
    await user.click(screen.getByRole('button', { name: 'Cantillation' }));
    expect(JSON.parse(localStorage.getItem(READER_PREFS_KEY) as string)).toMatchObject({
      cantillation: false,
    });
  });

  it('opens with the setting it was left on', async () => {
    localStorage.setItem(READER_PREFS_KEY, JSON.stringify({ cantillation: false, studied: true }));
    await renderReader();
    await waitFor(() => expect(readerText()).toHaveTextContent('בְּרֵאשִׁית'));
    expect(readerText().textContent).not.toContain('֖');
  });

  it('strips the accents in the popup too, so the two agree', async () => {
    const user = userEvent.setup();
    await renderReader();
    await user.click(screen.getByRole('button', { name: 'Cantillation' }));
    await user.click(within(readerText()).getAllByText('וַיְהִי')[0]);

    const popup = within(await screen.findByRole('dialog'));
    expect(popup.getByText('יְהִי')).toBeInTheDocument();
  });
});

describe('studied-word highlighting', () => {
  // The join runs lemma → vocabulary entry → cardKey. `normalizeKey(hebrew)` is
  // the bug that convention replaced.
  it('underlines a word whose lemma the student has studied', async () => {
    studyWord('430');
    await renderReader();
    expect(within(readerText()).getByText('אֱלֹהִ֑ים').className).toContain('decoration-dotted');
  });

  it('leaves a word the student has not studied unmarked', async () => {
    studyWord('430');
    await renderReader();
    expect(within(readerText()).getByText('בָּרָ֣א').className).not.toContain('decoration-dotted');
  });

  it('marks nothing when nothing has been studied', async () => {
    await renderReader();
    expect(within(readerText()).getByText('אֱלֹהִ֑ים').className).not.toContain(
      'decoration-dotted',
    );
  });

  it('can be turned off', async () => {
    studyWord('430');
    const user = userEvent.setup();
    await renderReader();
    await user.click(screen.getByRole('button', { name: 'Studied words' }));
    expect(within(readerText()).getByText('אֱלֹהִ֑ים').className).not.toContain(
      'decoration-dotted',
    );
  });

  it('remembers being turned off', async () => {
    const user = userEvent.setup();
    await renderReader();
    await user.click(screen.getByRole('button', { name: 'Studied words' }));
    expect(JSON.parse(localStorage.getItem(READER_PREFS_KEY) as string)).toMatchObject({
      studied: false,
    });
  });
});

describe('the legend', () => {
  it('explains the studied mark when the chapter carries one', async () => {
    studyWord('430');
    await renderReader();
    expect(screen.getByText(/studied in Flashcards/)).toBeInTheDocument();
  });

  it('explains the qere mark when the chapter carries one', async () => {
    await renderReader();
    expect(screen.getByText(/what is read, where it differs/)).toBeInTheDocument();
  });

  // Only when there is something to explain.
  it('says nothing about a mark the chapter does not carry', async () => {
    await renderReader();
    expect(screen.queryByText(/studied in Flashcards/)).not.toBeInTheDocument();
  });

  it('drops the qere line on a chapter with no qere', async () => {
    const user = userEvent.setup();
    await renderReader();
    await user.selectOptions(screen.getByLabelText('Chapter'), '2');
    expect(screen.queryByText(/what is read, where it differs/)).not.toBeInTheDocument();
  });

  it('drops the studied line when highlighting is off', async () => {
    studyWord('430');
    const user = userEvent.setup();
    await renderReader();
    await user.click(screen.getByRole('button', { name: 'Studied words' }));
    expect(screen.queryByText(/studied in Flashcards/)).not.toBeInTheDocument();
  });
});
