/**
 * A custom deck built from a GNT book or passage on /flashcards: studying it
 * one chapter at a time (#270) and the verse on reveal (#267).
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveCustomDecks } from '../data/customDecks';
import { fetchBook, type MorphWord } from '../data/morphgnt';
import { loadSRSStore } from '../data/srs';
import { deckChapterMemory } from '../lib/deck-chapters';
import Flashcards from './Flashcards';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn() },
}));

vi.mock('../data/morphgnt', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/morphgnt')>()),
  fetchBook: vi.fn(),
}));

const w = (lemma: string, text = lemma): MorphWord => ({ text, lemma, pos: 'N-', parsing: '' });

/** Romans in three verses: καί in chapters 1 and 2, the rest in one each. */
const ROMANS = {
  '1': { '1': [w('καί'), w('λόγος', 'λόγος,')] },
  '2': { '1': [w('θεός'), w('καί')] },
  '3': { '1': [w('πίστις', 'πίστις.')] },
};
const SOURCE = { book: 'ROM', startChapter: 1, startVerse: 1, endChapter: 3, endVerse: 1 };
const KEYS = ['καί', 'λόγος', 'θεός', 'πίστις'];
const AT = '2026-11-01T00:00:00.000Z';

function seed(source: typeof SOURCE | null = SOURCE) {
  saveCustomDecks([
    { id: 'rom', name: 'Romans', wordKeys: KEYS, createdAt: AT, ...(source && { source }) },
  ]);
}

async function pickDeck(user: ReturnType<typeof userEvent.setup>) {
  const view = render(<Flashcards />);
  await act(async () => {
    await user.click(screen.getByRole('button', { name: /^Romans/ }));
  });
  return view;
}

/** The picker's summary button: the deck's name over its chapters. */
const picker = () => screen.findByRole('button', { name: /^Romans\s*(All chapters|Ch\.)/ });
const queryPicker = () => screen.queryByRole('button', { name: /^Romans\s*(All chapters|Ch\.)/ });

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
  vi.mocked(fetchBook).mockReset();
  vi.mocked(fetchBook).mockImplementation(async (code) => {
    if (code !== 'ROM') throw new Error(`unexpected book ${code}`);
    return ROMANS;
  });
});

describe('studying a book deck by chapter (#270)', () => {
  it('offers the book’s chapters, with the deck’s words in each', async () => {
    const user = userEvent.setup();
    seed();
    await pickDeck(user);
    expect((await picker()).textContent).toContain('4 words');
    await act(async () => {
      await user.click(await picker());
    });
    expect(screen.getByRole('button', { name: 'Ch. 1 — 2 words' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ch. 2 — 2 words' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ch. 3 — 1 words' })).toBeTruthy();
    expect(fetchBook).toHaveBeenCalledWith('ROM');
  });

  it('a chapter deals only its words, a word in several chapters in each', async () => {
    const user = userEvent.setup();
    seed();
    await pickDeck(user);
    await studyAll(user);
    await chooseChapter(user, 2);
    await waitFor(() => expect(screen.getByTestId('card-progress').textContent).toBe('1/2'));
    expect((await picker()).textContent).toContain('Ch. 2');
  });

  it('grading under one chapter moves the one card every chapter reads', async () => {
    const user = userEvent.setup();
    seed();
    const view = await pickDeck(user);
    await chooseChapter(user, 2);
    // SRS Review: two new cards in chapter 2 (καί, θεός).
    await waitFor(() => expect(screen.getByText(/New:/).textContent).toContain('2'));
    // Answer both.
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        await user.keyboard(' ');
      });
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /^Good/ }));
      });
    }
    const store = loadSRSStore();
    expect(Object.keys(store).sort()).toEqual(['θεός', 'καί'].sort());
    // Chapter 1 holds καί too: it is the same card, no longer new there.
    view.unmount();
    deckChapterMemory.save({ rom: [1] });
    await pickDeck(user);
    await waitFor(() => expect(screen.getByText(/New:/).textContent).toContain('1'));
    expect((await picker()).textContent).toContain('Ch. 1');
  });

  it('comes back to a deck on the chapters it was left on', async () => {
    deckChapterMemory.save({ rom: [3] });
    const user = userEvent.setup();
    seed();
    await pickDeck(user);
    await studyAll(user);
    await waitFor(() => expect(screen.getByTestId('card-progress').textContent).toBe('1/1'));
    expect((await picker()).textContent).toContain('Ch. 3');
  });

  it('a deck made before sources existed shows no picker and studies as before', async () => {
    const user = userEvent.setup();
    seed(null);
    await pickDeck(user);
    await studyAll(user);
    expect(screen.getByTestId('card-progress').textContent).toBe('1/4');
    expect(queryPicker()).toBeNull();
    expect(fetchBook).not.toHaveBeenCalled();
  });

  it('a book that will not load leaves the whole deck, with no picker', async () => {
    vi.mocked(fetchBook).mockRejectedValue(new Error('offline'));
    deckChapterMemory.save({ rom: [3] });
    const user = userEvent.setup();
    seed();
    await pickDeck(user);
    await studyAll(user);
    await waitFor(() => expect(screen.getByTestId('card-progress').textContent).toBe('1/4'));
    expect(queryPicker()).toBeNull();
  });
});

describe('the verse on reveal (#267)', () => {
  async function revealFirst(user: ReturnType<typeof userEvent.setup>) {
    await pickDeck(user);
    await studyAll(user);
    await chooseChapter(user, 3);
    await waitFor(() => expect(screen.getByTestId('card-progress').textContent).toBe('1/1'));
  }

  it('shows the word in its verse once revealed, never before', async () => {
    const user = userEvent.setup();
    seed();
    await revealFirst(user);
    expect(screen.queryByRole('figure', { name: 'In the text' })).toBeNull();
    await act(async () => {
      await user.keyboard(' ');
    });
    const figure = await screen.findByRole('figure', { name: 'In the text' });
    expect(within(figure).getByText('πίστις').tagName).toBe('MARK');
    expect(within(figure).getByRole('link', { name: 'Romans 3:1' }).getAttribute('href')).toBe(
      '/reader?ref=ROM.3.1',
    );
    expect(figure.textContent).toContain('1 of 1 in Romans');
  });

  it('the switch hides it, and is remembered', async () => {
    const user = userEvent.setup();
    seed();
    await revealFirst(user);
    await act(async () => {
      await user.click(screen.getByRole('switch', { name: 'Verse' }));
    });
    await act(async () => {
      await user.keyboard(' ');
    });
    expect(screen.queryByRole('figure', { name: 'In the text' })).toBeNull();
    expect(
      JSON.parse(localStorage.getItem('greek-tools-flashcard-display-v1') ?? '{}'),
    ).toMatchObject({ showVerse: false });
  });

  it('a hand-picked deck has no verse and no switch', async () => {
    const user = userEvent.setup();
    seed(null);
    await pickDeck(user);
    expect(screen.queryByRole('switch', { name: 'Verse' })).toBeNull();
  });
});
