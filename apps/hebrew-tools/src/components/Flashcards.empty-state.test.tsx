// The "no cards match the current filter" state can only be reached when a
// frequency band is empty. Asserting that against the real vocabulary means
// betting that some band stays empty forever, which broke the first time a
// chapter list added words under 100 occurrences. This file stubs the
// vocabulary module instead, so the branch is exercised deterministically.
//
// vi.mock is hoisted and applies to the whole file, which is why this lives
// apart from Flashcards.test.tsx.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vocabulary as stubVocabulary } from '../data/vocabulary';
import Flashcards from './Flashcards';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

// Two high-frequency words and no chapter tags: the "<100" band matches nothing
// and no chapter picker is rendered. The stub is built inside the factory
// because vi.mock is hoisted above any top-level declaration in this file.
//
// `cardKey` is re-exported by the vocabulary module and used by the component to
// key the SRS store, so the stub has to provide it too — a partial mock would
// leave the component calling undefined.
vi.mock('../data/vocabulary', () => ({
  cardKey: (word: { hebrew: string; sense?: string }) =>
    word.sense ? `${word.hebrew}#${word.sense}` : word.hebrew,
  vocabulary: [
    {
      hebrew: 'דָּבָר',
      transliteration: 'dābār',
      gloss: 'word, thing',
      frequency: 1400,
      partOfSpeech: 'noun',
    },
    {
      hebrew: 'מֶלֶךְ',
      transliteration: 'melek',
      gloss: 'king',
      frequency: 2600,
      partOfSpeech: 'noun',
    },
  ],
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Flashcards empty filter state', () => {
  it('shows an empty state when a frequency band matches no cards', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(screen.getByRole('button', { name: 'Study All' }));

    await user.click(screen.getByRole('button', { name: /^<100/ }));
    expect(screen.getByText(/no cards match the current filter/i)).toBeInTheDocument();
  });

  it('recovers from the empty state via "Clear filter"', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(screen.getByRole('button', { name: 'Study All' }));

    await user.click(screen.getByRole('button', { name: /^<100/ }));
    await user.click(screen.getByRole('button', { name: /clear filter/i }));
    expect(screen.queryByText(/no cards match the current filter/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('card-progress').textContent).toBe(`1/${stubVocabulary.length}`);
  });

  it('renders no chapter deck chips when no word carries a chapter tag', () => {
    render(<Flashcards />);
    expect(screen.getByRole('button', { name: /^All vocabulary/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ch\. \d/ })).not.toBeInTheDocument();
  });
});
