import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { focusPassageStore } from '../lib/focus-passages';
import { GENESIS_1_1_3, stubCorpus } from '../test/passage-fixtures';
import FocusPassages from './FocusPassages';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  stubCorpus();
  window.history.replaceState(null, '', '/focus');
});

describe('the list', () => {
  it('explains an empty list once storage has been read', async () => {
    render(<FocusPassages />);
    expect(await screen.findByText(/No focus passages yet/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your focus passages' })).not.toBeInTheDocument();
  });

  it('lists each passage as a link, by its name and with its reference beneath', async () => {
    const named = focusPassageStore.create(GENESIS_1_1_3, 'Creation');
    const bare = focusPassageStore.create({ ...GENESIS_1_1_3, endChapter: 2, endVerse: 1 });
    render(<FocusPassages />);

    const list = await screen.findByRole('list', { name: 'Your focus passages' });
    const [first, second] = within(list).getAllByRole('link');
    expect(first).toHaveAttribute('href', `/focus/${named.id}`);
    expect(first).toHaveTextContent('Creation');
    await waitFor(() => expect(first).toHaveTextContent('Genesis 1:1–3'));
    // No name: the reference is the title, and is not said twice.
    expect(second).toHaveAttribute('href', `/focus/${bare.id}`);
    expect(second.textContent).toBe('Genesis 1:1–2:1');
  });

  it('leaves a deleted passage out', async () => {
    const gone = focusPassageStore.create(GENESIS_1_1_3, 'Gone');
    focusPassageStore.create(GENESIS_1_1_3, 'Kept');
    focusPassageStore.remove(gone.id);
    render(<FocusPassages />);
    const list = await screen.findByRole('list', { name: 'Your focus passages' });
    expect(within(list).getAllByRole('link')).toHaveLength(1);
    expect(list).not.toHaveTextContent('Gone');
  });

  it('falls back to the book code when the book list will not load', async () => {
    stubCorpus({ failAll: true });
    focusPassageStore.create(GENESIS_1_1_3);
    render(<FocusPassages />);
    expect(await screen.findByRole('link')).toHaveTextContent('GEN 1:1–3');
  });
});

describe('making a passage', () => {
  async function open() {
    const user = userEvent.setup();
    render(<FocusPassages />);
    await user.click(await screen.findByRole('button', { name: 'New focus passage' }));
    return user;
  }

  it('previews the passage’s real size and how much of it the course covers', async () => {
    await open();
    const preview = screen.getByTestId('passage-preview');
    // Genesis 1:1-5 of the fixture is verses 1-3: 11 words; 430, 776, 1961, 559 and 8064 are course words.
    await waitFor(() => expect(preview).toHaveTextContent(/11 words, 5 of them in the course/));
    expect(preview).toHaveTextContent('Genesis 1:1–5');
  });

  it('saves the passage, with its name, and opens it', async () => {
    const user = await open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save passage' })).toBeEnabled());
    await user.type(screen.getByLabelText(/Name/), 'Creation');
    await user.click(screen.getByRole('button', { name: 'Save passage' }));

    const [saved] = focusPassageStore.load();
    expect(saved).toMatchObject({ book: 'GEN', startChapter: 1, startVerse: 1, label: 'Creation' });
    expect(window.location.href).toContain(`/focus/${saved.id}`);
  });

  it('saves on Enter in the name field', async () => {
    const user = await open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save passage' })).toBeEnabled());
    await user.type(screen.getByLabelText(/Name/), 'Quick{Enter}');
    expect(focusPassageStore.load()[0].label).toBe('Quick');
  });

  it('waits for the text before it lets the passage be saved', async () => {
    stubCorpus({ failAll: true });
    await open();
    expect(await screen.findByRole('alert')).toHaveTextContent(/did not load/);
    expect(screen.getByRole('button', { name: 'Save passage' })).toBeDisabled();
  });

  it('still previews when only the lemma index is missing', async () => {
    stubCorpus({ failLemmas: true });
    await open();
    // Without the index the course word with no Strong number (earth) is not found.
    await waitFor(() =>
      expect(screen.getByTestId('passage-preview')).toHaveTextContent(/11 words, 4 of them/),
    );
  });

  it('offers only a range that can be saved, changing with the menus', async () => {
    const user = await open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save passage' })).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('End chapter'), '2');
    await waitFor(() =>
      expect(screen.getByTestId('passage-preview')).toHaveTextContent('Genesis 1:1–2:1'),
    );
    // Ending in chapter 2 ends at its last verse, and the start cannot pass it.
    expect(screen.getByLabelText('End verse')).toHaveValue('1');
  });

  it('reports a failed save instead of looking saved', async () => {
    const user = await open();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save passage' })).toBeEnabled());
    const full = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('This browser is out of storage.');
    });
    await user.click(screen.getByRole('button', { name: 'Save passage' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('out of storage');
    full.mockRestore();
    expect(focusPassageStore.load()).toEqual([]);
  });

  it('cancels back to the list', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'New focus passage' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'New focus passage' })).not.toBeInTheDocument();
  });

  it('keeps the name to the limit', async () => {
    await open();
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('maxLength', '100');
  });
});
