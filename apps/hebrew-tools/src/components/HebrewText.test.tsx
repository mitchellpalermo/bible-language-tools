import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMorphhbCache,
  type GlossIndex,
  type HebrewWord,
  type LemmaIndex,
} from '../data/morphhb';
import { WordPopup, WordRun, wordText } from './HebrewText';

// The cases the reader's own fixture cannot reach without misplacing them: an
// Aramaic verse, a qere with no ketiv, and a lexicon that will not load.

const word = (over: Partial<HebrewWord> = {}): HebrewWord => ({
  text: 'וַ/יְהִ֗י',
  lemma: '1961',
  pos: 'Vq',
  parsing: 'HC/Vqw3ms',
  ...over,
});

const LEMMAS: LemmaIndex = {
  '4430': { count: 180, hebrew: 'מֶלֶךְ', xlit: 'melek', pos: 'N', gloss: 'a king' },
  '2388': { count: 290, hebrew: 'חָזַק', pos: 'V', gloss: 'fasten, seize, be strong' },
  '7586': { count: 406, hebrew: 'שָׁאוּל', xlit: 'šāʾûl', pos: 'Np', gloss: 'Shaul' },
};

const GLOSSES: GlossIndex = {
  '2388': {
    g: ['be or grow firm', 'strong', 'strengthen'],
    s: { Hiphil: [['make strong', 'strengthen'], ['make firm']] },
  },
  '7586': { g: ['šāʾûl'] },
};

let glossesDown = false;

const rect = { right: 400, bottom: 100 } as DOMRect;

const showPopup = (w: HebrewWord, cantillation = true) =>
  render(<WordPopup active={{ word: w, rect }} cantillation={cantillation} onClose={() => {}} />);

const popup = () => within(screen.getByRole('dialog'));

beforeEach(() => {
  clearMorphhbCache();
  glossesDown = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('glosses.json')) {
        if (glossesDown) return Promise.resolve({ ok: false, status: 404 } as Response);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(GLOSSES) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(LEMMAS) } as Response);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('wordText', () => {
  it('shows the accented form when cantillation is on', () => {
    expect(wordText(word(), true)).toBe('וַיְהִ֗י');
  });

  it('strips the accents and keeps the vowel points when it is off', () => {
    expect(wordText(word(), false)).toBe('וַיְהִי');
  });

  it('strips the accents from a qere too, since the qere is what is read', () => {
    const w = word({ text: 'ל/עבדי/ך', qere: 'לְ/עַבְדָ֖/ךְ', ketiv: true });
    expect(wordText(w, false)).toBe('לְעַבְדָךְ');
  });
});

describe('WordPopup', () => {
  // Daniel 2:4b onward is Aramaic, read in the same reader as Genesis. The
  // stem letters mean different things in the two languages — `Vp` is Piel
  // against Pael — so the marker is not decoration.
  describe('an Aramaic word', () => {
    const aramaic = word({ text: 'מַלְכָּ/א֙', lemma: '4430', pos: 'Nc', parsing: 'ANcmsd/Td' });

    it('says so', () => {
      showPopup(aramaic);
      expect(popup().getByText('Aramaic')).toBeInTheDocument();
    });

    // In Aramaic the article is postpositive, so it is the second morpheme.
    it('parses its postpositive article', () => {
      showPopup(aramaic);
      expect(popup().getByText('Definite article')).toBeInTheDocument();
      expect(popup().getByText('Noun ms det')).toBeInTheDocument();
    });

    it('reads a verb’s stem off the Aramaic table', () => {
      showPopup(word({ text: 'קַיָּמָ/א', lemma: '6966', parsing: 'AVpp3ms' }));
      expect(popup().getByText('Pael')).toBeInTheDocument();
    });
  });

  it('says nothing about Aramaic on a Hebrew word', () => {
    showPopup(word());
    expect(popup().queryByText('Aramaic')).not.toBeInTheDocument();
  });

  // A qere with no ketiv — read, though never written.
  it('marks a qere wela ketiv as read but not written', () => {
    showPopup(word({ text: 'אֵ֥ת', qereOnly: true }));
    expect(popup().getByText('read, though not written')).toBeInTheDocument();
    expect(popup().queryByText('Ketiv')).not.toBeInTheDocument();
  });

  // One unreadable letter fails the whole code rather than yielding a parse
  // with a hole in it, and the caller renders the code itself.
  it('shows a code it cannot read as itself rather than as a parse', () => {
    showPopup(word({ text: 'שָׁלוֹם', parsing: 'HZzzzz' }));
    expect(popup().getByText('Zzzzz')).toBeInTheDocument();
  });

  // The index is ~140 KB and a separate request. The parse does not depend on
  // it, and a reader that lost its lexicon still reads.
  it('still shows the parse when the lemma index will not load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    showPopup(word());
    await waitFor(() => expect(popup().getByText('Qal wayyiqtol 3ms')).toBeInTheDocument());
    expect(popup().queryByText(/in the Hebrew Bible/)).not.toBeInTheDocument();
  });

  it('fills in the lexical fields once the index arrives', async () => {
    showPopup(word({ lemma: '4430', parsing: 'ANcmsd/Td', text: 'מַלְכָּ/א֙' }));
    await waitFor(() => expect(popup().getByText('a king')).toBeInTheDocument());
    expect(popup().getByText('180× in the Hebrew Bible')).toBeInTheDocument();
  });
});

describe('WordPopup, from BDB', () => {
  const hiphil = word({ text: 'הֶחֱזַ֔קְתִּי', lemma: '2388', pos: 'Vh', parsing: 'HVhp1cs' });

  it('glosses from BDB rather than Strong’s', async () => {
    showPopup(hiphil);
    await waitFor(() =>
      expect(popup().getByText('be or grow firm, strong, strengthen')).toBeInTheDocument(),
    );
    expect(popup().queryByText(/fasten/)).not.toBeInTheDocument();
  });

  // Issue #131: the popup prints the stem, and now says what the stem does.
  it('lists what the word’s own stem means', async () => {
    showPopup(hiphil);
    const senses = await screen.findByTestId('stem-senses');
    expect(senses).toHaveTextContent('Hiphil');
    expect(senses).toHaveTextContent('make strong, strengthen; make firm');
  });

  it('lists no senses for a stem BDB says nothing about', async () => {
    showPopup(word({ ...hiphil, parsing: 'HVNp3ms' }));
    await waitFor(() => expect(popup().getByText(/be or grow firm/)).toBeInTheDocument());
    expect(screen.queryByTestId('stem-senses')).not.toBeInTheDocument();
  });

  it('does not repeat a name’s transliteration as its gloss', async () => {
    showPopup(word({ text: 'שָׁא֔וּל', lemma: '7586', pos: 'Np', parsing: 'HNp' }));
    await waitFor(() => expect(popup().getByText('šāʾûl')).toBeInTheDocument());
    expect(popup().getAllByText('šāʾûl')).toHaveLength(1);
  });

  it('falls back to Strong’s when the BDB glosses will not load', async () => {
    glossesDown = true;
    showPopup(hiphil);
    await waitFor(() => expect(popup().getByText('fasten, seize, be strong')).toBeInTheDocument());
    expect(screen.queryByTestId('stem-senses')).not.toBeInTheDocument();
  });
});

describe('WordRun, with the gloss line', () => {
  const words: HebrewWord[] = [
    word({ text: 'עַל', lemma: '5921a', pos: 'R', parsing: 'HR', after: '־' }),
    word({ text: 'הַ/מְּלָאכָֽה', lemma: '4399', pos: 'Nc', parsing: 'HTd/Ncfsa', after: '׃' }),
  ];
  const gloss: Record<string, string> = { '4399': 'occupation, work' };

  const renderRun = (glossOf?: (w: HebrewWord) => string | undefined, onActivate = vi.fn()) =>
    render(
      <div dir="rtl">
        <WordRun
          words={words}
          cantillation={false}
          isStudied={() => false}
          active={null}
          onActivate={onActivate}
          glossOf={glossOf}
        />
      </div>,
    );

  it('draws no line when it is off', () => {
    renderRun();
    expect(screen.queryByTestId('word-gloss')).not.toBeInTheDocument();
  });

  it('puts a gloss under each word, left to right', () => {
    renderRun((w) => gloss[w.lemma]);
    const lines = screen.getAllByTestId('word-gloss');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toHaveTextContent('occupation, work');
    expect(lines[1]).toHaveAttribute('dir', 'ltr');
  });

  it('keeps an empty line under a word with nothing, so the row stays level', () => {
    renderRun((w) => gloss[w.lemma]);
    const [empty] = screen.getAllByTestId('word-gloss');
    expect(empty.textContent).toBe('\u00a0');
  });

  it('keeps the maqqef and the sof pasuq on the Hebrew row', () => {
    renderRun((w) => gloss[w.lemma]);
    const [first, second] = screen.getAllByTestId('glossed-word');
    const [firstGloss, secondGloss] = screen.getAllByTestId('word-gloss');
    expect(first.firstElementChild).toHaveTextContent('עַל־');
    expect(firstGloss).not.toHaveTextContent('־');
    expect(second.firstElementChild).toHaveTextContent('׃');
    expect(secondGloss).not.toHaveTextContent('׃');
  });

  it('opens the word when its gloss is tapped', async () => {
    const onActivate = vi.fn();
    renderRun((w) => gloss[w.lemma], onActivate);
    await userEvent.click(screen.getByText('occupation, work'));
    expect(onActivate).toHaveBeenCalledWith(words[1], expect.anything());
  });
});
