/**
 * Tests for src/components/DeckBuilder.tsx
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomDeck } from '../data/customDecks';
import DeckBuilder from './DeckBuilder';

// ─── Mocks ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDeck(overrides: Partial<CustomDeck> = {}): CustomDeck {
  return {
    id: 'deck-1',
    name: 'Week 1',
    wordKeys: ['καί', 'ὁ'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderBuilder(props: Partial<Parameters<typeof DeckBuilder>[0]> = {}) {
  const defaults = {
    decks: [] as CustomDeck[],
    activeDeckId: null as string | null,
    onActivateDeck: vi.fn(),
    onDecksChange: vi.fn(),
    onClose: vi.fn(),
  };
  return render(<DeckBuilder {...defaults} {...props} />);
}

// ─── List view ────────────────────────────────────────────────────────────────

describe('List view', () => {
  it('shows empty state message when no decks exist', () => {
    renderBuilder({ decks: [] });
    expect(screen.getByText(/no custom decks yet/i)).toBeInTheDocument();
  });

  it('shows the deck name', () => {
    renderBuilder({ decks: [makeDeck()] });
    expect(screen.getByText('Week 1')).toBeInTheDocument();
  });

  it('shows word count for a deck', () => {
    renderBuilder({ decks: [makeDeck({ wordKeys: ['καί', 'ὁ', 'εἰμί'] })] });
    expect(screen.getByText(/3 words/i)).toBeInTheDocument();
  });

  it('shows "1 word" (singular) for a single-word deck', () => {
    renderBuilder({ decks: [makeDeck({ wordKeys: ['καί'] })] });
    expect(screen.getByText(/1 word$/i)).toBeInTheDocument();
  });

  it('renders Study, Edit, and Delete buttons for each deck', () => {
    renderBuilder({ decks: [makeDeck()] });
    expect(screen.getByRole('button', { name: /study/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit deck week 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete deck week 1/i })).toBeInTheDocument();
  });

  it('renders the "+ New Deck" button', () => {
    renderBuilder();
    expect(screen.getByRole('button', { name: /\+ new deck/i })).toBeInTheDocument();
  });

  it('renders multiple decks', () => {
    const decks = [
      makeDeck({ id: '1', name: 'Deck A' }),
      makeDeck({ id: '2', name: 'Deck B', wordKeys: ['εἰμί'] }),
    ];
    renderBuilder({ decks });
    expect(screen.getByText('Deck A')).toBeInTheDocument();
    expect(screen.getByText('Deck B')).toBeInTheDocument();
  });
});

// ─── Study button ─────────────────────────────────────────────────────────────

describe('Study button', () => {
  it('calls onActivateDeck with deck id', async () => {
    const user = userEvent.setup();
    const onActivateDeck = vi.fn();
    renderBuilder({ decks: [makeDeck()], onActivateDeck });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /study/i }));
    });
    expect(onActivateDeck).toHaveBeenCalledWith('deck-1');
  });

  it('calls onClose after activating', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderBuilder({ decks: [makeDeck()], onClose });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /study/i }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── Delete button ────────────────────────────────────────────────────────────

describe('Delete button', () => {
  it('calls onDecksChange with the deck removed after confirmation', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const onDecksChange = vi.fn();
    const deck = makeDeck();
    // Seed localStorage so deleteCustomDeck can read it
    localStorage.setItem('greek-tools-custom-decks-v1', JSON.stringify([deck]));
    renderBuilder({ decks: [deck], onDecksChange });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /delete deck week 1/i }));
    });
    expect(onDecksChange).toHaveBeenCalledWith([]);
  });

  it('does not call onDecksChange when confirm is cancelled', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const onDecksChange = vi.fn();
    renderBuilder({ decks: [makeDeck()], onDecksChange });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /delete deck week 1/i }));
    });
    expect(onDecksChange).not.toHaveBeenCalled();
  });

  it('calls onActivateDeck(null) when the active deck is deleted', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const onActivateDeck = vi.fn();
    const deck = makeDeck();
    localStorage.setItem('greek-tools-custom-decks-v1', JSON.stringify([deck]));
    renderBuilder({ decks: [deck], activeDeckId: deck.id, onActivateDeck });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /delete deck week 1/i }));
    });
    expect(onActivateDeck).toHaveBeenCalledWith(null);
  });

  it('does not call onActivateDeck(null) when a non-active deck is deleted', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const onActivateDeck = vi.fn();
    const deck = makeDeck();
    localStorage.setItem('greek-tools-custom-decks-v1', JSON.stringify([deck]));
    renderBuilder({ decks: [deck], activeDeckId: 'other-id', onActivateDeck });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /delete deck week 1/i }));
    });
    expect(onActivateDeck).not.toHaveBeenCalled();
  });
});

// ─── Close button ─────────────────────────────────────────────────────────────

describe('Close button', () => {
  it('calls onClose when × is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderBuilder({ onClose });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /close deck builder/i }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── New Deck flow ────────────────────────────────────────────────────────────

describe('Creating a new deck', () => {
  it('transitions to edit view when "+ New Deck" is clicked', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+ new deck/i }));
    });
    expect(screen.getByText(/new deck/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /deck name/i })).toBeInTheDocument();
  });

  it('shows "Back" button in edit view', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+ new deck/i }));
    });
    expect(screen.getByRole('button', { name: /back to deck list/i })).toBeInTheDocument();
  });

  it('cancel returns to list view without calling onDecksChange', async () => {
    const user = userEvent.setup();
    const onDecksChange = vi.fn();
    renderBuilder({ onDecksChange });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+ new deck/i }));
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cancel/i }));
    });
    expect(onDecksChange).not.toHaveBeenCalled();
    // Back in list view
    expect(screen.getByRole('button', { name: /\+ new deck/i })).toBeInTheDocument();
  });

  it('calls onDecksChange after saving a valid new deck', async () => {
    const user = userEvent.setup();
    const onDecksChange = vi.fn();
    renderBuilder({ onDecksChange });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+ new deck/i }));
    });

    // Fill in deck name
    await act(async () => {
      await user.type(screen.getByRole('textbox', { name: /deck name/i }), 'My Test Deck');
    });

    // Select a word via checkbox (first word in the list)
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[0]);
    });

    // Save
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /create deck/i }));
    });

    expect(onDecksChange).toHaveBeenCalled();
    const updatedDecks = onDecksChange.mock.calls[0][0] as CustomDeck[];
    expect(updatedDecks.some((d) => d.name === 'My Test Deck')).toBe(true);
  });

  it('returns to list view after saving', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+ new deck/i }));
    });
    await act(async () => {
      await user.type(screen.getByRole('textbox', { name: /deck name/i }), 'Deck X');
    });
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[0]);
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /create deck/i }));
    });
    // Back in list view
    expect(screen.getByRole('button', { name: /\+ new deck/i })).toBeInTheDocument();
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe('Validation', () => {
  async function goToEdit(user: ReturnType<typeof userEvent.setup>) {
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+ new deck/i }));
    });
  }

  it('shows error when name is empty', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /create deck/i }));
    });
    expect(screen.getByText(/deck name is required/i)).toBeInTheDocument();
  });

  it('shows error when no words are selected', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);
    await act(async () => {
      await user.type(screen.getByRole('textbox', { name: /deck name/i }), 'Valid Name');
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /create deck/i }));
    });
    expect(screen.getByText(/add at least one word/i)).toBeInTheDocument();
  });

  it('shows error for duplicate name', async () => {
    const user = userEvent.setup();
    const existingDeck = makeDeck({ name: 'Existing' });
    renderBuilder({ decks: [existingDeck] });
    await goToEdit(user);
    await act(async () => {
      await user.type(screen.getByRole('textbox', { name: /deck name/i }), 'Existing');
    });
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[0]);
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /create deck/i }));
    });
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });
});

// ─── Edit flow ────────────────────────────────────────────────────────────────

describe('Editing a deck', () => {
  it('pre-populates the name field with the deck name', async () => {
    const user = userEvent.setup();
    renderBuilder({ decks: [makeDeck()] });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /edit deck week 1/i }));
    });
    expect(screen.getByRole('textbox', { name: /deck name/i })).toHaveValue('Week 1');
  });

  it('shows "Save Changes" button instead of "Create Deck"', async () => {
    const user = userEvent.setup();
    renderBuilder({ decks: [makeDeck()] });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /edit deck week 1/i }));
    });
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('cancel returns to list without calling onDecksChange', async () => {
    const user = userEvent.setup();
    const onDecksChange = vi.fn();
    renderBuilder({ decks: [makeDeck()], onDecksChange });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /edit deck week 1/i }));
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cancel/i }));
    });
    expect(onDecksChange).not.toHaveBeenCalled();
  });

  it('allows duplicate name check to exclude the deck being edited', async () => {
    const user = userEvent.setup();
    const deck = makeDeck({ name: 'Week 1' });
    localStorage.setItem('greek-tools-custom-decks-v1', JSON.stringify([deck]));
    const onDecksChange = vi.fn();
    renderBuilder({ decks: [deck], onDecksChange });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /edit deck week 1/i }));
    });
    // Keep same name, just toggle a checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    // Check the first unchecked one
    const firstUnchecked = checkboxes.find((c) => !(c as HTMLInputElement).checked);
    if (firstUnchecked) {
      await act(async () => {
        await user.click(firstUnchecked);
      });
    }
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /save changes/i }));
    });
    // Should save without duplicate name error
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
  });
});

// ─── Word picker ──────────────────────────────────────────────────────────────

describe('Word picker', () => {
  async function goToEdit(user: ReturnType<typeof userEvent.setup>) {
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /\+ new deck/i }));
    });
  }

  it('renders a search input', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);
    expect(screen.getByRole('textbox', { name: /search vocabulary/i })).toBeInTheDocument();
  });

  it('shows "Select all matching" and "Clear selection" buttons', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);
    expect(screen.getByRole('button', { name: /select all matching/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear selection/i })).toBeInTheDocument();
  });

  it('updates the word count footer when a checkbox is toggled', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);
    expect(screen.getByRole('status')).toHaveTextContent('0 words selected');
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[0]);
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 word selected');
  });

  it('"Clear selection" resets the count to 0', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      await user.click(checkboxes[0]);
    });
    await act(async () => {
      await user.click(checkboxes[1]);
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /clear selection/i }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('0 words selected');
  });

  it('"Select all matching" selects all visible words', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);

    // Search for something specific to get a small, known result set
    await act(async () => {
      await user.type(screen.getByRole('textbox', { name: /search vocabulary/i }), 'καί');
    });
    const matchCount = screen.getAllByRole('checkbox').length;
    expect(matchCount).toBeGreaterThan(0);
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /select all matching/i }));
    });
    // After bulk-add, the count should reflect how many words are in the filtered set
    const status = screen.getByRole('status');
    const match = status.textContent?.match(/(\d+) word/i);
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(matchCount);
  });

  it('filters vocabulary by search term (Greek)', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);
    const initial = screen.getAllByRole('checkbox').length;
    await act(async () => {
      await user.type(screen.getByRole('textbox', { name: /search vocabulary/i }), 'λόγ');
    });
    const afterSearch = screen.getAllByRole('checkbox').length;
    expect(afterSearch).toBeLessThan(initial);
  });

  it('filters vocabulary by search term (English gloss)', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);
    await act(async () => {
      await user.type(screen.getByRole('textbox', { name: /search vocabulary/i }), 'lord');
    });
    // Should show at least one result (κύριος → lord)
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  it('shows "No words match" message when search has no results', async () => {
    const user = userEvent.setup();
    renderBuilder();
    await goToEdit(user);
    await act(async () => {
      await user.type(
        screen.getByRole('textbox', { name: /search vocabulary/i }),
        'zzzzzzzznotaword',
      );
    });
    expect(screen.getByText(/no words match/i)).toBeInTheDocument();
  });
});
