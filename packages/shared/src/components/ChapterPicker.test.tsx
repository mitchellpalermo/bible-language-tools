import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Textbook } from '../textbooks';
import ChapterPicker, { chipColors, faint } from './ChapterPicker';

const ACCENT = 'var(--color-grape, #7C3AED)';

const BOOK: Textbook = {
  id: 'primer',
  title: 'A Primer',
  authors: 'A. Author and B. Writer',
  shortTitle: 'Author & Writer',
  unitLabel: 'Ch.',
};

const CHAPTERS = [1, 2, 3, 4, 5].map((chapter) => ({ chapter, total: chapter * 10 }));

function renderPicker(selected: number[] = [], wordCount = 150) {
  const onChange = vi.fn();
  render(
    <ChapterPicker
      textbook={BOOK}
      chapters={CHAPTERS}
      selected={selected}
      onChange={onChange}
      wordCount={wordCount}
      accent={ACCENT}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

const summaryButton = () => screen.getByRole('button', { expanded: false });
const cell = (chapter: number) =>
  screen.getByRole('button', { name: new RegExp(`^Ch\\. ${chapter} —`) });

describe('ChapterPicker, closed', () => {
  it('states the book, the selection and the word count on one button', () => {
    renderPicker([1, 2, 3], 60);
    const button = summaryButton();
    expect(button.textContent).toContain('Author & Writer');
    expect(button.textContent).toContain('Ch. 1–3');
    expect(button.textContent).toContain('60 words');
  });

  it('reads an empty selection as every chapter', () => {
    renderPicker([]);
    expect(summaryButton().textContent).toContain('All chapters');
  });

  it('says "word" for one', () => {
    renderPicker([1], 1);
    expect(summaryButton().textContent).toContain('1 word');
    expect(summaryButton().textContent).not.toContain('1 words');
  });

  it('keeps the chapter grid out of the page until opened', () => {
    renderPicker();
    expect(screen.queryByRole('button', { name: /^Ch\. 1 —/ })).toBeNull();
  });
});

describe('ChapterPicker, open', () => {
  async function open(selected: number[] = []) {
    const utils = renderPicker(selected);
    await utils.user.click(summaryButton());
    return utils;
  }

  it('ties the button to the panel it opens', async () => {
    await open();
    const button = screen.getByRole('button', { expanded: true });
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    expect(panel?.contains(cell(1))).toBe(true);
  });

  it('labels every chapter with its word count and marks the selected ones', async () => {
    await open([2]);
    for (const { chapter, total } of CHAPTERS) {
      expect(cell(chapter).getAttribute('aria-label')).toBe(`Ch. ${chapter} — ${total} words`);
    }
    expect(cell(2).getAttribute('aria-pressed')).toBe('true');
    expect(cell(3).getAttribute('aria-pressed')).toBe('false');
  });

  it('adds a tapped chapter, in order', async () => {
    const { onChange, user } = await open([4]);
    await user.click(cell(2));
    expect(onChange).toHaveBeenCalledWith([2, 4]);
  });

  it('removes a chapter tapped again', async () => {
    const { onChange, user } = await open([2, 4]);
    await user.click(cell(2));
    expect(onChange).toHaveBeenCalledWith([4]);
  });

  it('"All chapters" clears the selection', async () => {
    const { onChange, user } = await open([2]);
    await user.click(screen.getByRole('button', { name: 'All chapters' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('offers the range shortcuts only once a chapter is picked', async () => {
    await open([]);
    expect(screen.queryByRole('button', { name: /^Through/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Only/ })).toBeNull();
  });

  it('"Through" and "Only" act on the furthest chapter selected', async () => {
    const { onChange, user } = await open([1, 4]);
    await user.click(screen.getByRole('button', { name: 'Through Ch. 4' }));
    expect(onChange).toHaveBeenLastCalledWith([1, 2, 3, 4]);
    await user.click(screen.getByRole('button', { name: 'Only Ch. 4' }));
    expect(onChange).toHaveBeenLastCalledWith([4]);
  });

  it('credits the book', async () => {
    await open();
    expect(screen.getByText(/A Primer/).textContent).toContain('A. Author and B. Writer');
  });

  it('closes again', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByRole('button', { name: /^Ch\. 1 —/ })).toBeNull();
  });
});

// happy-dom drops `var()` from a rendered colour, so the accent is pinned on
// the functions that produce it (as ToggleSwitch does).
describe('colours', () => {
  it('fills an active chip with the accent', () => {
    expect(chipColors(true, ACCENT)).toEqual({
      background: ACCENT,
      color: '#fff',
      borderColor: ACCENT,
    });
  });

  it('gives a resting chip a faint accent border, with the fallback intact', () => {
    const resting = chipColors(false, ACCENT);
    expect(resting.background).toBe('transparent');
    expect(resting.borderColor).toBe(faint(ACCENT));
    expect(faint(ACCENT)).toBe('color-mix(in srgb, var(--color-grape, #7C3AED) 10%, transparent)');
  });
});
