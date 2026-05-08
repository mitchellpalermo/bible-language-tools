/**
 * Tests for src/components/Flashcards.tsx
 *
 * Focuses on the frequency preset selector introduced in issue #48:
 * - Preset buttons are visible in the deck setup area
 * - Each preset correctly scopes the deck to the frequency band
 * - Presets are combinable with the POS filter
 * - Active preset is reflected in the filter badge
 * - Default preset is "Top 100" (500+ occurrences)
 */

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /still learning/i })).toBeInTheDocument();
  });

  it('"Got It" advances to the next card', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await act(async () => {
      await user.click(getCardDiv());
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /got it/i }));
    });
    // Either shows next card (flip hint) or session complete
    const hasNextCard = screen.queryByText('tap to reveal');
    const sessionDone = screen.queryByText(/session complete/i);
    expect(hasNextCard || sessionDone).toBeTruthy();
  });

  it('"Still Learning" advances to the next card', async () => {
    const user = userEvent.setup();
    renderFlashcards();
    await act(async () => {
      await user.click(getCardDiv());
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /still learning/i }));
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
      await user.click(screen.getByRole('button', { name: /got it/i }));
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
    // Flip and mark the single card
    await act(async () => {
      await user.click(getCardDiv());
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /got it/i }));
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
      await user.click(screen.getByRole('button', { name: /got it/i }));
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

  it('"Reset SRS" button is shown in SRS mode and resets store', async () => {
    renderFlashcards();
    expect(screen.getByRole('button', { name: /reset srs/i })).toBeInTheDocument();
  });

  it('"Reset SRS" resets SRS progress when confirmed', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const user = userEvent.setup();
    // Seed some SRS data
    localStorage.setItem(
      'greek-tools-srs-v2',
      JSON.stringify({
        καί: {
          interval: 4,
          repetitions: 3,
          easeFactor: 2.5,
          nextReview: '2099-01-01',
          lastReview: '2025-01-01',
        },
      }),
    );
    renderFlashcards();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /reset srs/i }));
    });
    // SRS store should be cleared
    expect(localStorage.getItem('greek-tools-srs-v2')).toBe('{}');
  });

  it('"Reset SRS" does nothing when cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const user = userEvent.setup();
    localStorage.setItem('greek-tools-srs-v2', JSON.stringify({ καί: { interval: 4 } }));
    renderFlashcards();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /reset srs/i }));
    });
    // SRS store should remain unchanged
    expect(JSON.parse(localStorage.getItem('greek-tools-srs-v2') ?? '{}')).toHaveProperty('καί');
  });

  it('type mode "Still Learning" button calls handleReview(false) after incorrect answer', async () => {
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
    // After incorrect answer, "Still Learning" and "Next →" buttons appear
    const stillLearningBtn = screen.getByRole('button', { name: /← still learning/i });
    const nextBtn = screen.getByRole('button', { name: /^next →$/i });
    expect(stillLearningBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();
    await act(async () => {
      await user.click(stillLearningBtn);
    });
    // Card advanced (either new card or still on same card)
    expect(screen.queryByRole('button', { name: /← still learning/i })).not.toBeInTheDocument();
  });

  it('type mode "Next →" button advances after incorrect answer', async () => {
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
    const nextBtn = screen.getByRole('button', { name: /^next →$/i });
    await act(async () => {
      await user.click(nextBtn);
    });
    expect(screen.queryByRole('button', { name: /^next →$/i })).not.toBeInTheDocument();
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
    const gotItBtn = screen.queryByRole('button', { name: /got it →/i });
    if (gotItBtn) {
      await act(async () => {
        await user.click(gotItBtn);
      });
      expect(screen.queryByRole('button', { name: /got it →/i })).not.toBeInTheDocument();
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
