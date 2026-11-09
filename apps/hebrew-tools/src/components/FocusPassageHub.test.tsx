import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { READER_PREFS_KEY } from '../data/morphhb';
import { loadSRSStore, newCard, nextSRS, saveSRSStore } from '../data/srs';
import { customDeckStore } from '../lib/custom-decks';
import { loadSelection } from '../lib/deck-selection';
import { focusPassageStore } from '../lib/focus-passages';
import { GENESIS_1_1_3, stubCorpus } from '../test/passage-fixtures';
import FocusPassageHub from './FocusPassageHub';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

function makePassage(label?: string) {
  return focusPassageStore.create(GENESIS_1_1_3, label);
}

async function renderHub(id: string, search = '') {
  window.history.replaceState(null, '', `/focus/${id}${search}`);
  render(<FocusPassageHub passageId={id} />);
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  stubCorpus();
});

describe('a passage that is not there', () => {
  it('says so and links back, for an unknown id', async () => {
    await renderHub('nope');
    expect(await screen.findByText(/not here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to focus passages' })).toHaveAttribute(
      'href',
      '/focus',
    );
  });

  it('says so for a passage deleted on another device', async () => {
    const passage = makePassage();
    focusPassageStore.remove(passage.id);
    await renderHub(passage.id);
    expect(await screen.findByText(/not here/)).toBeInTheDocument();
  });
});

describe('the header', () => {
  it('titles the passage by its name, with the reference beneath', async () => {
    const passage = makePassage('Creation');
    await renderHub(passage.id);
    expect(await screen.findByRole('heading', { name: 'Creation' })).toBeInTheDocument();
    await screen.findByText('Genesis 1:1–3');
  });

  it('titles an unnamed passage by its reference', async () => {
    const passage = makePassage();
    await renderHub(passage.id);
    expect(await screen.findByRole('heading', { name: 'Genesis 1:1–3' })).toBeInTheDocument();
  });

  it('renames, and clears the name with an empty one', async () => {
    const passage = makePassage('Creation');
    const user = userEvent.setup();
    await renderHub(passage.id);
    await user.click(await screen.findByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Passage name');
    await user.clear(input);
    await user.type(input, 'Day one{Enter}');
    expect(await screen.findByRole('heading', { name: 'Day one' })).toBeInTheDocument();
    expect(focusPassageStore.get(passage.id)?.label).toBe('Day one');

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    await user.clear(screen.getByLabelText('Passage name'));
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByRole('heading', { name: 'Genesis 1:1–3' })).toBeInTheDocument();
    expect(focusPassageStore.get(passage.id)?.label).toBeUndefined();
  });

  it('leaves the name alone on Escape', async () => {
    const passage = makePassage('Creation');
    const user = userEvent.setup();
    await renderHub(passage.id);
    await user.click(await screen.findByRole('button', { name: 'Rename' }));
    await user.type(screen.getByLabelText('Passage name'), 'xyz{Escape}');
    expect(screen.getByRole('heading', { name: 'Creation' })).toBeInTheDocument();
    expect(focusPassageStore.get(passage.id)?.label).toBe('Creation');
  });

  it('deletes after a confirmation, as a tombstone, and goes back to the list', async () => {
    const passage = makePassage('Creation');
    const confirm = vi.fn(() => true);
    window.confirm = confirm;
    const user = userEvent.setup();
    await renderHub(passage.id);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Creation'));
    expect(focusPassageStore.load()).toEqual([]);
    expect(focusPassageStore.loadAll()[0].deletedAt).toBeDefined();
    expect(window.location.href).toContain('/focus');
  });

  it('keeps the passage when the confirmation is declined', async () => {
    const passage = makePassage('Creation');
    window.confirm = vi.fn(() => false);
    const user = userEvent.setup();
    await renderHub(passage.id);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(focusPassageStore.load()).toHaveLength(1);
  });
});

describe('the tabs', () => {
  it('opens on Reading, and puts the chosen tab in the address so it survives a reload', async () => {
    const passage = makePassage();
    const user = userEvent.setup();
    await renderHub(passage.id);
    const reading = await screen.findByRole('tab', { name: 'Reading' });
    expect(reading).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Vocabulary' }));
    expect(screen.getByRole('tab', { name: 'Vocabulary' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(window.location.search).toBe('?tab=vocabulary');
  });

  it('opens on the tab the address names, and on Reading for one it does not', async () => {
    const passage = makePassage();
    await renderHub(passage.id, '?tab=progress');
    expect(await screen.findByRole('tab', { name: 'Progress' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('falls back to Reading for an unknown tab', async () => {
    const passage = makePassage();
    await renderHub(passage.id, '?tab=parsing');
    expect(await screen.findByRole('tab', { name: 'Reading' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('Reading', () => {
  it('shows exactly the passage’s verses, in Hebrew, right to left', async () => {
    const passage = makePassage();
    await renderHub(passage.id);
    const text = await screen.findByTestId('passage-text');
    expect(text).toHaveAttribute('dir', 'rtl');
    expect(text).toHaveAttribute('lang', 'he');
    expect(text).toHaveTextContent('בָּרָ֣א');
    expect(text).toHaveTextContent('וַיֹּ֥אמֶר');
    // Chapter 2 is outside the passage.
    expect(text).not.toHaveTextContent('וַיְכֻלּ֛וּ');
  });

  it('numbers the first verse with its chapter and the rest by verse', async () => {
    const passage = focusPassageStore.create({ ...GENESIS_1_1_3, endChapter: 2, endVerse: 1 });
    await renderHub(passage.id);
    const text = await screen.findByTestId('passage-text');
    const numbers = [...text.querySelectorAll('sup')].map((s) => s.textContent);
    expect(numbers).toEqual(['1:1', '2', '3', '2:1']);
  });

  it('links into the reader at the passage’s first verse', async () => {
    const passage = focusPassageStore.create({ ...GENESIS_1_1_3, startVerse: 2 });
    await renderHub(passage.id);
    expect(await screen.findByRole('link', { name: 'Open in the reader' })).toHaveAttribute(
      'href',
      '/reader?ref=GEN.1.2',
    );
  });

  it('reads the reader’s own display settings', async () => {
    localStorage.setItem(
      READER_PREFS_KEY,
      JSON.stringify({ cantillation: false, studied: true, glosses: false }),
    );
    const passage = makePassage();
    await renderHub(passage.id);
    // Without the te'amim the sof pasuq's neighbours lose their accents: אֱלֹהִים, not אֱלֹהִ֑ים.
    const text = await screen.findByTestId('passage-text');
    await waitFor(() => expect(text).toHaveTextContent('אֱלֹהִים'));
  });

  it('opens a word’s popup, and a second tap closes it', async () => {
    const passage = makePassage();
    const user = userEvent.setup();
    await renderHub(passage.id);
    const text = await screen.findByTestId('passage-text');
    const word = within(text).getAllByText('אֱלֹהִ֑ים')[0];
    await user.click(word);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(word);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Vocabulary', () => {
  async function openVocabulary() {
    const passage = makePassage('Creation');
    const user = userEvent.setup();
    await renderHub(passage.id, '?tab=vocabulary');
    await screen.findByRole('heading', { name: /course words?$/ });
    return { passage, user };
  }

  it('lists the course words the passage uses, commonest first, with their counts', async () => {
    await openVocabulary();
    expect(screen.getByRole('heading', { name: '5 course words' })).toBeInTheDocument();
    const rows = within(screen.getAllByRole('list')[0]).getAllByRole('listitem');
    // God is twice (verses 1 and 2), earth twice, then the single uses.
    expect(rows[0]).toHaveTextContent('אֱלֹהִים');
    expect(rows[0]).toHaveTextContent('2×');
    expect(rows[1]).toHaveTextContent('אֶרֶץ');
  });

  it('marks each word new until it has been reviewed, then by its interval', async () => {
    const key = 'אֱלֹהִים';
    saveSRSStore({ [key]: { ...nextSRS(newCard(key), 4), interval: 30 } });
    await openVocabulary();
    const rows = within(screen.getAllByRole('list')[0]).getAllByRole('listitem');
    await waitFor(() => expect(rows[0]).toHaveTextContent('Mature'));
    expect(rows[1]).toHaveTextContent('New');
  });

  it('lists the words the course has not reached, glossed, and says why they have no card', async () => {
    await openVocabulary();
    expect(
      screen.getByRole('heading', { name: /words? the course has not reached/ }),
    ).toBeInTheDocument();
    const outside = screen.getAllByRole('list')[1];
    // The direct-object marker is the commonest of them, twice.
    expect(within(outside).getAllByRole('listitem')[0]).toHaveTextContent('אֵת');
    expect(outside).toHaveTextContent('beginning');
    expect(screen.getByText(/no flashcard to review/)).toBeInTheDocument();
  });

  it('turns the words into a deck and opens the flashcards on it', async () => {
    const { user } = await openVocabulary();
    await user.click(screen.getByRole('button', { name: 'Study these words' }));

    const [deck] = customDeckStore.load();
    expect(deck.name).toBe('Passage: Creation');
    expect(deck.wordKeys).toHaveLength(5);
    expect(deck.wordKeys).toContain('אֱלֹהִים');
    expect(loadSelection()).toMatchObject({ deck: 'custom', customDeckId: deck.id });
    expect(window.location.href).toContain('/flashcards');
  });

  it('says so when the storage cannot take the deck, and changes nothing', async () => {
    const { user } = await openVocabulary();
    const full = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    await user.click(screen.getByRole('button', { name: 'Study these words' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be saved/);
    full.mockRestore();
    expect(customDeckStore.load()).toEqual([]);
  });

  it('says so when none of the words are in the course, and offers no deck', async () => {
    const passage = focusPassageStore.create({
      ...GENESIS_1_1_3,
      startChapter: 3,
      endChapter: 3,
      startVerse: 1,
      endVerse: 1,
    });
    await renderHub(passage.id, '?tab=vocabulary');
    expect(await screen.findByText(/None of this passage’s words/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Study these words' })).toBeDisabled();
  });
});

describe('Progress', () => {
  async function openProgress() {
    const passage = makePassage('Creation');
    await renderHub(passage.id, '?tab=progress');
    await screen.findByRole('progressbar');
  }

  it('starts at nothing known, with every word not started', async () => {
    await openProgress();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(
      screen.getByText('Nothing from this passage is due for review right now.'),
    ).toBeInTheDocument();
    const notStarted = screen.getByText('Not started').closest('div') as HTMLElement;
    expect(notStarted).toHaveTextContent('5');
  });

  it('moves with the reviews: known words weigh by how often the passage uses them', async () => {
    const key = 'אֱלֹהִים';
    saveSRSStore({ [key]: { ...nextSRS(newCard(key), 4), dueDate: '2000-01-01' } });
    await openProgress();
    // God is 2 of the 11 words of verses 1-3.
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '18');
    expect(screen.getByText('1 word is due for review.')).toBeInTheDocument();
    expect(screen.getByText('Learning').closest('div')).toHaveTextContent('1');
  });

  it('reads the store each time and never writes to it', async () => {
    saveSRSStore({});
    await openProgress();
    expect(loadSRSStore()).toEqual({});
  });

  it('opens the flashcards on the passage’s deck', async () => {
    await openProgress();
    await userEvent.click(screen.getByRole('button', { name: 'Study this passage' }));
    expect(customDeckStore.load()[0].name).toBe('Passage: Creation');
    expect(window.location.href).toContain('/flashcards');
  });

  it('says parsing is not here yet', async () => {
    await openProgress();
    expect(screen.getByText(/Parsing drills for a passage are not here yet/)).toBeInTheDocument();
  });
});

describe('when the text will not load', () => {
  it('says so, and still shows who the passage is', async () => {
    stubCorpus({ failAll: true });
    const passage = makePassage('Creation');
    await renderHub(passage.id);
    expect(await screen.findByRole('alert')).toHaveTextContent(/did not load/);
    expect(screen.getByRole('heading', { name: 'Creation' })).toBeInTheDocument();
  });

  it('shows the passage with the vocabulary the course alone can name when only the lemma index fails', async () => {
    stubCorpus({ failLemmas: true });
    const passage = makePassage('Creation');
    await renderHub(passage.id, '?tab=vocabulary');
    await screen.findByRole('heading', { name: '4 course words' });
  });
});
