import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMorphhbCache, type HebrewWord, type LemmaIndex } from '../data/morphhb';
import { WordPopup, wordText } from './HebrewText';

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
};

const rect = { right: 400, bottom: 100 } as DOMRect;

const showPopup = (w: HebrewWord, cantillation = true) =>
  render(<WordPopup active={{ word: w, rect }} cantillation={cantillation} onClose={() => {}} />);

const popup = () => within(screen.getByRole('dialog'));

beforeEach(() => {
  clearMorphhbCache();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(LEMMAS) } as Response)),
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
