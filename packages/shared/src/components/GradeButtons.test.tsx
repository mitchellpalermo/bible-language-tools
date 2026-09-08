import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { newCard, type SRSCard } from '../srs';
import GradeButtons, { formatInterval } from './GradeButtons';

function card(overrides: Partial<SRSCard> = {}): SRSCard {
  return { ...newCard('test'), ...overrides };
}

describe('formatInterval', () => {
  it('reports short gaps in days', () => {
    expect(formatInterval(1)).toBe('1d');
    expect(formatInterval(6)).toBe('6d');
  });

  it('switches to weeks, months and years as the gap grows', () => {
    expect(formatInterval(14)).toBe('2wk');
    expect(formatInterval(60)).toBe('2mo');
    expect(formatInterval(730)).toBe('2y');
  });

  it('keeps a decimal only where it distinguishes two grades', () => {
    // Good and Easy on a 30-day card land 75 and 98 days out. Rounded to whole
    // months both read "3mo", which makes the preview say the choice is moot.
    expect(formatInterval(75)).toBe('2.5mo');
    expect(formatInterval(98)).toBe('3.3mo');
    expect(formatInterval(3650)).toBe('10y');
  });
});

describe('GradeButtons', () => {
  it('renders the four grades in Anki order', () => {
    render(<GradeButtons card={card()} onGrade={() => {}} />);
    const labels = screen.getAllByRole('button').map((b) => b.textContent?.replace(/\d.*$/, ''));
    expect(labels).toEqual(['Again', 'Hard', 'Good', 'Easy']);
  });

  it('reports the grade that was pressed', async () => {
    const onGrade = vi.fn();
    const user = userEvent.setup();
    render(<GradeButtons card={card()} onGrade={onGrade} />);

    await user.click(screen.getByRole('button', { name: /^easy/i }));
    expect(onGrade).toHaveBeenCalledWith('easy');

    await user.click(screen.getByRole('button', { name: /^again/i }));
    expect(onGrade).toHaveBeenCalledWith('again');
  });

  it('previews the interval each grade would buy', () => {
    // A mature card: Again drops it to a day, Easy stretches it furthest.
    render(
      <GradeButtons
        card={card({ repetition: 4, interval: 30, easeFactor: 2.5 })}
        onGrade={() => {}}
      />,
    );
    const text = (name: RegExp) => screen.getByRole('button', { name }).textContent;
    expect(text(/^again/i)).toBe('Again1d');
    expect(text(/^hard/i)).toBe('Hard1.2mo');
    expect(text(/^good/i)).toBe('Good2.5mo');
    expect(text(/^easy/i)).toBe('Easy3.3mo');
    // The whole point: the four previews are four different numbers.
    expect(new Set([text(/^again/i), text(/^hard/i), text(/^good/i), text(/^easy/i)]).size).toBe(4);
  });

  it('renders without previews when there is no card yet', () => {
    render(<GradeButtons onGrade={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /^good/i }).textContent).toBe('Good');
  });

  it('names its keyboard shortcut on each button', () => {
    render(<GradeButtons card={card()} onGrade={() => {}} />);
    const shortcuts = screen.getAllByRole('button').map((b) => b.getAttribute('aria-keyshortcuts'));
    expect(shortcuts).toEqual(['1', '2', '3', '4']);
  });

  it('does not fire when disabled', async () => {
    const onGrade = vi.fn();
    const user = userEvent.setup();
    render(<GradeButtons card={card()} onGrade={onGrade} disabled />);
    await user.click(screen.getByRole('button', { name: /^good/i }));
    expect(onGrade).not.toHaveBeenCalled();
  });
});
