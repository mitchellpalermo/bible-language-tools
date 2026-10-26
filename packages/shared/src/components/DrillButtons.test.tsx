import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DrillButtons, { DRILL_COLORS } from './DrillButtons';

describe('DrillButtons', () => {
  it('renders Missed, then Got it', () => {
    render(<DrillButtons onAnswer={() => {}} />);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names[0]).toMatch(/^Missed/);
    expect(names[1]).toMatch(/^Got it/);
  });

  it('reports which answer was pressed', async () => {
    const onAnswer = vi.fn();
    const user = userEvent.setup();
    render(<DrillButtons onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: /^missed/i }));
    await user.click(screen.getByRole('button', { name: /^got it/i }));
    expect(onAnswer.mock.calls).toEqual([['missed'], ['got-it']]);
  });

  it('advertises 1 and 2 as its shortcuts', () => {
    render(<DrillButtons onAnswer={() => {}} />);
    const shortcuts = screen.getAllByRole('button').map((b) => b.getAttribute('aria-keyshortcuts'));
    expect(shortcuts).toEqual(['1', '2']);
  });

  it('gives every colour token a literal fallback', () => {
    // A bare token resolves to nothing in an app that never emits it — see
    // GradeButtons.tsx.
    for (const color of Object.values(DRILL_COLORS)) {
      expect(color).toMatch(/^var\(--color-[a-z]+, #[0-9A-Fa-f]{6}\)$/);
    }
  });

  it('does nothing when disabled', async () => {
    const onAnswer = vi.fn();
    const user = userEvent.setup();
    render(<DrillButtons onAnswer={onAnswer} disabled />);
    await user.click(screen.getByRole('button', { name: /^missed/i }));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
