import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import Writing from './Writing';

beforeEach(() => {
  localStorage.clear();
});

describe('Writing', () => {
  it('opens on the letter drills', () => {
    render(<Writing />);

    expect(screen.getByRole('tab', { name: 'Letters' })).toHaveAttribute('aria-selected', 'true');
    // The alphabet deck picker is the letter surface's, not word mode's.
    expect(screen.getByRole('button', { name: /the alphabet/i })).toBeTruthy();
  });

  it('switches to word mode', async () => {
    const user = userEvent.setup();
    render(<Writing />);

    await user.click(screen.getByRole('tab', { name: 'Words' }));

    expect(screen.getByRole('tab', { name: 'Words' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('group', { name: /letter boxes/i })).toBeTruthy();
  });

  it('mounts only the surface in use', async () => {
    const user = userEvent.setup();
    render(<Writing />);

    // Word mode pulls in the vocabulary; a student drilling the alphabet
    // should not pay for it.
    expect(screen.queryByRole('group', { name: /letter boxes/i })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Words' }));

    expect(screen.queryByRole('button', { name: /the alphabet/i })).toBeNull();
  });

  it('switches back without losing the tab state', async () => {
    const user = userEvent.setup();
    render(<Writing />);

    await user.click(screen.getByRole('tab', { name: 'Words' }));
    await user.click(screen.getByRole('tab', { name: 'Letters' }));

    expect(screen.getByRole('tab', { name: 'Letters' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Words' })).toHaveAttribute('aria-selected', 'false');
  });
});
