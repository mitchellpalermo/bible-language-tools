import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PassageRange } from '../focus-passages';
import PassagePicker, { editRange } from './PassagePicker';

const BOOKS = [
  { code: 'GEN', name: 'Genesis', chapters: 50 },
  { code: 'EXO', name: 'Exodus', chapters: 40 },
];
const COUNTS = { 1: 31, 2: 25, 3: 24 };
const GEN_1_1_5: PassageRange = {
  book: 'GEN',
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 5,
};

describe('editRange', () => {
  it('starts a new book at its first verse', () => {
    expect(editRange(GEN_1_1_5, { field: 'book', value: 'EXO' }, COUNTS)).toEqual({
      book: 'EXO',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 1,
    });
  });

  it('drags the end along when the start chapter passes it, to that chapter’s last verse', () => {
    expect(editRange(GEN_1_1_5, { field: 'startChapter', value: 2 }, COUNTS)).toMatchObject({
      startChapter: 2,
      startVerse: 1,
      endChapter: 2,
      endVerse: 25,
    });
  });

  it('leaves the end alone when the start chapter stays at or before it', () => {
    const range = { ...GEN_1_1_5, endChapter: 3, endVerse: 4 };
    expect(editRange(range, { field: 'startChapter', value: 2 }, COUNTS)).toMatchObject({
      endChapter: 3,
      endVerse: 4,
    });
  });

  it('falls back to verse 1 for a chapter whose size is not known yet', () => {
    expect(editRange(GEN_1_1_5, { field: 'startChapter', value: 2 }, null).endVerse).toBe(1);
  });

  it('pushes the end verse out when the start verse passes it, in one chapter only', () => {
    expect(editRange(GEN_1_1_5, { field: 'startVerse', value: 9 }, COUNTS).endVerse).toBe(9);
    const across = { ...GEN_1_1_5, endChapter: 2, endVerse: 3 };
    expect(editRange(across, { field: 'startVerse', value: 9 }, COUNTS).endVerse).toBe(3);
  });

  it('ends a new end chapter at its last verse, and takes a chosen end verse as given', () => {
    expect(editRange(GEN_1_1_5, { field: 'endChapter', value: 3 }, COUNTS)).toMatchObject({
      endChapter: 3,
      endVerse: 24,
    });
    expect(editRange(GEN_1_1_5, { field: 'endVerse', value: 7 }, COUNTS).endVerse).toBe(7);
  });
});

describe('PassagePicker', () => {
  function setup(value = GEN_1_1_5, verseCounts: Record<number, number> | null = COUNTS) {
    const onChange = vi.fn();
    render(
      <PassagePicker books={BOOKS} value={value} onChange={onChange} verseCounts={verseCounts} />,
    );
    return { onChange, user: userEvent.setup() };
  }

  const options = (name: string) =>
    Array.from((screen.getByLabelText(name) as HTMLSelectElement).options).map((o) => o.value);

  it('lists the books and shows the chosen range', () => {
    setup();
    expect(options('Book')).toEqual(['GEN', 'EXO']);
    expect((screen.getByLabelText('Book') as HTMLSelectElement).value).toBe('GEN');
    expect((screen.getByLabelText('End verse') as HTMLSelectElement).value).toBe('5');
  });

  it('offers only the chapters and verses the book has', () => {
    setup();
    expect(options('Start chapter')).toHaveLength(50);
    expect(options('Start verse')).toHaveLength(31);
  });

  it('does not offer an end verse before the start verse', () => {
    setup({ ...GEN_1_1_5, startVerse: 4 });
    expect(options('End verse')[0]).toBe('4');
  });

  it('does not offer an end chapter before the start chapter', () => {
    setup({ ...GEN_1_1_5, startChapter: 3, endChapter: 3 });
    expect(options('End chapter')[0]).toBe('3');
  });

  it('shows a single verse while a book’s size is still loading, without dropping the value', () => {
    setup(GEN_1_1_5, null);
    expect(options('Start verse')).toEqual(['1']);
    expect(options('End verse')).toEqual(['1', '2', '3', '4', '5']);
  });

  it('reports each menu change as a whole range', async () => {
    const { onChange, user } = setup();
    await user.selectOptions(screen.getByLabelText('End verse'), '9');
    expect(onChange).toHaveBeenLastCalledWith({ ...GEN_1_1_5, endVerse: 9 });
    await user.selectOptions(screen.getByLabelText('Book'), 'EXO');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ book: 'EXO', endVerse: 1 }),
    );
  });
});
