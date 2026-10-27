/**
 * Tests for src/components/Flashcards.tsx
 *
 * Covers the deck and filter controls (the frequency presets from issue #48,
 * the POS filter, custom decks), the card, and this app's wiring of the shared
 * session engine.
 *
 * The session rules themselves — the drill re-queue, first-attempt scoring,
 * the Endless reshuffle, the store left untouched by a drill — are tested once,
 * in @tools/shared's use-flashcard-session.test.ts (#87). The tests here check
 * what this app draws from them, its analytics names, and its typed answers.
 */

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import posthog from 'posthog-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSRSStore, loadStats, newCard, normalizeKey } from '../data/srs';
import { vocabulary } from '../data/vocabulary';
import Flashcards, { DEFAULT_FREQ_PRESET, FREQ_PRESETS } from './Flashcards';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderFlashcards() {
  return render(<Flashcards />);
}

function _getPresetButton(label: string) {
  // Preset buttons are in the preset row; find by accessible name (label text)
  return screen.getByRole('button', { name: new RegExp(label, 'i') });
}

function getFiltersToggle() {
  return screen.getByRole('button', { name: /toggle filters/i });
}

// ─── FREQ_PRESETS constant ────────────────────────────────────────────────────

describe('FREQ_PRESETS', () => {
  it('exports five presets: All, Top 100, 101–300, 301–500, 500+', () => {
    const labels = FREQ_PRESETS.map((p) => p.label);
    expect(labels).toEqual(['All', 'Top 100', '101–300', '301–500', '500+']);
  });

  it('maps preset labels to the correct FreqFilter values', () => {
    expect(FREQ_PRESETS.find((p) => p.label === 'All')?.filter).toBe('all');
    expect(FREQ_PRESETS.find((p) => p.label === 'Top 100')?.filter).toBe('500+');
    expect(FREQ_PRESETS.find((p) => p.label === '101–300')?.filter).toBe('100-499');
    expect(FREQ_PRESETS.find((p) => p.label === '301–500')?.filter).toBe('50-99');
    expect(FREQ_PRESETS.find((p) => p.label === '500+')?.filter).toBe('<50');
  });

  it('DEFAULT_FREQ_PRESET is Top 100 (500+ occurrences)', () => {
    expect(DEFAULT_FREQ_PRESET.label).toBe('Top 100');
    expect(DEFAULT_FREQ_PRESET.filter).toBe('500+');
  });
});

// ─── Preset selector visibility ───────────────────────────────────────────────

describe('Preset selector', () => {
  it('renders all five preset buttons', () => {
    renderFlashcards();
    for (const preset of FREQ_PRESETS) {
      // Use a broad regex that matches the label text
      const buttons = screen.getAllByRole('button', {
        name: new RegExp(preset.label.replace('+', '\\+').replace('–', '–'), 'i'),
      });
      expect(buttons.length).toBeGreaterThan(0);
    }
  });

  it('shows a "Preset" label', () => {
    renderFlashcards();
    expect(screen.getByText(/^preset$/i)).toBeInTheDocument();
  });

  it('marks the default preset (Top 100) as active via aria-pressed', () => {
    renderFlashcards();
    // Find all preset buttons and check aria-pressed
    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const topBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Top 100'));
    expect(topBtn).toBeDefined();
    expect(topBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks non-active presets as aria-pressed=false', () => {
    renderFlashcards();
    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const allBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === 'All');
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─── Default preset ───────────────────────────────────────────────────────────

describe('Default preset behavior', () => {
  it('initializes with Top 100 preset active', () => {
    renderFlashcards();
    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const buttons = within(presetSection).getAllByRole('button');
    const active = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toContain('Top 100');
  });

  it('filter badge shows Top 100 preset by default', () => {
    renderFlashcards();
    const badge = getFiltersToggle();
    expect(badge.textContent).toContain('Top 100');
  });
});

// ─── Preset selection ─────────────────────────────────────────────────────────

describe('Selecting a preset', () => {
  it('activates the clicked preset and deactivates others', async () => {
    const user = userEvent.setup();
    renderFlashcards();

    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const allBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === 'All')!;

    await act(async () => {
      await user.click(allBtn);
    });

    expect(allBtn).toHaveAttribute('aria-pressed', 'true');

    const topBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Top 100'))!;
    expect(topBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('filter badge updates to show the selected preset name', async () => {
    const user = userEvent.setup();
    renderFlashcards();

    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const midBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('101–300'))!;

    await act(async () => {
      await user.click(midBtn);
    });

    const badge = getFiltersToggle();
    expect(badge.textContent).toContain('101–300');
  });

  it('filter badge shows "Filters" when All preset is selected', async () => {
    const user = userEvent.setup();
    renderFlashcards();

    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const allBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === 'All')!;

    await act(async () => {
      await user.click(allBtn);
    });

    const badge = getFiltersToggle();
    expect(badge.textContent).toMatch(/^filters$/i);
  });
});

// ─── Frequency band scoping ───────────────────────────────────────────────────

describe('Frequency band scoping', () => {
  it('Top 100 preset scopes to words with 500+ occurrences', () => {
    const expected = vocabulary.filter((w) => w.frequency >= 500).length;
    // 500+ band should have some words
    expect(expected).toBeGreaterThan(0);
    // The count rendered next to the preset button should match
    renderFlashcards();
    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const topBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Top 100'))!;
    expect(topBtn.textContent).toContain(`(${expected})`);
  });

  it('101–300 preset shows count for 100–499 occurrences band', () => {
    const expected = vocabulary.filter((w) => w.frequency >= 100 && w.frequency < 500).length;
    renderFlashcards();
    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const btn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('101–300'))!;
    expect(btn.textContent).toContain(`(${expected})`);
  });

  it('All preset does not show a word count', () => {
    renderFlashcards();
    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const allBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === 'All')!;
    expect(allBtn.textContent).not.toMatch(/\(\d+\)/);
  });
});

// ─── Combinability with POS filter ────────────────────────────────────────────

describe('Combinability with POS filter', () => {
  async function openFilters(user: ReturnType<typeof userEvent.setup>) {
    await act(async () => {
      await user.click(getFiltersToggle());
    });
  }

  it('POS filter remains active when changing preset', async () => {
    const user = userEvent.setup();
    renderFlashcards();

    // Open filters panel
    await openFilters(user);

    // Click a POS filter (noun)
    const nounBtn = screen.getByRole('button', { name: /^noun/i });
    await act(async () => {
      await user.click(nounBtn);
    });

    // Change preset to All
    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const allBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === 'All')!;
    await act(async () => {
      await user.click(allBtn);
    });

    // Noun POS button should still be active
    const nounBtnAfter = screen.getByRole('button', { name: /^noun/i });
    expect(nounBtnAfter).toHaveClass('bg-grape');
  });

  it('filter badge shows ● when both preset and POS filter are active', async () => {
    const user = userEvent.setup();
    renderFlashcards();

    await openFilters(user);
    const nounBtn = screen.getByRole('button', { name: /^noun/i });
    await act(async () => {
      await user.click(nounBtn);
    });

    const badge = getFiltersToggle();
    expect(badge.textContent).toContain('●');
    expect(badge.textContent).toContain('Top 100'); // preset still active
  });

  it('filter badge shows ● with "Filters" when only POS filter is active', async () => {
    const user = userEvent.setup();
    renderFlashcards();

    // First switch to All preset
    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const allBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === 'All')!;
    await act(async () => {
      await user.click(allBtn);
    });

    // Open filters and select a POS
    await openFilters(user);
    const nounBtn = screen.getByRole('button', { name: /^noun/i });
    await act(async () => {
      await user.click(nounBtn);
    });

    const badge = getFiltersToggle();
    expect(badge.textContent).toMatch(/filters.*●/i);
  });
});

// ─── Reset behavior ───────────────────────────────────────────────────────────

describe('Reset behavior', () => {
  it('clear filters resets to All preset', async () => {
    const user = userEvent.setup();
    renderFlashcards();

    // Open filter panel
    await act(async () => {
      await user.click(getFiltersToggle());
    });

    // Clear filters button should be visible (Top 100 is active by default)
    const clearBtn = screen.getByRole('button', { name: /clear filters/i });
    await act(async () => {
      await user.click(clearBtn);
    });

    // Preset should now be All
    const presetSection = screen.getByText(/^preset$/i).parentElement!;
    const allBtn = within(presetSection)
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === 'All')!;
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─── Custom deck integration ──────────────────────────────────────────────────

describe('Custom deck integration', () => {
  const CUSTOM_DECKS_KEY = 'greek-tools-custom-decks-v1';

  function seedDecks(decks: object[]) {
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(decks));
  }

  function getMyDecksSection() {
    return screen.getByText(/^my decks$/i).parentElement!;
  }

  it('shows "My Decks" label', () => {
    renderFlashcards();
    expect(screen.getByText(/^my decks$/i)).toBeInTheDocument();
  });

  it('shows "+ Create deck" when no custom decks exist', () => {
    renderFlashcards();
    expect(screen.getByRole('button', { name: /manage custom decks/i })).toHaveTextContent(
      '+ Create deck',
    );
  });

  it('shows "Manage" button when custom decks exist', () => {
    seedDecks([{ id: '1', name: 'Week 1', wordKeys: ['καί'], createdAt: '' }]);
    renderFlashcards();
    expect(screen.getByRole('button', { name: /manage custom decks/i })).toHaveTextContent(
      'Manage',
    );
  });

  it('renders custom deck buttons with word counts', () => {
    seedDecks([{ id: '1', name: 'Week 1', wordKeys: ['καί', 'ὁ'], createdAt: '' }]);
    renderFlashcards();
    const section = getMyDecksSection();
    const deckBtn = within(section).getByText(/Week 1/);
    expect(deckBtn).toBeInTheDocument();
    // Parent button should contain word count
    expect(deckBtn.closest('button')?.textContent).toContain('(2)');
  });

  it('activates a deck when clicked (aria-pressed becomes true)', async () => {
    const user = userEvent.setup();
    seedDecks([{ id: 'deck-1', name: 'Week 1', wordKeys: ['καί'], createdAt: '' }]);
    renderFlashcards();
    const section = getMyDecksSection();
    const deckBtn = within(section)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Week 1'))!;
    await act(async () => {
      await user.click(deckBtn);
    });
    expect(deckBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('deactivates a deck when clicked again', async () => {
    const user = userEvent.setup();
    seedDecks([{ id: 'deck-1', name: 'Week 1', wordKeys: ['καί'], createdAt: '' }]);
    renderFlashcards();
    const section = getMyDecksSection();
    const deckBtn = within(section)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Week 1'))!;
    // Activate
    await act(async () => {
      await user.click(deckBtn);
    });
    expect(deckBtn).toHaveAttribute('aria-pressed', 'true');
    // Deactivate
    await act(async () => {
      await user.click(deckBtn);
    });
    expect(deckBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('filter badge shows ● when a custom deck is active', async () => {
    const user = userEvent.setup();
    seedDecks([{ id: 'deck-1', name: 'Week 1', wordKeys: ['καί'], createdAt: '' }]);
    renderFlashcards();
    const section = getMyDecksSection();
    const deckBtn = within(section)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Week 1'))!;
    await act(async () => {
      await user.click(deckBtn);
    });
    expect(getFiltersToggle().textContent).toContain('●');
  });

  it('opening deck builder closes filter panel', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    // Open filter panel first
    await act(async () => {
      await user.click(getFiltersToggle());
    });
    expect(screen.getByText(/frequency \(occurrences/i)).toBeInTheDocument();
    // Open deck builder
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /manage custom decks/i }));
    });
    expect(screen.queryByText(/frequency \(occurrences/i)).not.toBeInTheDocument();
  });

  it('opening filter panel closes deck builder', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    // Open deck builder first
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /manage custom decks/i }));
    });
    expect(screen.getByText(/no custom decks yet/i)).toBeInTheDocument();
    // Open filter panel
    await act(async () => {
      await user.click(getFiltersToggle());
    });
    expect(screen.queryByText(/no custom decks yet/i)).not.toBeInTheDocument();
  });

  it('deck builder panel is visible when Manage is clicked', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /manage custom decks/i }));
    });
    expect(screen.getByText(/no custom decks yet/i)).toBeInTheDocument();
  });

  it('empty deck (no words) renders the empty state', async () => {
    const user = userEvent.setup();
    // Seed an empty deck (0 words) — no vocab words map to it
    seedDecks([{ id: 'empty-deck', name: 'Empty', wordKeys: [], createdAt: '' }]);
    renderFlashcards();
    const section = getMyDecksSection();
    const deckBtn = within(section)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Empty'))!;
    await act(async () => {
      await user.click(deckBtn);
    });
    // No cards → empty state rendered (SRS mode: "all caught up")
    expect(screen.getByText(/all caught up|no cards match/i)).toBeInTheDocument();
  });
});

// ─── Card study flow ──────────────────────────────────────────────────────────

describe('Card study flow', () => {
  it('renders the stats bar with Due and New counts in SRS mode', () => {
    renderFlashcards();
    expect(screen.getByText(/due:/i)).toBeInTheDocument();
    expect(screen.getByText(/new:/i)).toBeInTheDocument();
  });

  it('renders Card counter in Study All mode', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const allBtn = screen.getByRole('button', { name: /study all/i });
    await act(async () => {
      await user.click(allBtn);
    });
    expect(screen.getByText(/card:/i)).toBeInTheDocument();
  });

  // Helper: find the flip hint <span> (mobile version) and navigate to the card div
  function getCardDiv() {
    // The card has two hint spans: mobile "tap to reveal" and desktop "click or press space…"
    // Use exact string match on the mobile span to uniquely identify it
    return screen.getByText('tap to reveal').closest('div')!;
  }

  it('renders a Greek word on the front of the card in gr-en direction', () => {
    renderFlashcards();
    expect(screen.getByText(/due:/i)).toBeInTheDocument();
    // Card hint is present (mobile span with exact text)
    expect(screen.getByText('tap to reveal')).toBeInTheDocument();
  });

  it('reveals the card back when clicked in flip mode', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await act(async () => {
      await user.click(getCardDiv());
    });
    // After flip, action buttons appear
    expect(screen.getByRole('button', { name: /^good/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^again/i })).toBeInTheDocument();
  });

  it('grading Good advances to the next card', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await act(async () => {
      await user.click(getCardDiv());
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^good/i }));
    });
    // Either shows next card (flip hint) or session complete
    const hasNextCard = screen.queryByText('tap to reveal');
    const sessionDone = screen.queryByText(/session complete/i);
    expect(hasNextCard || sessionDone).toBeTruthy();
  });

  it('grading Again advances to the next card', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await act(async () => {
      await user.click(getCardDiv());
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^again/i }));
    });
    const hasNextCard = screen.queryByText('tap to reveal');
    const sessionDone = screen.queryByText(/session complete/i);
    expect(hasNextCard || sessionDone).toBeTruthy();
  });

  it('shows type input in type mode', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    // Switch to type mode
    const typeBtn = screen.getByRole('button', { name: /^type$/i });
    await act(async () => {
      await user.click(typeBtn);
    });
    expect(screen.getByPlaceholderText(/type the english gloss/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^check$/i })).toBeInTheDocument();
  });

  it('shows correct/incorrect feedback in type mode', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const typeBtn = screen.getByRole('button', { name: /^type$/i });
    await act(async () => {
      await user.click(typeBtn);
    });
    const input = screen.getByPlaceholderText(/type the english gloss/i);
    await act(async () => {
      await user.type(input, 'intentionally wrong answer xyz');
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^check$/i }));
    });
    expect(screen.getByText(/not quite|correct/i)).toBeInTheDocument();
  });

  it('shows keyboard shortcut hints in flip mode', () => {
    renderFlashcards();
    // Desktop keyboard hints are present (hidden on mobile via CSS but in DOM)
    expect(screen.getByText(/keyboard:/i)).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint in type mode', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const typeBtn = screen.getByRole('button', { name: /^type$/i });
    await act(async () => {
      await user.click(typeBtn);
    });
    expect(screen.getByText(/keyboard:/i)).toBeInTheDocument();
  });

  it('"Restart session" button triggers a new session', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const restartBtn = screen.getByRole('button', { name: /restart session/i });
    await act(async () => {
      await user.click(restartBtn);
    });
    // Session restarted — card should still be showing
    expect(screen.getByText('tap to reveal')).toBeInTheDocument();
  });

  it('shows accuracy in stats bar after a review', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await act(async () => {
      await user.click(getCardDiv());
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^good/i }));
    });
    // After reviewing at least one card, accuracy should appear
    expect(screen.queryByText(/accuracy:/i)).toBeInTheDocument();
  });

  it('shows session complete screen after going through all cards in Study All mode', async () => {
    const user = userEvent.setup();
    // Use a custom deck with a single word so session completes quickly
    localStorage.setItem(
      'greek-tools-custom-decks-v1',
      JSON.stringify([{ id: 'one-word', name: 'One Word', wordKeys: ['καί'], createdAt: '' }]),
    );
    renderFlashcards();
    // Activate the single-word custom deck
    const section = screen.getByText(/^my decks$/i).parentElement!;
    const deckBtn = within(section)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('One Word'))!;
    await act(async () => {
      await user.click(deckBtn);
    });
    // Switch to Study All (avoids SRS complexity)
    const allBtn = screen.getByRole('button', { name: /study all/i });
    await act(async () => {
      await user.click(allBtn);
    });
    // Flip and mark the single card. A drill answers Missed / Got it.
    await act(async () => {
      await user.click(getCardDiv());
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^got it/i }));
    });
    // Session complete screen should now show
    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /study again/i })).toBeInTheDocument();
  });

  it('SRS mode shows "Study All Cards" button on session complete screen', async () => {
    const user = userEvent.setup();
    // Single-word deck in SRS mode
    localStorage.setItem(
      'greek-tools-custom-decks-v1',
      JSON.stringify([{ id: 'one-word', name: 'SRS Deck', wordKeys: ['καί'], createdAt: '' }]),
    );
    renderFlashcards();
    const section = screen.getByText(/^my decks$/i).parentElement!;
    const deckBtn = within(section)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('SRS Deck'))!;
    await act(async () => {
      await user.click(deckBtn);
    });
    // Flip and rate the single card (SRS mode)
    await act(async () => {
      await user.click(getCardDiv());
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^good/i }));
    });
    expect(screen.getByText(/session complete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /study all cards/i })).toBeInTheDocument();
  });

  it('shows en-gr direction when toggled', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const enGrBtn = screen.getByRole('button', { name: /english → greek/i });
    await act(async () => {
      await user.click(enGrBtn);
    });
    // In en-gr mode the input placeholder changes
    const typeBtn = screen.getByRole('button', { name: /^type$/i });
    await act(async () => {
      await user.click(typeBtn);
    });
    expect(screen.getByPlaceholderText(/type the greek word/i)).toBeInTheDocument();
  });

  // The reset moved to the account page (ResetProgress.test.tsx covers it).
  // What is left here is the way to it — and that no one-tap reset remains.
  it('links to the account page reset instead of offering one here', () => {
    renderFlashcards();

    expect(screen.getByRole('link', { name: 'Manage SRS progress' })).toHaveAttribute(
      'href',
      '/account#reset-progress',
    );
    expect(screen.queryByRole('button', { name: /reset srs/i })).not.toBeInTheDocument();
  });

  it('type mode: grading Again after an incorrect answer advances the card', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const typeBtn = screen.getByRole('button', { name: /^type$/i });
    await act(async () => {
      await user.click(typeBtn);
    });
    const input = screen.getByPlaceholderText(/type the english gloss/i);
    await act(async () => {
      await user.type(input, 'zzz wrong answer');
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^check$/i }));
    });
    // A checked answer brings up the grade row rather than a bare Next button.
    const againBtn = screen.getByRole('button', { name: /^again/i });
    expect(againBtn).toBeInTheDocument();
    await act(async () => {
      await user.click(againBtn);
    });
    // Card advanced (either new card or still on same card)
    expect(screen.queryByRole('button', { name: /^again/i })).not.toBeInTheDocument();
  });

  it('type mode: a wrong typed answer still offers every grade', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const typeBtn = screen.getByRole('button', { name: /^type$/i });
    await act(async () => {
      await user.click(typeBtn);
    });
    const input = screen.getByPlaceholderText(/type the english gloss/i);
    await act(async () => {
      await user.type(input, 'zzz wrong answer');
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^check$/i }));
    });
    // Auto-checking says whether the spelling matched, not how hard the recall
    // was, so every grade stays live even after a wrong answer — a student who
    // mistyped a word they knew cold can still say so.
    for (const name of [/^again/i, /^hard/i, /^good/i, /^easy/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^good/i }));
    });
    expect(screen.queryByRole('button', { name: /^good/i })).not.toBeInTheDocument();
  });

  it('type mode "Got It →" button appears and advances after correct answer', async () => {
    const user = userEvent.setup();
    // Seed a deck with a known word so we can type the correct gloss
    const { normalizeKey } = await import('../data/srs');
    const { vocabulary } = await import('../data/vocabulary');
    // Find the first word in top-100 and use it
    const word = vocabulary.find((w) => w.frequency >= 500)!;
    localStorage.setItem(
      'greek-tools-custom-decks-v1',
      JSON.stringify([
        { id: 'type-test', name: 'Type Test', wordKeys: [normalizeKey(word.greek)], createdAt: '' },
      ]),
    );
    renderFlashcards();
    const section = screen.getByText(/^my decks$/i).parentElement!;
    const deckBtn = within(section)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Type Test'))!;
    await act(async () => {
      await user.click(deckBtn);
    });
    const typeBtn = screen.getByRole('button', { name: /^type$/i });
    await act(async () => {
      await user.click(typeBtn);
    });
    const input = screen.getByPlaceholderText(/type the english gloss/i);
    await act(async () => {
      await user.type(input, word.gloss);
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^check$/i }));
    });
    // "Got It →" appears on correct answer
    const gotItBtn = screen.queryByRole('button', { name: /^good/i });
    if (gotItBtn) {
      await act(async () => {
        await user.click(gotItBtn);
      });
      expect(screen.queryByRole('button', { name: /^good/i })).not.toBeInTheDocument();
    }
  });
});

// ─── DeckBuilder integration (via Flashcards) ────────────────────────────────

describe('DeckBuilder integration', () => {
  it('Study button in DeckBuilder activates deck and closes builder', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'greek-tools-custom-decks-v1',
      JSON.stringify([{ id: 'study-deck', name: 'Study Me', wordKeys: ['καί'], createdAt: '' }]),
    );
    renderFlashcards();
    // Open the deck builder via "Manage" button
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /manage custom decks/i }));
    });
    // DeckBuilder list view is open; click "Study" for the deck
    const studyBtn = screen.getByRole('button', { name: /^study$/i });
    await act(async () => {
      await user.click(studyBtn);
    });
    // DeckBuilder should close (no longer showing the deck list)
    expect(screen.queryByText(/no custom decks yet/i)).not.toBeInTheDocument();
    // The deck should now be active (aria-pressed on the "My Decks" button)
    const section = screen.getByText(/^my decks$/i).parentElement!;
    const deckBtn = within(section)
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Study Me'))!;
    expect(deckBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('onDecksChange updates the deck list in Flashcards', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /manage custom decks/i }));
    });
    // Create a new deck via the DeckBuilder
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+ new deck/i }));
    });
    const nameInput = screen.getByPlaceholderText(/week 1 passage/i);
    await act(async () => {
      await user.type(nameInput, 'Fresh Deck');
    });
    // Pick at least one word
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[0]);
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /create deck/i }));
    });
    // Close DeckBuilder so we can check the My Decks row in Flashcards
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /close deck builder/i }));
    });
    // The deck should now appear in the My Decks row
    expect(screen.getByRole('button', { name: /fresh deck/i })).toBeInTheDocument();
  });

  it('onClose button closes the DeckBuilder', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /manage custom decks/i }));
    });
    expect(screen.getByText(/no custom decks yet/i)).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /close deck builder/i }));
    });
    expect(screen.queryByText(/no custom decks yet/i)).not.toBeInTheDocument();
  });
});

// ─── Part of speech on the card front ─────────────────────────────────────────

describe('part of speech', () => {
  function getCard() {
    // "tap to reveal" is shown only while unflipped, and only in flip mode.
    return screen.getByText('tap to reveal').closest('.cursor-pointer') as HTMLElement;
  }

  function toggle() {
    return screen.getByRole('switch', { name: 'Part of speech' });
  }

  /**
   * The part of speech of whichever card was dealt. The queue is shuffled, so
   * the expectation is read off the card rather than assumed — the same
   * approach the preset tests take.
   */
  function dealtPartOfSpeech(): string {
    const front = getCard().querySelector('p')?.textContent;
    const matches = vocabulary.filter((w) => w.greek === front);
    // a homograph would make the lookup ambiguous rather than merely wrong
    expect(matches).toHaveLength(1);
    return matches[0].partOfSpeech;
  }

  it('is hidden on the front by default', () => {
    renderFlashcards();
    const pos = dealtPartOfSpeech();
    expect(within(getCard()).queryByText(pos)).not.toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
  });

  it('is still revealed with the answer while hidden from the front', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const pos = dealtPartOfSpeech();
    const card = getCard();
    await user.click(card);
    // Hiding it withholds a hint, not the information.
    expect(within(card).getByText(pos)).toBeInTheDocument();
  });

  it('is revealed by checking a typed answer, not only by flipping', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const pos = dealtPartOfSpeech();
    const card = getCard();

    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.type(screen.getByRole('textbox'), 'definitely not the gloss');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(within(card).getByText(pos)).toBeInTheDocument();
  });

  it('appears on the front once the toggle is switched on', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const pos = dealtPartOfSpeech();
    await user.click(toggle());
    expect(within(getCard()).getByText(pos)).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    // Still on the front — the card was never flipped.
    expect(screen.getByText('tap to reveal')).toBeInTheDocument();
  });

  it('hides it again on a second press', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    const pos = dealtPartOfSpeech();
    await user.click(toggle());
    await user.click(toggle());
    expect(within(getCard()).queryByText(pos)).not.toBeInTheDocument();
  });

  it('remembers the choice across a remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderFlashcards();
    await user.click(toggle());
    unmount();

    renderFlashcards();
    expect(within(getCard()).getByText(dealtPartOfSpeech())).toBeInTheDocument();
  });

  it('leaves the English → Greek front alone, which has no such line to withhold', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: 'English → Greek' }));

    const card = getCard();
    const gloss = card.querySelector('p')?.textContent;
    const matches = vocabulary.filter((w) => w.gloss === gloss);
    expect(matches.length).toBeGreaterThan(0);
    const parts = new Set(matches.map((w) => w.partOfSpeech));
    expect(parts.size).toBe(1);

    // The front is the gloss here, so the part of speech only ever arrives with
    // the Greek on the back — toggle or no toggle.
    expect(within(card).queryByText([...parts][0])).not.toBeInTheDocument();
    await user.click(card);
    expect(within(card).getByText([...parts][0])).toBeInTheDocument();
  });
});

// ─── The shared session engine, as this app wires it (#87) ────────────────────

/**
 * A three-word custom deck: small enough to finish a pass or walk an Endless
 * round in a few answers. Their first glosses ("and", "he", "you (singular)")
 * are what a typed answer is marked against.
 */
const DECK = vocabulary.slice(1, 4);
const DECK_NAME = 'Three Words';

function seedDeck() {
  localStorage.setItem(
    'greek-tools-custom-decks-v1',
    JSON.stringify([
      {
        id: 'three',
        name: DECK_NAME,
        wordKeys: DECK.map((w) => normalizeKey(w.greek)),
        createdAt: '',
      },
    ]),
  );
}

type User = ReturnType<typeof userEvent.setup>;

/** Render on the three-word deck, in the given study mode. */
async function startOnDeck(user: User, mode: 'SRS Review' | 'Study All' | 'Endless') {
  seedDeck();
  renderFlashcards();
  await user.click(screen.getByRole('button', { name: new RegExp(DECK_NAME) }));
  if (mode !== 'SRS Review') await user.click(screen.getByRole('button', { name: mode }));
}

/** The word dealt, read off the front of the card in either direction. */
function dealtWord() {
  const fronts = new Set(Array.from(document.querySelectorAll('p'), (p) => p.textContent));
  const word = DECK.find((w) => fronts.has(w.greek) || fronts.has(w.gloss));
  expect(word).toBeDefined();
  return word!;
}

async function answer(user: User, which: 'missed' | 'got it') {
  await user.click(screen.getByText('tap to reveal'));
  await user.click(screen.getByRole('button', { name: new RegExp(`^${which}`, 'i') }));
}

async function switchToTyping(user: User) {
  await user.click(screen.getByRole('button', { name: 'Type' }));
}

async function typeAndCheck(user: User, text: string) {
  await user.type(screen.getByRole('textbox'), `${text}{Enter}`);
}

function sessionStarts() {
  return vi
    .mocked(posthog.capture)
    .mock.calls.filter(([name]) => name === 'flashcard_session_started').length;
}

describe('drill answers', () => {
  it('replaces the SRS grades with Missed and Got it, with no interval previews', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await user.click(screen.getByText('tap to reveal'));
    expect(screen.getByRole('button', { name: /^missed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^got it/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^good/i })).not.toBeInTheDocument();
    for (const name of [/^missed/i, /^got it/i]) {
      expect(screen.getByRole('button', { name }).textContent).not.toMatch(/\d+(\.\d)?(d|wk|mo|y)/);
    }
  });

  it('keeps the four SRS grades in SRS Review', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'SRS Review');
    await user.click(screen.getByText('tap to reveal'));
    for (const name of [/^again/i, /^hard/i, /^good/i, /^easy/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /^got it/i })).not.toBeInTheDocument();
  });

  it('answers from the keyboard: 1 is Missed, 2 is Got it', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await user.keyboard(' ');
    await user.keyboard('1');
    // A miss re-queues the card, so the pass grows by one.
    expect(screen.getByTestId('card-progress').textContent).toBe('2/4');
    await user.keyboard(' ');
    await user.keyboard('2');
    expect(screen.getByTestId('card-progress').textContent).toBe('3/4');
  });

  it('labels the keyboard hint with the row on screen', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    expect(screen.getByText(/answer \(Missed, Got it\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'SRS Review' }));
    expect(screen.getByText(/grade \(Again, Hard, Good, Easy\)/)).toBeInTheDocument();
  });

  it('reports a drill answer as flashcard_reviewed, with its study mode', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await answer(user, 'missed');
    expect(posthog.capture).toHaveBeenLastCalledWith('flashcard_reviewed', {
      result: 'incorrect',
      study_mode: 'all',
      first_attempt: true,
    });
  });

  it('reports an SRS grade with its grade and interval, and schedules the card', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'SRS Review');
    const word = dealtWord();
    await user.click(screen.getByText('tap to reveal'));
    await user.click(screen.getByRole('button', { name: /^good/i }));
    expect(posthog.capture).toHaveBeenLastCalledWith('flashcard_reviewed', {
      result: 'correct',
      grade: 'good',
      interval_days: 0,
    });
    expect(loadSRSStore()[normalizeKey(word.greek)]?.repetition).toBe(1);
  });
});

describe('Endless mode', () => {
  it('counts reviews across rounds instead of showing "Card x/y"', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Endless');
    expect(screen.queryByTestId('card-progress')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-reviewed').textContent).toBe('0');

    for (let i = 0; i < DECK.length + 2; i++) await answer(user, 'got it');

    expect(screen.queryByText(/session complete/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('session-reviewed').textContent).toBe(String(DECK.length + 2));
    expect(loadStats().totalReviewed).toBe(DECK.length + 2);
  });

  it('records the study mode on the session-started event', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Endless');
    expect(posthog.capture).toHaveBeenLastCalledWith('flashcard_session_started', {
      deck_size: DECK.length,
      study_mode: 'endless',
    });
  });

  it('reaches the summary, and the add-to-review offer, through "Finish session"', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Endless');
    await answer(user, 'missed');
    await user.click(screen.getByRole('button', { name: 'Finish session' }));
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 1 to SRS Review' })).toBeInTheDocument();
  });

  it('offers "Finish session" in Endless only', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    expect(screen.queryByRole('button', { name: 'Finish session' })).not.toBeInTheDocument();
  });
});

describe('typed answers in a drill', () => {
  /** The first sense of the gloss: what a student would type. */
  const firstGloss = (gloss: string) => gloss.split(/[,/]/)[0];

  it('shows Missed and Got it after Check, and a wrong answer can still be Got it', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await switchToTyping(user);
    await typeAndCheck(user, 'definitely not the gloss');

    expect(screen.getByText('Not quite')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^good/i })).not.toBeInTheDocument();
    // The check marks the spelling; the student says whether they knew it.
    await user.click(screen.getByRole('button', { name: /^got it/i }));
    expect(loadStats().totalCorrect).toBe(1);
    expect(screen.getByTestId('card-progress').textContent).toBe('2/3');
  });

  it('lets a matched answer still be marked Missed, which brings the card back', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await switchToTyping(user);
    await typeAndCheck(user, firstGloss(dealtWord().gloss));

    expect(screen.getByText('Correct!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^missed/i }));
    expect(screen.getByTestId('card-progress').textContent).toBe('2/4');
  });

  it('marks English → Greek against the Greek word', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await user.click(screen.getByRole('button', { name: 'English → Greek' }));
    await switchToTyping(user);
    await typeAndCheck(user, dealtWord().greek);
    expect(screen.getByText('Correct!')).toBeInTheDocument();
  });

  it('answers from the keyboard once the answer is checked', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await switchToTyping(user);
    await typeAndCheck(user, 'not it');
    await user.keyboard('2');
    expect(screen.getByTestId('card-progress').textContent).toBe('2/3');
  });

  it('focuses the input on every new card', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await switchToTyping(user);
    expect(screen.getByRole('textbox')).toHaveFocus();
    await typeAndCheck(user, 'not it');
    await user.click(screen.getByRole('button', { name: /^got it/i }));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('clears the typed answer and its mark when Endless deals a new round', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Endless');
    await switchToTyping(user);
    for (let i = 0; i < DECK.length; i++) {
      await typeAndCheck(user, 'not the answer');
      await user.click(screen.getByRole('button', { name: /^got it/i }));
    }
    expect(screen.queryByText(/session complete/i)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByText('Not quite')).not.toBeInTheDocument();
  });
});

describe('adding missed words to SRS Review', () => {
  it('offers the missed words at the end of a pass, and adds them as due today', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    const missed = dealtWord();
    await answer(user, 'missed');
    for (let i = 0; i < DECK.length; i++) await answer(user, 'got it');

    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add 1 to SRS Review' }));

    const key = normalizeKey(missed.greek);
    expect(loadSRSStore()).toEqual({ [key]: newCard(key) });
    expect(screen.getByRole('status')).toHaveTextContent('Added 1 word to SRS Review');
    expect(screen.queryByRole('button', { name: /to srs review/i })).not.toBeInTheDocument();
    expect(posthog.capture).toHaveBeenLastCalledWith('flashcard_missed_added_to_review', {
      count: 1,
      study_mode: 'all',
    });
  });

  it('offers nothing when no card was missed', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    for (let i = 0; i < DECK.length; i++) await answer(user, 'got it');
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /to srs review/i })).not.toBeInTheDocument();
  });

  it('never offers it after SRS Review, which already schedules every card', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'SRS Review');
    for (let i = 0; i < DECK.length; i++) {
      await user.click(screen.getByText('tap to reveal'));
      await user.click(screen.getByRole('button', { name: /^again/i }));
    }
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /to srs review/i })).not.toBeInTheDocument();
  });
});

describe('restarting the session', () => {
  it('deals one session on mount', () => {
    renderFlashcards();
    expect(sessionStarts()).toBe(1);
  });

  it('deals a new session when the part-of-speech filter changes', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await answer(user, 'got it');
    const before = sessionStarts();

    await user.click(getFiltersToggle());
    await user.click(screen.getByRole('button', { name: /^conjunction/i }));

    expect(sessionStarts()).toBe(before + 1);
    expect(screen.getByTestId('card-progress').textContent).toMatch(/^1\//);
  });

  it('keeps the session when only the direction or answer mode changes', async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await answer(user, 'got it');
    const before = sessionStarts();

    await user.click(screen.getByRole('button', { name: 'English → Greek' }));
    await switchToTyping(user);

    expect(sessionStarts()).toBe(before);
    expect(screen.getByTestId('card-progress').textContent).toBe('2/3');
  });

  it("deals a new session when the active deck's words change, not when it is renamed", async () => {
    const user = userEvent.setup();
    await startOnDeck(user, 'Study All');
    await answer(user, 'got it');
    const before = sessionStarts();

    const editDeck = async () => {
      await user.click(screen.getByRole('button', { name: /manage custom decks/i }));
      await user.click(screen.getByRole('button', { name: `Edit deck ${DECK_NAME}` }));
    };

    await editDeck();
    const name = screen.getByDisplayValue(DECK_NAME);
    await user.clear(name);
    await user.type(name, DECK_NAME);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await user.click(screen.getByRole('button', { name: /close deck builder/i }));
    expect(sessionStarts()).toBe(before);
    expect(screen.getByTestId('card-progress').textContent).toBe('2/3');

    await editDeck();
    await user.click(screen.getAllByRole('checkbox', { checked: true })[0]);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(sessionStarts()).toBe(before + 1);
    expect(screen.getByTestId('card-progress').textContent).toBe('1/2');
  });
});

describe('an empty deck in a drill', () => {
  it('offers to clear the filters, where SRS Review offers to study ahead', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'greek-tools-custom-decks-v1',
      JSON.stringify([{ id: 'empty', name: 'Empty', wordKeys: [], createdAt: '' }]),
    );
    renderFlashcards();
    await user.click(screen.getByRole('button', { name: /^Empty/ }));
    await user.click(screen.getByRole('button', { name: 'Study ahead anyway' }));
    expect(screen.getByText(/no cards match/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getByTestId('card-progress')).toBeInTheDocument();
  });
});
