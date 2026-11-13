// Typed answers, directions, and the part-of-speech and root filters (#74).
//
// These test the wiring and what is drawn. The session rules a typed answer
// runs on (Check never answers the card, a restart only on `restartKey`) are
// tested once, in @tools/shared's `use-flashcard-session.test.ts`; the marking
// and the filter rules are in `src/lib/flashcard-answer.test.ts` and
// `flashcard-filters.test.ts`.
//
// Apart from Flashcards.test.tsx only for size.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import posthog from 'posthog-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSRSStore, loadStats } from '../data/srs';
import { TEXTBOOKS, wordsInChapters } from '../data/textbooks';
import { type HebrewVocabWord, vocabulary } from '../data/vocabulary';
import { customDeckStore, deckKey } from '../lib/custom-decks';
import { saveSelection } from '../lib/deck-selection';
import { canAsk } from '../lib/flashcard-answer';
import Flashcards from './Flashcards';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

type User = ReturnType<typeof userEvent.setup>;

/** A vocabulary entry by headword, so a test names the card it is about. */
function entry(hebrew: string): HebrewVocabWord {
  const word = vocabulary.find((w) => w.hebrew === hebrew);
  if (!word) throw new Error(`${hebrew} is not in the vocabulary`);
  return word;
}

const DAVAR = entry('דָּבָר');
const MELEK = entry('מֶלֶךְ');
const KATAV = entry('כָּתַב');

/**
 * Study exactly these words, as a custom deck. A one-word deck is the simplest
 * way to know which card is on screen.
 */
function pickDeck(...words: HebrewVocabWord[]) {
  const deck = customDeckStore.create('Test deck', words.map(deckKey));
  saveSelection({ deck: 'custom', customDeckId: deck.id, chapters: [], categories: ['core'] });
}

const press = (name: string | RegExp) => screen.getByRole('button', { name });
const getCard = () => screen.getByText('tap to reveal').closest('.cursor-pointer') as HTMLElement;
const studyAll = (user: User) => user.click(press('Study All'));
const progress = () => screen.getByTestId('card-progress').textContent;
const total = () => Number(progress()?.split('/')[1]);
const mark = () => screen.getByRole('status');
const hebrewField = () => screen.getByLabelText('Your answer in Hebrew') as HTMLInputElement;

// ─── Typed answers ────────────────────────────────────────────────────────────

describe('typed answers', () => {
  async function typeMode(user: User) {
    await user.click(press('Type'));
    return screen.getByLabelText('Your answer in English');
  }

  it('replaces the tap-to-reveal card with a focused field', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    const field = await typeMode(user);
    expect(field).toHaveFocus();
    expect(screen.queryByText('tap to reveal')).not.toBeInTheDocument();
    expect(press('Type')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/check answer/)).toBeInTheDocument();
  });

  it('marks a right gloss and reveals the back, without answering the card', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.type(await typeMode(user), 'thing');
    await user.click(press('Check'));

    expect(mark()).toHaveTextContent('Correct!');
    expect(screen.getByText(DAVAR.gloss)).toBeInTheDocument();
    // Checking is not grading: nothing is scheduled until a grade is picked.
    expect(loadSRSStore()).toEqual({});
    await user.click(press(/^good/i));
    expect(Object.keys(loadSRSStore())).toEqual([deckKey(DAVAR)]);
  });

  it('marks a wrong gloss, shows the answer, and still leaves every grade live', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.type(await typeMode(user), 'queen');
    await user.click(press('Check'));

    expect(mark()).toHaveTextContent('Not quite');
    expect(mark()).toHaveTextContent(`Answer: ${DAVAR.gloss}`);
    for (const grade of [/^again/i, /^hard/i, /^good/i, /^easy/i]) {
      expect(press(grade)).toBeEnabled();
    }
  });

  it('checks on Enter, then grades from the number keys', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.type(await typeMode(user), 'word{Enter}');
    expect(mark()).toHaveTextContent('Correct!');
    await user.keyboard('3');
    expect(loadStats().totalCorrect).toBe(1);
  });

  it('marks an empty answer as a miss rather than ignoring the Check', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await typeMode(user);
    await user.click(press('Check'));
    expect(mark()).toHaveTextContent('Not quite');
  });

  it('answers a drill with Missed / Got it after the check', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await studyAll(user);
    await user.type(await typeMode(user), 'queen{Enter}');
    // A mistyped word the student knew is still theirs to call.
    await user.click(press(/got it/i));
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    expect(loadSRSStore()).toEqual({});
  });

  it('keeps the session when switching between Flip and Type', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await studyAll(user);
    const before = getCard().querySelector('p[dir="rtl"]')?.textContent;
    await user.click(press('Type'));
    await user.click(press('Flip'));
    expect(getCard().querySelector('p[dir="rtl"]')?.textContent).toBe(before);
    expect(progress()).toBe(`1/${vocabulary.length}`);
  });
});

// ─── Directions ───────────────────────────────────────────────────────────────

describe('directions', () => {
  async function typeHebrew(user: User) {
    await user.click(press('English → Hebrew'));
    await user.click(press('Type'));
    return hebrewField();
  }

  it('starts on Hebrew → English', () => {
    render(<Flashcards />);
    expect(press('Hebrew → English')).toHaveAttribute('aria-pressed', 'true');
  });

  it('English → Hebrew puts the gloss on the front and keeps the Hebrew for the answer', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(press('English → Hebrew'));

    expect(screen.getByTestId('card-prompt')).toHaveTextContent(DAVAR.gloss);
    expect(screen.queryByText(DAVAR.hebrew)).not.toBeInTheDocument();
    // The front is the gloss, so there is no part of speech to show on it.
    await user.click(screen.getByRole('switch', { name: 'Part of speech' }));
    expect(screen.queryByText(DAVAR.partOfSpeech)).not.toBeInTheDocument();

    await user.click(getCard());
    expect(screen.getByText(DAVAR.hebrew)).toBeInTheDocument();
    expect(screen.getByText(DAVAR.partOfSpeech)).toBeInTheDocument();
    // The gloss was the prompt; it is not printed a second time.
    expect(screen.getAllByText(DAVAR.gloss)).toHaveLength(1);
  });

  it('types Hebrew through the keyboard mapping, right to left, and marks it', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    const field = await typeHebrew(user);
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('dir', 'rtl');
    expect(field).toHaveAttribute('lang', 'he');

    await user.type(field, 'd.AbAr');
    expect(field.value.normalize('NFC')).toBe(DAVAR.hebrew.normalize('NFC'));
    await user.keyboard('{Enter}');

    expect(mark()).toHaveAttribute('data-result', 'correct');
    expect(screen.getByText(DAVAR.hebrew)).toBeInTheDocument();
    expect(press(/^good/i)).toBeEnabled();
  });

  it('applies the final form to the last letter typed', async () => {
    pickDeck(MELEK);
    const user = userEvent.setup();
    render(<Flashcards />);
    const field = await typeHebrew(user);
    await user.type(field, 'melek:');
    expect(field.value.normalize('NFC')).toBe(MELEK.hebrew.normalize('NFC'));
    await user.click(press('Check'));
    expect(mark()).toHaveAttribute('data-result', 'correct');
  });

  it.each([
    ['dAbAr', 'dagesh-only', 'Right letters and vowels, dagesh off'],
    ['d.abar', 'nikud-only', 'Right consonants, pointing off'],
    ['dbr', 'nikud-only', 'Right consonants, pointing off'],
  ])('marks %s as %s, beside what was typed', async (keys, result, heading) => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.type(await typeHebrew(user), `${keys}{Enter}`);

    expect(mark()).toHaveAttribute('data-result', result);
    expect(mark()).toHaveTextContent(heading);
    expect(mark()).toHaveTextContent('You typed');
    expect(mark()).toHaveTextContent(`Answer: ${DAVAR.hebrew}`);
    // Lenient marking is information. The grade is still the student's.
    expect(press(/^again/i)).toBeEnabled();
    expect(press(/^easy/i)).toBeEnabled();
  });

  it('marks wrong letters Not quite', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.type(await typeHebrew(user), 'melek{Enter}');
    expect(mark()).toHaveTextContent('Not quite');
    expect(mark()).not.toHaveTextContent('You typed');
  });

  it('types from the on-screen keypad without raising the system keyboard', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    const field = await typeHebrew(user);
    expect(field).toHaveAttribute('inputmode', 'text');
    expect(screen.getByRole('link', { name: 'phonetic mapping' })).toHaveAttribute(
      'href',
      '/keyboard',
    );

    await user.click(screen.getByRole('switch', { name: 'Keypad' }));
    expect(hebrewField()).toHaveAttribute('inputmode', 'none');
    const keypad = within(screen.getByRole('region', { name: 'Hebrew keypad' }));
    for (const name of ['dalet', 'dagesh', 'qamets', 'bet', 'qamets', 'resh', 'resh']) {
      await user.click(keypad.getByRole('button', { name }));
    }
    await user.click(keypad.getByRole('button', { name: 'Backspace' }));
    await user.click(press('Check'));
    expect(mark()).toHaveAttribute('data-result', 'correct');
  });

  it('opens the keypad by default on a touch screen', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query === '(pointer: coarse)' })),
    );
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await typeHebrew(user);
    expect(screen.getByRole('region', { name: 'Hebrew keypad' })).toBeInTheDocument();
  });

  it('offers two directions; transliteration is on the answer side only', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    const group = within(screen.getByRole('group', { name: 'Direction' }));
    expect(group.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Hebrew → English',
      'English → Hebrew',
    ]);

    await user.click(press('English → Hebrew'));
    expect(screen.queryByText(DAVAR.transliteration as string)).not.toBeInTheDocument();
    await user.click(getCard());
    expect(screen.getByText(DAVAR.transliteration as string)).toBeInTheDocument();
  });

  it('keeps the session between Hebrew → English and English → Hebrew', async () => {
    const five = vocabulary.filter((w) => canAsk(w, 'en-he')).slice(0, 5);
    pickDeck(...five);
    const user = userEvent.setup();
    render(<Flashcards />);
    await studyAll(user);
    await user.click(getCard());
    await user.click(press(/got it/i));
    expect(progress()).toBe('2/5');

    await user.click(press('English → Hebrew'));
    expect(progress()).toBe('2/5');
    expect(screen.queryByTestId('direction-note')).not.toBeInTheDocument();
    await user.click(press('Hebrew → English'));
    expect(progress()).toBe('2/5');
  });

  it('clears a half-typed answer when the direction changes', async () => {
    pickDeck(DAVAR);
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(press('Type'));
    await user.type(screen.getByLabelText('Your answer in English'), 'wor');
    await user.click(press('English → Hebrew'));
    expect(hebrewField().value).toBe('');
  });

  describe('a word whose gloss quotes the Hebrew', () => {
    const quoted = vocabulary.find((w) => !canAsk(w, 'en-he')) as HebrewVocabWord;

    it('exists, or these tests are about nothing', () => {
      expect(quoted).toBeDefined();
    });

    it('is left out of English → Hebrew, and the page says so', async () => {
      pickDeck(DAVAR, quoted);
      const user = userEvent.setup();
      render(<Flashcards />);
      await studyAll(user);
      await user.click(press('English → Hebrew'));
      expect(progress()).toBe('1/1');
      expect(screen.getByTestId('direction-note')).toHaveTextContent('1 word is left out');
    });

    it('explains a deck the direction can ask none of, with a way back', async () => {
      pickDeck(quoted);
      const user = userEvent.setup();
      render(<Flashcards />);
      await user.click(press('English → Hebrew'));
      expect(screen.getByText('No word in this deck can be asked from its gloss.')).toBeTruthy();
      await user.click(press('Back to Hebrew → English'));
      expect(screen.getByText(quoted.hebrew)).toBeInTheDocument();
    });

    it('deals a new session for the smaller deck, and records how it is asked', async () => {
      pickDeck(DAVAR, KATAV, quoted);
      const user = userEvent.setup();
      render(<Flashcards />);
      await studyAll(user);
      await user.click(getCard());
      await user.click(press(/got it/i));
      expect(progress()).toBe('2/3');

      await user.click(press('Type'));
      await user.click(press('English → Hebrew'));
      // Two of the three can be asked from their gloss: a different deck.
      expect(progress()).toBe('1/2');
      expect(posthog.capture).toHaveBeenLastCalledWith(
        'hebrew_flashcard_session_started',
        expect.objectContaining({
          direction: 'en-he',
          answer_mode: 'type',
          filtered: false,
          deck_size: 2,
        }),
      );
    });
  });
});

// ─── Filters ──────────────────────────────────────────────────────────────────

describe('part-of-speech and root filters', () => {
  const panel = () => within(screen.getByRole('region', { name: 'Filters' }));
  const chip = (name: string | RegExp) => panel().getByRole('button', { name });

  async function openFilters(user: User) {
    await studyAll(user);
    await user.click(press('Toggle filters'));
  }

  it('is closed until asked for', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    expect(screen.queryByRole('region', { name: 'Filters' })).not.toBeInTheDocument();
    await user.click(press('Toggle filters'));
    expect(press('Toggle filters')).toHaveAttribute('aria-expanded', 'true');
    expect(panel().getByText(`${vocabulary.length}`)).toBeInTheDocument();
    await user.click(press('Toggle filters'));
    expect(screen.queryByRole('region', { name: 'Filters' })).not.toBeInTheDocument();
  });

  it('narrows the whole vocabulary to a part of speech, drawn as a chip', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await openFilters(user);
    const verbs = vocabulary.filter((w) => w.partOfSpeech === 'verb').length;

    expect(chip(`verb (${verbs})`)).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip(`verb (${verbs})`));
    expect(chip(`verb (${verbs})`)).toHaveAttribute('aria-pressed', 'true');
    expect(total()).toBe(verbs);
    expect(press('Toggle filters')).toHaveTextContent('Filters ●');
    // The display switch is a different control and is untouched.
    expect(screen.getByRole('switch', { name: 'Part of speech' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('adds a second part of speech rather than replacing the first', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await openFilters(user);
    await user.click(chip(/^conjunction/));
    await user.click(chip(/^preposition/));
    expect(total()).toBe(
      vocabulary.filter((w) => ['conjunction', 'preposition'].includes(w.partOfSpeech)).length,
    );
    await user.click(chip(/^conjunction/));
    expect(total()).toBe(vocabulary.filter((w) => w.partOfSpeech === 'preposition').length);
  });

  it('narrows to a root offered as a word family', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await openFilters(user);
    const family = vocabulary.filter((w) => w.root === 'מלך');
    expect(family.length).toBeGreaterThan(1);
    await user.click(chip(`מלך (${family.length})`));
    expect(total()).toBe(family.length);
    expect(panel().getByText(`${family.length}`, { selector: 'strong' })).toBeInTheDocument();
  });

  it('finds any root by typing it through the keyboard mapping', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await openFilters(user);
    const count = vocabulary.filter((w) => w.root === 'כתב').length;
    expect(panel().queryByRole('button', { name: /^כתב/ })).not.toBeInTheDocument();

    await user.type(panel().getByLabelText('Find a root'), 'kTb');
    await user.click(chip(`כתב (${count})`));
    expect(total()).toBe(count);
  });

  it('says when no root matches what was typed', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await openFilters(user);
    await user.type(panel().getByLabelText('Find a root'), 'qqq');
    expect(panel().getByText('No root in this deck matches.')).toBeInTheDocument();
  });

  it('combines a part of speech with a root', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await openFilters(user);
    await user.click(chip(/^מלך/));
    await user.click(chip(/^verb/));
    expect(total()).toBe(
      vocabulary.filter((w) => w.root === 'מלך' && w.partOfSpeech === 'verb').length,
    );
  });

  it('composes with a custom deck, counting within it', async () => {
    pickDeck(DAVAR, MELEK, KATAV);
    const user = userEvent.setup();
    render(<Flashcards />);
    await openFilters(user);
    expect(chip('noun (2)')).toBeInTheDocument();
    // A part of speech the deck does not hold is not offered.
    expect(panel().queryByRole('button', { name: /^adjective/ })).not.toBeInTheDocument();

    await user.click(chip('verb (1)'));
    expect(total()).toBe(1);
    expect(panel().getByText('word matches')).toBeInTheDocument();
    expect(screen.getByText(/^1 words? · Test deck/)).toBeInTheDocument();
    expect(screen.getByText(KATAV.hebrew)).toBeInTheDocument();
  });

  it('composes with a textbook deck', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(press(TEXTBOOKS['garrett-derouchie'].shortTitle));
    await openFilters(user);
    await user.click(chip(/^verb/));
    expect(total()).toBe(
      wordsInChapters('garrett-derouchie', [], ['core']).filter((w) => w.partOfSpeech === 'verb')
        .length,
    );
  });

  it('deals a new session when a filter changes, and none when the panel only opens', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await studyAll(user);
    await user.click(getCard());
    await user.click(press(/got it/i));
    expect(progress()).toMatch(/^2\//);
    await user.click(press('Toggle filters'));
    expect(progress()).toMatch(/^2\//);
    await user.click(chip(/^noun/));
    expect(progress()).toMatch(/^1\//);
  });

  it('clears both filters from the panel and keeps the deck', async () => {
    pickDeck(DAVAR, MELEK, KATAV);
    const user = userEvent.setup();
    render(<Flashcards />);
    await openFilters(user);
    expect(panel().queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.click(chip(/^verb/));
    await user.click(chip('Clear filters'));
    expect(total()).toBe(3);
    expect(press(/Test deck/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('says so when the filters leave nothing, and clearing them keeps the deck', async () => {
    pickDeck(DAVAR, MELEK, KATAV);
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(press('Toggle filters'));
    await user.click(chip(/^verb/));
    await user.type(panel().getByLabelText('Find a root'), 'mlk');
    await user.click(chip(/^מלך/));
    // Not "all caught up", although this is SRS Review: the filters did it.
    expect(screen.getByText('No cards match the current filters.')).toBeInTheDocument();
    expect(screen.queryByText(/all caught up/)).not.toBeInTheDocument();

    await user.click(press('Clear filters'));
    expect(press(/Test deck/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/^Due:/)).toBeInTheDocument();
  });

  it('keeps a chosen filter listed after a change of deck, so it can be switched off', async () => {
    customDeckStore.create('Test deck', [DAVAR, MELEK].map(deckKey));
    const user = userEvent.setup();
    render(<Flashcards />);
    await openFilters(user);
    await user.click(chip(/^noun/));
    await user.click(chip(/^verb/));
    await user.click(press(/Test deck/));
    // The deck has two nouns: no verb chip would be drawn, but the chosen one is.
    expect(total()).toBe(2);
    expect(chip('verb (0)')).toHaveAttribute('aria-pressed', 'true');
    await user.click(chip('verb (0)'));
    expect(panel().queryByRole('button', { name: /^verb/ })).not.toBeInTheDocument();
  });
});
