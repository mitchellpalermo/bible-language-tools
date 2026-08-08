import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSRSStore, loadStats } from '../data/srs';
import { hasAuthHint } from '../lib/auth-cookie';
import { deleteServerProgress } from '../lib/sync-manager';
import { type ChapterDeck, chapterDecks, TEXTBOOKS } from '../data/textbooks';
import { vocabulary } from '../data/vocabulary';
import Flashcards, { FREQ_FILTERS, matchFreq } from './Flashcards';

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
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getCard());

    // CSS text-transform leaves textContent untouched, so the class list is the
    // only observable signal that SBL romanization is being visually uppercased.
    // Asserting on it is deliberate here — the defect is purely presentational.
    const transliterations = new Set(vocabulary.map((w) => w.transliteration));
    const shown = screen.getByText(
      (_, el) => el?.tagName === 'P' && transliterations.has(el.textContent ?? ''),
    );
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
    for (let i = 0; i < vocabulary.length; i++) {
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
      store[w.hebrew] = {
        key: w.hebrew,
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
      store[w.hebrew] = {
        key: w.hebrew,
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
  const decks = chapterDecks();
  const firstDeck = decks[0];

  function selectDeck(user: ReturnType<typeof userEvent.setup>, deck: ChapterDeck) {
    return user.click(screen.getByRole('button', { name: deck.label }));
  }

  it('renders a chip for every chapter deck that has words', () => {
    renderFlashcards();
    for (const deck of decks) {
      expect(screen.getByRole('button', { name: deck.label })).toBeInTheDocument();
    }
  });

  it('defaults to the whole vocabulary', () => {
    renderFlashcards();
    expect(screen.getByRole('button', { name: /^All vocabulary/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('scopes the session to the chapter list when a deck is selected', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectDeck(user, firstDeck);
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${firstDeck.words.length}`);
  });

  it('only draws cards from the selected chapter', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectDeck(user, firstDeck);

    const inDeck = new Set(firstDeck.words.map((w) => w.hebrew));
    for (let i = 0; i < firstDeck.words.length; i++) {
      const front = screen.getByText((_, el) => el?.getAttribute('dir') === 'rtl');
      expect(inDeck.has(front.textContent ?? '')).toBe(true);
      await user.click(screen.getByText('tap to reveal'));
      await user.click(screen.getByRole('button', { name: /got it/i }));
    }
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('replaces the frequency bands with the textbook attribution', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    expect(screen.getByRole('button', { name: /^2000\+/ })).toBeInTheDocument();
    await selectDeck(user, firstDeck);
    expect(screen.queryByRole('button', { name: /^2000\+/ })).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(TEXTBOOKS[firstDeck.textbook].title))).toBeInTheDocument();
  });

  it('deselects the deck when its chip is clicked again', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectDeck(user, firstDeck);
    await selectDeck(user, firstDeck);
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${vocabulary.length}`);
  });

  it('returns to the whole vocabulary via the "All vocabulary" chip', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(getStudyAllButton());
    await selectDeck(user, firstDeck);
    await user.click(screen.getByRole('button', { name: /^All vocabulary/ }));
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${vocabulary.length}`);
  });

  it('shows gender on the back of a card that has one', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await selectDeck(user, firstDeck);
    await user.click(getCard());
    // Every Garrett & DeRouchie ch. 1 entry is listed with a gender.
    expect(screen.getByText(/masculine|feminine/)).toBeInTheDocument();
  });
});
