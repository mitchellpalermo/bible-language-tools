/**
 * Textbook chapter decks on /flashcards (#228).
 *
 * How a chapter is picked, what it deals, how it sits with the frequency
 * presets, the part-of-speech filter and custom decks, and what it stores. The
 * picker's own behaviour is tested in @tools/shared (ChapterPicker.test.tsx),
 * and the chapter data in src/data/textbook-chapters.test.ts.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import posthog from 'posthog-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEXTBOOKS, wordsInChapters } from '../data/textbooks';
import { DECK_SELECTION_KEY } from '../lib/deck-selection';
import Flashcards from './Flashcards';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn() },
}));

const BOOK = TEXTBOOKS['beginning-with-nt-greek'];
const chapter = (...chapters: number[]) =>
  wordsInChapters('beginning-with-nt-greek', chapters, ['vocabulary']);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// The chip carries the book's word count; the picker's summary button does not start with one.
const textbookChip = () =>
  screen.getByRole('button', { name: new RegExp(`^${BOOK.shortTitle}\\s*\\(\\d+\\)$`) });
const presetRow = () => screen.getByText(/^preset$/i).parentElement as HTMLElement;
const cardFront = () => document.querySelector('p.leading-tight')?.textContent ?? '';
const sessionStarts = () =>
  vi.mocked(posthog.capture).mock.calls.filter(([name]) => name === 'flashcard_session_started');
const storedSelection = () => JSON.parse(localStorage.getItem(DECK_SELECTION_KEY) ?? 'null');

/** Open the picker (it starts closed) and tap chapter cells. */
async function pickChapters(user: UserEvent, ...chapters: number[]) {
  const summary = screen.getByRole('button', { expanded: false, name: /words?$/ });
  await user.click(summary);
  for (const n of chapters) {
    await user.click(screen.getByRole('button', { name: new RegExp(`^Ch\\. ${n} —`) }));
  }
}

async function studyTextbook(user: UserEvent, ...chapters: number[]) {
  render(<Flashcards />);
  await user.click(screen.getByRole('button', { name: 'Study All' }));
  await user.click(textbookChip());
  if (chapters.length > 0) await pickChapters(user, ...chapters);
}

describe('the textbook row', () => {
  it('offers each textbook as one chip with its word count, off by default', () => {
    render(<Flashcards />);
    expect(screen.getByText(/^textbook$/i)).toBeInTheDocument();
    expect(textbookChip()).toHaveAttribute('aria-pressed', 'false');
    expect(textbookChip()).toHaveTextContent(`(${chapter().length})`);
    expect(textbookChip()).toHaveAttribute('title', `${BOOK.title} · ${BOOK.authors}`);
  });

  it('shows no chapter picker until a textbook is chosen', () => {
    render(<Flashcards />);
    expect(screen.queryByRole('button', { name: /All chapters/ })).toBeNull();
  });

  it('deals the whole book when the chip is tapped', async () => {
    const user = userEvent.setup();
    await studyTextbook(user);

    expect(textbookChip()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { expanded: false, name: /words$/ })).toHaveTextContent(
      `All chapters · ${chapter().length} words`,
    );
    expect(screen.getByTestId('card-progress')).toHaveTextContent(`1/${chapter().length}`);
  });

  it('goes back to the whole vocabulary when the chip is tapped again', async () => {
    const user = userEvent.setup();
    await studyTextbook(user);
    await user.click(textbookChip());

    expect(textbookChip()).toHaveAttribute('aria-pressed', 'false');
    expect(presetRow()).not.toHaveAttribute('hidden');
    expect(storedSelection().deck).toBe('all');
  });
});

describe('studying a chapter', () => {
  it('deals that chapter’s words and no others', async () => {
    const user = userEvent.setup();
    await studyTextbook(user, 3);

    const words = chapter(3);
    expect(screen.getByTestId('card-progress')).toHaveTextContent(`1/${words.length}`);
    const seen = new Set<string>();
    for (let i = 0; i < words.length; i++) {
      seen.add(cardFront());
      await user.keyboard(' ');
      await user.click(screen.getByRole('button', { name: /got it/i }));
    }
    expect([...seen].sort()).toEqual(words.map((w) => w.greek).sort());
  });

  it('shows the gloss this site already has for the word', async () => {
    const user = userEvent.setup();
    await studyTextbook(user, 3);
    const word = chapter(3).find((w) => w.greek === cardFront());

    await user.keyboard(' ');
    expect(screen.getByText(word?.gloss ?? 'no such word')).toBeInTheDocument();
  });

  it('adds chapters together, and states the set on the closed picker', async () => {
    const user = userEvent.setup();
    await studyTextbook(user, 1, 2, 3);

    expect(screen.getByRole('button', { expanded: true })).toHaveTextContent(
      `Ch. 1–3 · ${chapter(1, 2, 3).length} words`,
    );
    expect(screen.getByTestId('card-progress')).toHaveTextContent(`1/${chapter(1, 2, 3).length}`);
  });

  it('offers new chapter words in SRS Review', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(textbookChip());
    await pickChapters(user, 9);

    expect(screen.getByText(/^New:/)).toHaveTextContent(`New: ${chapter(9).length}`);
    expect(chapter(9).map((w) => w.greek)).toContain(cardFront());
  });
});

describe('with the other filters', () => {
  it('is not narrowed by the frequency band, which is hidden while a textbook is on', async () => {
    const user = userEvent.setup();
    // The default band is the top 100 words; chapter 22 has none of them.
    expect(chapter(22).every((w) => w.frequency < 500)).toBe(true);
    await studyTextbook(user, 22);

    expect(screen.getByTestId('card-progress')).toHaveTextContent(`1/${chapter(22).length}`);
    expect(presetRow()).toHaveAttribute('hidden');
    expect(screen.getByRole('button', { name: /toggle filters/i })).toHaveTextContent('Filters ●');
  });

  it('is narrowed by the part-of-speech filter', async () => {
    const user = userEvent.setup();
    await studyTextbook(user, 4);
    const nouns = chapter(4).filter((w) => w.partOfSpeech === 'noun');
    expect(nouns.length).toBeGreaterThan(0);
    expect(nouns.length).toBeLessThan(chapter(4).length);

    await user.click(screen.getByRole('button', { name: /toggle filters/i }));
    await user.click(screen.getByRole('button', { name: /^noun/ }));

    expect(screen.getByTestId('card-progress')).toHaveTextContent(`1/${nouns.length}`);
    expect(screen.getByRole('button', { expanded: true })).toHaveTextContent(
      `Ch. 4 · ${nouns.length} words`,
    );
    expect(screen.getByText(/^Frequency/).parentElement).toHaveAttribute('hidden');
  });

  it('"Clear filters" leaves the textbook too', async () => {
    const user = userEvent.setup();
    await studyTextbook(user, 4);
    await user.click(screen.getByRole('button', { name: /toggle filters/i }));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(textbookChip()).toHaveAttribute('aria-pressed', 'false');
    expect(storedSelection().deck).toBe('all');
  });

  it('"Clear filters" on an empty deck leaves the textbook', async () => {
    const user = userEvent.setup();
    // Chapter 7 is fourteen prepositions and ἐνώπιον: no verbs.
    await studyTextbook(user, 7);
    await user.click(screen.getByRole('button', { name: /toggle filters/i }));
    await user.click(screen.getByRole('button', { name: /^verb/ }));
    expect(screen.getByText('No cards match the current filters.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(textbookChip()).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('with a custom deck', () => {
  const DECK = { id: 'd1', name: 'Week 1', wordKeys: ['καί', 'δέ'], createdAt: '2026-11-01' };
  const deckChip = () => screen.getByRole('button', { name: /^Week 1/ });

  beforeEach(() => {
    localStorage.setItem('greek-tools-custom-decks-v1', JSON.stringify([DECK]));
  });

  it('gives way to a custom deck while it is on, and comes back after', async () => {
    const user = userEvent.setup();
    await studyTextbook(user, 3);

    await user.click(deckChip());
    expect(textbookChip()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /^Ch\. 3 —/ })).toBeNull();
    expect(screen.getByTestId('card-progress')).toHaveTextContent('1/2');

    await user.click(deckChip());
    expect(textbookChip()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('card-progress')).toHaveTextContent(`1/${chapter(3).length}`);
  });

  it('switches the custom deck off when a textbook is chosen', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(screen.getByRole('button', { name: 'Study All' }));
    await user.click(deckChip());
    await user.click(textbookChip());

    expect(deckChip()).toHaveAttribute('aria-pressed', 'false');
    expect(textbookChip()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('card-progress')).toHaveTextContent(`1/${chapter().length}`);
  });
});

describe('the session', () => {
  async function answerOne(user: UserEvent) {
    await user.keyboard(' ');
    await user.click(screen.getByRole('button', { name: /got it/i }));
  }

  it('deals a new session when the chapters change', async () => {
    const user = userEvent.setup();
    await studyTextbook(user, 3);
    await answerOne(user);
    expect(screen.getByTestId('card-progress')).toHaveTextContent(/^2\//);
    const before = sessionStarts().length;

    await user.click(screen.getByRole('button', { name: /^Ch\. 4 —/ }));

    expect(sessionStarts().length).toBe(before + 1);
    expect(screen.getByTestId('card-progress')).toHaveTextContent(`1/${chapter(3, 4).length}`);
  });

  it('keeps the session when the same chapters are picked again', async () => {
    const user = userEvent.setup();
    await studyTextbook(user, 3);
    await answerOne(user);
    const before = sessionStarts().length;

    // Chapter 3 is the only one selected, so this selects what is selected.
    await user.click(screen.getByRole('button', { name: 'Only Ch. 3' }));

    expect(sessionStarts().length).toBe(before);
    expect(screen.getByTestId('card-progress')).toHaveTextContent(/^2\//);
  });

  it('reports the deck and how many chapters with the session', async () => {
    const user = userEvent.setup();
    await studyTextbook(user);
    expect(sessionStarts().at(-1)?.[1]).toMatchObject({ chapters: 'all' });
    await pickChapters(user, 3, 4);

    expect(sessionStarts().at(-1)?.[1]).toMatchObject({
      deck: 'beginning-with-nt-greek',
      chapters: 2,
      deck_size: chapter(3, 4).length,
    });
    // The first session, on the whole vocabulary, sends the event as it always did.
    expect(sessionStarts()[0][1]).not.toHaveProperty('deck');
  });
});

describe('the stored selection', () => {
  it('saves the textbook and its chapters under this app’s key', async () => {
    const user = userEvent.setup();
    await studyTextbook(user, 5, 2);

    expect(storedSelection()).toMatchObject({
      deck: 'beginning-with-nt-greek',
      chapters: [2, 5],
    });
  });

  it('comes back on the next visit', async () => {
    localStorage.setItem(
      DECK_SELECTION_KEY,
      JSON.stringify({ deck: 'beginning-with-nt-greek', chapters: [6] }),
    );
    render(<Flashcards />);

    expect(textbookChip()).toHaveAttribute('aria-pressed', 'true');
    const summary = screen.getByRole('button', { expanded: false, name: /words$/ });
    expect(summary).toHaveTextContent(`Ch. 6 · ${chapter(6).length} words`);
    expect(within(summary).getByText(BOOK.shortTitle)).toBeInTheDocument();
    expect(chapter(6).map((w) => w.greek)).toContain(cardFront());
  });

  it('writes nothing until the student chooses something', () => {
    render(<Flashcards />);
    expect(localStorage.getItem(DECK_SELECTION_KEY)).toBeNull();
  });
});
