import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomDeckStore } from '../custom-decks';
import DeckBuilder, { type DeckBuilderProps, VISIBLE_WORDS } from './DeckBuilder';

const WORDS = [
  { key: 'k1', label: 'אָב', detail: 'father', search: 'father אב' },
  { key: 'k2', label: 'אֵם', detail: 'mother', search: 'mother אם' },
  { key: 'k3', label: 'בֵּן', detail: 'son', search: 'son בן' },
];

const store = createCustomDeckStore('builder-test');

function setup(over: Partial<DeckBuilderProps> = {}) {
  const props = {
    decks: store.load(),
    words: WORDS,
    store,
    activeDeckId: null,
    onActivateDeck: vi.fn(),
    onDecksChange: vi.fn(),
    onClose: vi.fn(),
    accent: '#15803D',
    ...over,
  };
  const view = render(<DeckBuilder {...props} />);
  return { props, user: userEvent.setup(), ...view };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('DeckBuilder', () => {
  it('explains an empty list and opens the editor', async () => {
    const { user } = setup();
    expect(screen.getByText(/No decks yet/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New deck' }));
    expect(screen.getByRole('region', { name: 'New deck' })).toBeTruthy();
  });

  it('creates a deck from the words picked', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: 'New deck' }));
    await user.type(screen.getByLabelText('Deck name'), 'Family');
    await user.click(screen.getByLabelText(/father/));
    await user.click(screen.getByLabelText(/son/));
    expect(screen.getByRole('status').textContent).toContain('2 selected');
    await user.click(screen.getByRole('button', { name: 'Create deck' }));

    expect(store.load()).toMatchObject([{ name: 'Family', wordKeys: ['k1', 'k3'] }]);
    expect(props.onDecksChange).toHaveBeenCalledWith(store.load());
    expect(screen.getByRole('region', { name: 'Custom decks' })).toBeTruthy();
  });

  it('refuses a missing name, a duplicate name and an empty deck', async () => {
    store.create('Taken', ['k1']);
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'New deck' }));
    await user.click(screen.getByRole('button', { name: 'Create deck' }));
    expect(screen.getByText('Deck name is required.')).toBeTruthy();

    await user.type(screen.getByLabelText('Deck name'), 'taken');
    await user.click(screen.getByRole('button', { name: 'Create deck' }));
    expect(screen.getByText('A deck with that name already exists.')).toBeTruthy();

    await user.clear(screen.getByLabelText('Deck name'));
    await user.type(screen.getByLabelText('Deck name'), 'Fresh');
    await user.click(screen.getByRole('button', { name: 'Create deck' }));
    expect(screen.getByText('Add at least one word to the deck.')).toBeTruthy();
    expect(store.load()).toHaveLength(1);
  });

  it('says so when storage cannot be written', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: 'New deck' }));
    await user.type(screen.getByLabelText('Deck name'), 'Family');
    await user.click(screen.getByLabelText(/father/));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await user.click(screen.getByRole('button', { name: 'Create deck' }));
    expect(screen.getByText(/Could not save the deck/)).toBeTruthy();
    expect(props.onDecksChange).not.toHaveBeenCalled();
  });

  it('narrows by search, adds every match, and clears', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'New deck' }));
    await user.type(screen.getByLabelText('Find words'), 'mother');
    expect(
      within(screen.getByRole('list', { name: 'Words' })).getAllByRole('listitem'),
    ).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Add all 1 match' }));
    expect(screen.getByRole('status').textContent).toContain('1 selected');
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByRole('status').textContent).toContain('0 selected');
    await user.clear(screen.getByLabelText('Find words'));
    await user.type(screen.getByLabelText('Find words'), 'zzz');
    expect(screen.getByText(/No words match/)).toBeTruthy();
  });

  it('draws only the first rows of a long list and says so', async () => {
    const many = Array.from({ length: VISIBLE_WORDS + 5 }, (_, i) => ({
      key: `w${i}`,
      label: `w${i}`,
      detail: '',
      search: `w${i}`,
    }));
    const { user } = setup({ words: many });
    await user.click(screen.getByRole('button', { name: 'New deck' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(VISIBLE_WORDS);
    expect(screen.getByText(/Showing the first 150 of 155/)).toBeTruthy();
  });

  it('edits a deck, with its words ticked and its own name allowed', async () => {
    const deck = store.create('Family', ['k1']);
    const { user, props } = setup({ decks: store.load() });
    await user.click(screen.getByRole('button', { name: 'Edit Family' }));
    expect((screen.getByLabelText(/father/) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByLabelText(/mother/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(store.load()[0]).toMatchObject({ id: deck.id, wordKeys: ['k1', 'k2'] });
    expect(props.onDecksChange).toHaveBeenCalled();
  });

  it('cancel and back return to the list without saving', async () => {
    store.create('Family', ['k1']);
    const { user } = setup({ decks: store.load() });
    await user.click(screen.getByRole('button', { name: 'Edit Family' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Edit Family' }));
    await user.click(screen.getByRole('button', { name: '← Back' }));
    expect(screen.getByRole('region', { name: 'Custom decks' })).toBeTruthy();
  });

  it('studies a deck: activates it and closes', async () => {
    const deck = store.create('Family', ['k1']);
    const { user, props } = setup({ decks: store.load() });
    await user.click(screen.getByRole('button', { name: 'Study Family' }));
    expect(props.onActivateDeck).toHaveBeenCalledWith(deck.id);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes from the list', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('deleting the active deck deselects it; declining deletes nothing', async () => {
    const deck = store.create('Family', ['k1']);
    const { user, props } = setup({ decks: store.load(), activeDeckId: deck.id });
    const confirm = vi.fn().mockReturnValueOnce(false);
    window.confirm = confirm;
    await user.click(screen.getByRole('button', { name: 'Delete Family' }));
    expect(store.load()).toHaveLength(1);

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole('button', { name: 'Delete Family' }));
    expect(store.load()).toHaveLength(0);
    expect(props.onDecksChange).toHaveBeenCalledWith([]);
    expect(props.onActivateDeck).toHaveBeenCalledWith(null);
  });

  it('deleting another deck leaves the active one alone', async () => {
    const keep = store.create('Keep', ['k1']);
    const drop = store.create('Drop', ['k2']);
    const { user, props } = setup({ decks: store.load(), activeDeckId: keep.id });
    window.confirm = vi.fn(() => true);
    await user.click(screen.getByRole('button', { name: `Delete ${drop.name}` }));
    expect(props.onActivateDeck).not.toHaveBeenCalled();
  });

  it('sets direction, language and font on the word column', async () => {
    const { user } = setup({ labelDir: 'rtl', labelLang: 'he', labelFontFamily: 'serif' });
    await user.click(screen.getByRole('button', { name: 'New deck' }));
    const label = screen.getByText('אָב');
    expect(label.getAttribute('dir')).toBe('rtl');
    expect(label.getAttribute('lang')).toBe('he');
  });

  it('pluralizes a one-word deck', () => {
    store.create('Solo', ['k1']);
    setup({ decks: store.load() });
    expect(screen.getByText('1 word')).toBeTruthy();
  });
});
