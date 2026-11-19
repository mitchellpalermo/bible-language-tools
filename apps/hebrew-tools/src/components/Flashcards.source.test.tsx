/**
 * A custom deck built from a book or passage of the Hebrew Bible on
 * /flashcards: studying it one chapter at a time (#270), the verse on reveal
 * (#267), and a deck from a whole book in the builder.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBook, fetchBooks, type HebrewWord } from '../data/morphhb';
import { loadSRSStore } from '../data/srs';
import { vocabulary } from '../data/vocabulary';
import { customDeckStore, deckKey } from '../lib/custom-decks';
import { deckChapterMemory } from '../lib/deck-chapters';
import { saveSelection } from '../lib/deck-selection';
import Flashcards from './Flashcards';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn() },
}));

vi.mock('../data/morphhb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/morphhb')>()),
  fetchBook: vi.fn(),
  fetchBooks: vi.fn(),
  fetchLemmas: vi.fn(async () => ({})),
}));

// Three course words, each its own lexeme.
const [A, B, C] = vocabulary
  .filter((w) => /^\d/.test(w.strong ?? '') && w.frequency !== undefined)
  .filter((w, i, all) => all.findIndex((x) => x.strong === w.strong) === i)
  .slice(0, 3);
const word = (lemma: string, text: string): HebrewWord => ({
  text,
  lemma,
  pos: 'Nc',
  parsing: 'HNcmsa',
});

/** A behind a prefix in chapter 1, again in chapter 2 with B, C alone in 3. */
const GENESIS = {
  '1': { '1': [word(A.strong as string, `וְ/${A.hebrew}`), word('99999', 'זֶה')] },
  '2': { '1': [word(B.strong as string, B.hebrew), word(A.strong as string, A.hebrew)] },
  '3': { '1': [word(C.strong as string, C.hebrew)] },
};
const SOURCE = { book: 'GEN', startChapter: 1, startVerse: 1, endChapter: 3, endVerse: 1 };
const KEYS = [A, B, C].map(deckKey);

function seed(source: typeof SOURCE | null = SOURCE) {
  const deck = customDeckStore.create('Genesis', KEYS, source ?? undefined);
  saveSelection({ deck: 'custom', customDeckId: deck.id, chapters: [], categories: ['core'] });
  return deck;
}

const picker = () => screen.findByRole('button', { name: /^Genesis\s*(All chapters|Ch\.)/ });
const queryPicker = () => screen.queryByRole('button', { name: /^Genesis\s*(All chapters|Ch\.)/ });

async function chooseChapter(user: ReturnType<typeof userEvent.setup>, chapter: number) {
  const summary = await picker();
  if (summary.getAttribute('aria-expanded') !== 'true') {
    await act(async () => {
      await user.click(summary);
    });
  }
  await act(async () => {
    await user.click(screen.getByRole('button', { name: new RegExp(`^Ch\\. ${chapter} —`) }));
  });
}

async function studyAll(user: ReturnType<typeof userEvent.setup>) {
  await act(async () => {
    await user.click(screen.getByRole('button', { name: 'Study All' }));
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchBook).mockReset().mockResolvedValue(GENESIS);
  vi.mocked(fetchBooks)
    .mockReset()
    .mockResolvedValue([
      { code: 'GEN', name: 'Genesis', hebrew: 'בְּרֵאשִׁית', section: 'torah', chapters: 50, words: 1 },
    ]);
});

describe('studying a deck from the text by chapter (#270)', () => {
  it('offers the chapters with their counts and narrows the session to one', async () => {
    const user = userEvent.setup();
    seed();
    render(<Flashcards />);
    await act(async () => {});
    await act(async () => {
      await user.click(await picker());
    });
    expect(screen.getByRole('button', { name: 'Ch. 1 — 1 words' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ch. 2 — 2 words' })).toBeTruthy();
    await studyAll(user);
    await chooseChapter(user, 2);
    await waitFor(() => expect(screen.getByTestId('card-progress').textContent).toBe('1/2'));
  });

  it('grading under a chapter moves the word’s one card', async () => {
    const user = userEvent.setup();
    seed();
    deckChapterMemory.save({ [customDeckStore.load()[0].id]: [1] });
    render(<Flashcards />);
    await waitFor(() => expect(screen.getByText(/New:/).textContent).toContain('1'));
    await act(async () => {
      await user.keyboard(' ');
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^Good/ }));
    });
    expect(Object.keys(loadSRSStore())).toEqual([deckKey(A)]);
  });

  it('a deck with no source shows no picker and fetches no book', async () => {
    seed(null);
    render(<Flashcards />);
    await act(async () => {});
    expect(queryPicker()).toBeNull();
    expect(fetchBook).not.toHaveBeenCalled();
  });
});

describe('the verse on reveal (#267)', () => {
  it('shows the whole word, prefix and all, in its verse once revealed', async () => {
    const user = userEvent.setup();
    seed();
    render(<Flashcards />);
    await studyAll(user);
    await chooseChapter(user, 1);
    await waitFor(() => expect(screen.getByTestId('card-progress').textContent).toBe('1/1'));
    expect(screen.queryByRole('figure', { name: 'In the text' })).toBeNull();
    await act(async () => {
      await user.keyboard(' ');
    });
    const figure = await screen.findByRole('figure', { name: 'In the text' });
    // A is in chapters 1 and 2: two occurrences, the first behind a vav.
    expect(within(figure).getByText(`וְ${A.hebrew}`).tagName).toBe('MARK');
    expect(within(figure).getByRole('link', { name: 'Genesis 1:1' }).getAttribute('href')).toBe(
      '/reader?ref=GEN.1.1',
    );
    // The deck is the whole (three-chapter) book, so the count is "in Genesis".
    expect(figure.textContent).toContain('1 of 2 in Genesis');
  });

  it('a hand-made deck has no verse switch', async () => {
    seed(null);
    render(<Flashcards />);
    await act(async () => {});
    expect(screen.queryByRole('switch', { name: 'Verse' })).toBeNull();
  });
});

describe('a deck from a whole book, in the builder (#270)', () => {
  it('makes the deck, records the book, and studies it by chapter', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Create deck/ }));
    });
    await act(async () => {
      await user.click(await screen.findByRole('button', { name: 'From a book' }));
    });
    await act(async () => {
      await user.selectOptions(screen.getByLabelText('Book'), 'GEN');
    });
    await screen.findByText(/3 course words/);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Create deck' }));
    });
    const [deck] = customDeckStore.load();
    expect(deck.source).toEqual(SOURCE);
    expect([...deck.wordKeys].sort()).toEqual([...KEYS].sort());
    expect(await picker()).toBeTruthy();
  });
});
