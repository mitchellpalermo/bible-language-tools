import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSRSStore, loadStats, newCard, normalizeKey, saveSRSStore } from '../data/srs';
import { hasAuthHint } from '../lib/auth-cookie';
import { deleteServerProgress } from '../lib/sync-manager';
import { chapterStats, TEXTBOOKS, wordsInChapters } from '../data/textbooks';
import { cardKey, type HebrewVocabWord, vocabulary } from '../data/vocabulary';
import Flashcards, { FREQ_FILTERS, GENDER_LABELS, matchFreq } from './Flashcards';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

vi.mock('../lib/sync-manager', () => ({ deleteServerProgress: vi.fn() }));
vi.mock('../lib/auth-cookie', () => ({ hasAuthHint: vi.fn(() => false) }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

function renderFlashcards() {
  return render(<Flashcards />);
}

function getCard() {
  // "tap to reveal" is a single, unique span shown only while unflipped —
  // unlike the OR'd regex used elsewhere, it can't match two elements at once.
  return screen.getByText('tap to reveal').closest('.cursor-pointer') as HTMLElement;
}

function getStudyAllButton() {
  return screen.getByRole('button', { name: 'Study All' });
}

/**
 * Put one card at the front of the SRS queue, so a test can assert about a
 * *chosen* card rather than a dealt one.
 *
 * `buildQueue` puts due cards ahead of new ones, and a store holding exactly one
 * card leaves exactly one due — so the shuffle inside each group has nothing to
 * reorder.
 */
function seedDueCard(word: HebrewVocabWord) {
  const key = normalizeKey(cardKey(word));
  saveSRSStore({ [key]: newCard(key) });
}

// ─── matchFreq ────────────────────────────────────────────────────────────────

describe('matchFreq', () => {
  it('"all" matches every frequency', () => {
    expect(matchFreq(1, 'all')).toBe(true);
    expect(matchFreq(1_000_000, 'all')).toBe(true);
  });

  it('"2000+" matches only frequencies >= 2000', () => {
    expect(matchFreq(2000, '2000+')).toBe(true);
    expect(matchFreq(1999, '2000+')).toBe(false);
  });

  it('"500-1999" matches the band inclusively at the low end', () => {
    expect(matchFreq(500, '500-1999')).toBe(true);
    expect(matchFreq(1999, '500-1999')).toBe(true);
    expect(matchFreq(2000, '500-1999')).toBe(false);
    expect(matchFreq(499, '500-1999')).toBe(false);
  });

  it('"100-499" matches the band inclusively at the low end', () => {
    expect(matchFreq(100, '100-499')).toBe(true);
    expect(matchFreq(499, '100-499')).toBe(true);
    expect(matchFreq(500, '100-499')).toBe(false);
  });

  it('"<100" matches only frequencies below 100', () => {
    expect(matchFreq(99, '<100')).toBe(true);
    expect(matchFreq(100, '<100')).toBe(false);
  });
});

describe('FREQ_FILTERS', () => {
  it('exports the five expected bands in order', () => {
    expect(FREQ_FILTERS.map((f) => f.filter)).toEqual([
      'all',
      '2000+',
      '500-1999',
      '100-499',
      '<100',
    ]);
  });
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('Flashcards', () => {
  it('renders a Hebrew word on the front of the card', () => {
    renderFlashcards();
    const hebrewTerms = new Set(vocabulary.map((w) => w.hebrew));
    const shown = screen.getAllByText((_, el) =>
      el?.tagName === 'P' && hebrewTerms.has(el.textContent ?? ''),
    );
    expect(shown.length).toBeGreaterThan(0);
  });

  it('does not reveal the gloss before the card is flipped', () => {
    renderFlashcards();
    expect(screen.queryByText(/root/i)).not.toBeInTheDocument();
  });

  it('reveals the gloss and transliteration after clicking the card', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getCard());
    // "Got It" / "Still Learning" only appear once flipped
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /still learning/i })).toBeInTheDocument();
  });

  it('renders the transliteration without the uppercase transform', async () => {
    // This used to click the "2000+" band, on the reasoning that only curated
    // words carried a frequency and only curated words carry a transliteration —
    // so any band but "all" had to deal a card with one. Re-sourcing the textbook
    // vocabulary from OSHB (#109) put real counts on 382 textbook entries, none
    // of which have a transliteration, so the band stopped implying anything and
    // the test failed on whichever shuffle dealt one of them first. Seed the card
    // instead of hoping for it.
    const word = vocabulary.find((w) => w.transliteration !== undefined);
    expect(word, 'no vocabulary entry carries a transliteration').toBeDefined();
    seedDueCard(word as HebrewVocabWord);

    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getCard());

    // CSS text-transform leaves textContent untouched, so the class list is the
    // only observable signal that SBL romanization is being visually uppercased.
    // Asserting on it is deliberate here — the defect is purely presentational.
    const shown = screen.getByText(word?.transliteration as string);
    expect(shown.className).not.toMatch(/\buppercase\b/);
    expect(shown.className).toMatch(/\bitalic\b/);
  });

  it('flips via the space key', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
  });

  it('advances to the next card after marking "Got It"', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    const cardIndicatorBefore = screen.getByTestId('card-progress').textContent;
    await user.click(getCard());
    await user.click(screen.getByRole('button', { name: /got it/i }));
    const cardIndicatorAfter = screen.getByTestId('card-progress').textContent;
    expect(cardIndicatorAfter).not.toBe(cardIndicatorBefore);
  });

  it('advances to the next card via the right arrow key once flipped', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    const before = screen.getByTestId('card-progress').textContent;
    await user.click(getCard());
    await user.keyboard('{ArrowRight}');
    const after = screen.getByTestId('card-progress').textContent;
    expect(after).not.toBe(before);
  });

  it('records a review in the SRS store after "Got It"', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getCard());
    await user.click(screen.getByRole('button', { name: /got it/i }));
    const store = loadSRSStore();
    expect(Object.keys(store).length).toBe(1);
  });

  it('updates study stats after a review', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getCard());
    await user.click(screen.getByRole('button', { name: /still learning/i }));
    const stats = loadStats();
    expect(stats.totalReviewed).toBe(1);
    expect(stats.totalCorrect).toBe(0);
  });

  it('shows the session complete screen after the last card in "Study All" mode', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    // Narrowed to a band: walking the whole vocabulary is hundreds of clicks and
    // exercises nothing the band does not.
    await user.click(screen.getByRole('button', { name: /^2000\+/ }));
    const deckSize = vocabulary.filter((w) => matchFreq(w.frequency, '2000+')).length;
    for (let i = 0; i < deckSize; i++) {
      await user.click(screen.getByText('tap to reveal'));
      await user.click(screen.getByRole('button', { name: /got it/i }));
    }
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('filters the deck by frequency band', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    const lowBand = FREQ_FILTERS.find((f) => f.filter === '100-499')!;
    const expectedCount = vocabulary.filter((w) => matchFreq(w.frequency, '100-499')).length;
    await user.click(screen.getByRole('button', { name: new RegExp(`^${lowBand.label}`) }));
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${expectedCount}`);
  });

  // The empty-filter state is covered in Flashcards.empty-state.test.tsx, which
  // stubs the vocabulary module — asserting it here would mean betting that some
  // frequency band stays permanently empty as words are added.

  it('resets SRS progress when confirmed', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderFlashcards();
    await user.click(getCard());
    await user.click(screen.getByRole('button', { name: /got it/i }));
    expect(Object.keys(loadSRSStore()).length).toBe(1);

    await user.click(screen.getByRole('button', { name: /reset srs/i }));
    expect(loadSRSStore()).toEqual({});
  });

  it('clears server progress on reset when signed in', async () => {
    // PUT merges server-side, so clearing localStorage alone would be undone by
    // the next sync. DELETE is the only path that actually removes anything.
    const user = userEvent.setup();
    vi.mocked(hasAuthHint).mockReturnValue(true);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderFlashcards();

    await user.click(screen.getByRole('button', { name: /reset srs/i }));

    expect(deleteServerProgress).toHaveBeenCalledOnce();
  });

  it('does not call the server on reset when signed out', async () => {
    const user = userEvent.setup();
    vi.mocked(hasAuthHint).mockReturnValue(false);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderFlashcards();

    await user.click(screen.getByRole('button', { name: /reset srs/i }));

    expect(deleteServerProgress).not.toHaveBeenCalled();
  });

  it('does not clear server progress when the reset is declined', async () => {
    const user = userEvent.setup();
    vi.mocked(hasAuthHint).mockReturnValue(true);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    renderFlashcards();

    await user.click(screen.getByRole('button', { name: /reset srs/i }));

    expect(deleteServerProgress).not.toHaveBeenCalled();
  });

  it('does not reset SRS progress when the confirm dialog is declined', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    renderFlashcards();
    await user.click(getCard());
    await user.click(screen.getByRole('button', { name: /got it/i }));

    await user.click(screen.getByRole('button', { name: /reset srs/i }));
    expect(Object.keys(loadSRSStore()).length).toBe(1);
  });

  it('shows "study ahead anyway" when SRS mode has nothing due', () => {
    renderFlashcards();
    // Fresh store: every card counts as "new", not "due", so SRS mode still has cards.
    // Simulate a fully-reviewed, not-yet-due store by pre-seeding localStorage.
    const store: Record<string, unknown> = {};
    for (const w of vocabulary) {
      store[cardKey(w)] = {
        key: cardKey(w),
        interval: 30,
        repetition: 3,
        easeFactor: 2.5,
        dueDate: '2999-01-01',
        lastReviewed: '2020-01-01',
      };
    }
    localStorage.setItem('hebrew-tools-srs-v1', JSON.stringify(store));

    renderFlashcards();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /study ahead anyway/i })).toBeInTheDocument();
  });

  it('switches to "Study All" from the empty SRS state', async () => {
    const user = userEvent.setup();
    const store: Record<string, unknown> = {};
    for (const w of vocabulary) {
      store[cardKey(w)] = {
        key: cardKey(w),
        interval: 30,
        repetition: 3,
        easeFactor: 2.5,
        dueDate: '2999-01-01',
        lastReviewed: '2020-01-01',
      };
    }
    localStorage.setItem('hebrew-tools-srs-v1', JSON.stringify(store));

    renderFlashcards();
    await user.click(screen.getByRole('button', { name: /study ahead anyway/i }));
    expect(screen.getByText('tap to reveal')).toBeInTheDocument();
  });

  it('renders the accuracy stat once a review has been recorded', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    expect(screen.queryByText(/Accuracy:/)).not.toBeInTheDocument();
    await user.click(getCard());
    await user.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.getByText(/Accuracy:/)).toBeInTheDocument();
  });

  it('restarts the session when "Restart session" is clicked', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await user.click(getCard());
    await user.click(screen.getByRole('button', { name: /got it/i }));
    await user.click(screen.getByRole('button', { name: /restart session/i }));
    expect(screen.getByTestId('card-progress').textContent).toMatch(/^1\//);
  });
});

// ─── Textbook chapter decks ───────────────────────────────────────────────────

describe('Flashcards chapter decks', () => {
  const book = TEXTBOOKS['garrett-derouchie'];
  const stats = chapterStats('garrett-derouchie');

  function selectTextbook(user: ReturnType<typeof userEvent.setup>) {
    return user.click(screen.getByRole('button', { name: book.shortTitle }));
  }

  function openPicker(user: ReturnType<typeof userEvent.setup>) {
    return user.click(screen.getByRole('button', { expanded: false }));
  }

  function chapterButton(chapter: number) {
    return screen.getByRole('button', { name: new RegExp(`^${book.unitLabel} ${chapter} —`) });
  }

  it('defaults to the whole vocabulary', () => {
    renderFlashcards();
    expect(screen.getByRole('button', { name: /^All vocabulary/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('offers one chip per textbook rather than one per chapter', () => {
    renderFlashcards();
    expect(screen.getByRole('button', { name: book.shortTitle })).toBeInTheDocument();
    // The old flat chip row put every chapter in the deck bar; the picker
    // replaces it, so no bare chapter chip should be reachable while collapsed.
    expect(screen.queryByRole('button', { name: `${book.unitLabel} 2` })).not.toBeInTheDocument();
  });

  it('scopes the session to the textbook, core vocabulary by default', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectTextbook(user);

    const expected = wordsInChapters('garrett-derouchie', [], ['core']).length;
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${expected}`);
  });

  it('narrows to a single chapter through the picker', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectTextbook(user);
    await openPicker(user);
    await user.click(chapterButton(2));

    const expected = wordsInChapters('garrett-derouchie', [2], ['core']).length;
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${expected}`);
  });

  it('only draws cards from the selected chapter', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectTextbook(user);
    await openPicker(user);
    await user.click(chapterButton(2));

    const words = wordsInChapters('garrett-derouchie', [2], ['core']);
    const inDeck = new Set(words.map((w) => w.hebrew));
    for (let i = 0; i < words.length; i++) {
      const front = screen.getByText((_, el) => el?.getAttribute('dir') === 'rtl');
      expect(inDeck.has(front.textContent ?? '')).toBe(true);
      await user.click(screen.getByText('tap to reveal'));
      await user.click(screen.getByRole('button', { name: /got it/i }));
    }
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('"Through Ch. N" selects every chapter up to the furthest one picked', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectTextbook(user);
    await openPicker(user);
    await user.click(chapterButton(4));
    await user.click(screen.getByRole('button', { name: `Through ${book.unitLabel} 4` }));

    const expected = wordsInChapters('garrett-derouchie', [1, 2, 3, 4], ['core']).length;
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${expected}`);
  });

  it('"All chapters" clears the narrowing without emptying the deck', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectTextbook(user);
    await openPicker(user);
    await user.click(chapterButton(2));
    await user.click(screen.getByRole('button', { name: 'All chapters' }));

    const expected = wordsInChapters('garrett-derouchie', [], ['core']).length;
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${expected}`);
  });

  it('adds a category to the study set when its chip is switched on', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectTextbook(user);
    await user.click(screen.getByRole('button', { name: /^Proper names/ }));

    const expected = wordsInChapters('garrett-derouchie', [], ['core', 'proper']).length;
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${expected}`);
  });

  it('refuses to switch off the last remaining category', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectTextbook(user);

    const before = screen.getByTestId('card-progress').textContent;
    await user.click(screen.getByRole('button', { name: /^Core/ }));
    expect(screen.getByTestId('card-progress').textContent).toBe(before);
    expect(screen.getByRole('button', { name: /^Core/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('replaces the frequency bands with the chapter summary', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    expect(screen.getByRole('button', { name: /^2000\+/ })).toBeInTheDocument();
    await selectTextbook(user);
    expect(screen.queryByRole('button', { name: /^2000\+/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/All chapters/).length).toBeGreaterThan(0);
  });

  it('returns to the whole vocabulary via the "All vocabulary" chip', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectTextbook(user);
    await user.click(screen.getByRole('button', { name: /^All vocabulary/ }));
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${vocabulary.length}`);
  });

  it('restores the previous selection on a later visit', async () => {
    const user = userEvent.setup();
    const { unmount } = renderFlashcards();
    await user.click(getStudyAllButton());
    await selectTextbook(user);
    await openPicker(user);
    await user.click(chapterButton(3));
    unmount();

    renderFlashcards();
    await user.click(getStudyAllButton());
    const expected = wordsInChapters('garrett-derouchie', [3], ['core']).length;
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${expected}`);
  });

  it('labels every chapter cell with its word count', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await selectTextbook(user);
    await openPicker(user);
    for (const { chapter, total } of stats) {
      expect(
        screen.getByRole('button', { name: `${book.unitLabel} ${chapter} — ${total} words` }),
      ).toBeInTheDocument();
    }
  });

  // The deck is shuffled, so which card comes up first is not knowable from the
  // test. Asserting "gender is on screen" therefore only held when the shuffle
  // happened to deal a noun — chapter 2's core list is 9 nouns and 3 particles,
  // which made this fail one run in four. The invariant that does hold for every
  // card is that the line appears exactly when the word has a gender, so the
  // expectation is read off whichever card was dealt.
  it('shows gender on the back of a card exactly when the word has one', async () => {
    const deck = wordsInChapters('garrett-derouchie', [2], ['core']);
    // guards against the test passing vacuously if the chapter's data changes
    expect(deck.some((w) => w.gender)).toBe(true);
    expect(deck.some((w) => !w.gender)).toBe(true);

    const user = userEvent.setup();
    renderFlashcards();
    await selectTextbook(user);
    await openPicker(user);
    await user.click(chapterButton(2));

    const card = getCard();
    const hebrew = card.querySelector('p[dir="rtl"]')?.textContent;
    const matches = deck.filter((w) => w.hebrew === hebrew);
    // a homograph would make the lookup ambiguous rather than merely wrong
    expect(matches).toHaveLength(1);
    const { gender } = matches[0];

    await user.click(card);

    if (gender) {
      expect(screen.getByText(GENDER_LABELS[gender], { exact: false })).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/masculine|feminine/)).not.toBeInTheDocument();
    }
  });
});
