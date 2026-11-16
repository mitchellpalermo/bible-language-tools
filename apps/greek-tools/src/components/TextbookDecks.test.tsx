/**
 * The Textbook row with more than one book (#228).
 *
 * One pair of authors can have two textbooks, so a chip that named only the
 * authors could not tell them apart. The label is each book's `shortTitle`,
 * from its data entry. The books here are made up: this tests the row, not any
 * real book's title.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TextbookDecks from './TextbookDecks';

vi.mock('../data/textbooks', () => {
  const book = (id: string, title: string, shortTitle: string) => ({
    id,
    title,
    shortTitle,
    authors: 'A. Author and B. Writer',
    unitLabel: 'Ch.',
  });
  const sizes: Record<string, number> = { 'first-book': 30, 'second-book': 20 };
  return {
    TEXTBOOK_IDS: ['first-book', 'second-book'],
    TEXTBOOKS: {
      'first-book': book('first-book', 'A First Course in the Language', 'First Course'),
      'second-book': book('second-book', 'A Second Course in the Language', 'Second Course'),
    },
    chapterStats: (id: string) => [
      { chapter: 1, total: sizes[id] / 2, byCategory: { vocabulary: sizes[id] / 2 } },
      { chapter: 2, total: sizes[id] / 2, byCategory: { vocabulary: sizes[id] / 2 } },
    ],
    wordsInChapters: (id: string) => Array.from({ length: sizes[id] }),
  };
});

function renderRow(active: string | null = null) {
  const onTextbookChange = vi.fn();
  render(
    <TextbookDecks
      active={active as never}
      chapters={[]}
      onTextbookChange={onTextbookChange}
      onChaptersChange={vi.fn()}
      wordCount={20}
    />,
  );
  return { onTextbookChange, user: userEvent.setup() };
}

const chips = () => screen.getAllByRole('button', { pressed: false });

describe('two textbooks by the same authors', () => {
  it('draws one chip per book, each named by its own title', () => {
    renderRow();
    const names = chips().map((chip) => chip.textContent);
    expect(names).toEqual(['First Course(30)', 'Second Course(20)']);
    expect(new Set(names).size).toBe(2);
  });

  it('does not label a chip with the authors, which the two books share', () => {
    renderRow();
    for (const chip of chips()) {
      expect(chip).not.toHaveTextContent('Author');
      // The authors and the full title are still one hover or long-press away.
      expect(chip.getAttribute('title')).toContain('A. Author and B. Writer');
    }
    expect(chips()[0]).toHaveAttribute('title', expect.stringContaining('A First Course'));
    expect(chips()[1]).toHaveAttribute('title', expect.stringContaining('A Second Course'));
  });

  it('reports the book that was tapped', async () => {
    const { onTextbookChange, user } = renderRow();
    await user.click(screen.getByRole('button', { name: /^Second Course/ }));
    expect(onTextbookChange).toHaveBeenCalledWith('second-book');
  });

  it('heads the picker with the active book’s title, and marks only that chip', () => {
    renderRow('second-book');
    expect(screen.getByRole('button', { name: /^Second Course\s*\(/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^First Course/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const summary = screen.getByRole('button', { expanded: false });
    expect(summary).toHaveTextContent('Second Course');
    expect(summary).not.toHaveTextContent('First Course');
  });

  it('names the full title and the authors once the picker is open', async () => {
    const { user } = renderRow('second-book');
    await user.click(screen.getByRole('button', { expanded: false }));
    expect(
      screen.getByText(/A Second Course in the Language · A\. Author and B\. Writer/),
    ).toBeInTheDocument();
  });
});
