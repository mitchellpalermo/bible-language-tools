import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { COMMON_WORD_THRESHOLD, type Occurrence } from '../deck-source';
import SourceVerse from './SourceVerse';

const at = (chapter: number, verse: number, position = 0): Occurrence => ({
  chapter,
  verse,
  position,
});

function renderVerse(occurrences: Occurrence[]) {
  return render(
    <SourceVerse
      occurrences={occurrences}
      sourceLabel="Galatians"
      headword="πίστις"
      renderVerse={(o) => <p>verse {`${o.chapter}:${o.verse}#${o.position}`}</p>}
      reference={(o) => `Galatians ${o.chapter}:${o.verse}`}
      readerHref={(o) => `/reader?ref=GAL.${o.chapter}.${o.verse}`}
      accent="#7C3AED"
    />,
  );
}

describe('SourceVerse', () => {
  it('renders nothing for a word the text does not have', () => {
    const { container } = renderVerse([]);
    expect(container.innerHTML).toBe('');
  });

  it('shows the first occurrence, its reference linked to the reader, and the count', () => {
    renderVerse([at(2, 16), at(3, 2)]);
    expect(screen.getByText('verse 2:16#0')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Galatians 2:16' }).getAttribute('href')).toBe(
      '/reader?ref=GAL.2.16',
    );
    expect(screen.getByText('1 of 2 in Galatians')).toBeTruthy();
  });

  it('steps through the occurrences, two in one verse included, and stops at the ends', async () => {
    const user = userEvent.setup();
    renderVerse([at(2, 16, 1), at(2, 16, 4), at(3, 2)]);
    const prev = screen.getByRole('button', { name: 'Previous occurrence' });
    const next = screen.getByRole('button', { name: 'Next occurrence' });
    expect(prev).toHaveProperty('disabled', true);
    await user.click(next);
    expect(screen.getByText('verse 2:16#4')).toBeTruthy();
    await user.click(next);
    expect(screen.getByText('3 of 3 in Galatians')).toBeTruthy();
    expect(next).toHaveProperty('disabled', true);
    await user.click(prev);
    expect(screen.getByText('2 of 3 in Galatians')).toBeTruthy();
  });

  it('a single occurrence has a count and no arrows', () => {
    renderVerse([at(1, 1)]);
    expect(screen.getByText('1 of 1 in Galatians')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a very common word starts folded, and opens on its first occurrence', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: COMMON_WORD_THRESHOLD + 1 }, (_, i) => at(1, i + 1));
    renderVerse(many);
    expect(screen.getByText(/occurs 51 times in Galatians/)).toBeTruthy();
    expect(screen.queryByText(/^verse/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show a verse' }));
    expect(screen.getByText('verse 1:1#0')).toBeTruthy();
    expect(screen.getByText(`1 of ${many.length} in Galatians`)).toBeTruthy();
  });
});
