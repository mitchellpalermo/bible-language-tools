import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ResetProgress, { joinPhrases, type ResetProgressProps } from './ResetProgress';

const ERASES = ['Vocabulary flashcards', 'Handwriting practice'];
const KEEPS = ['streak', 'accuracy stats'];

function setup(props: Partial<ResetProgressProps> = {}) {
  const clearLocal = vi.fn();
  const clearServer = vi.fn().mockResolvedValue(true);
  const user = userEvent.setup();
  render(
    <ResetProgress
      signedIn
      erases={ERASES}
      keeps={KEEPS}
      clearLocal={clearLocal}
      clearServer={clearServer}
      {...props}
    />,
  );
  return { user, clearLocal, clearServer };
}

const openButton = () => screen.getByRole('button', { name: 'Reset SRS progress…' });
const eraseButton = () =>
  screen.getByRole('button', { name: 'Erase SRS progress' }) as HTMLButtonElement;
const confirmInput = () => screen.getByLabelText('Type RESET to confirm') as HTMLInputElement;

async function openAndType(user: ReturnType<typeof userEvent.setup>, word = 'RESET') {
  await user.click(openButton());
  await user.type(confirmInput(), word);
}

describe('joinPhrases', () => {
  it('reads as a list in prose', () => {
    expect(joinPhrases([])).toBe('');
    expect(joinPhrases(['a'])).toBe('a');
    expect(joinPhrases(['a', 'b'])).toBe('a and b');
    expect(joinPhrases(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('ResetProgress', () => {
  it('starts closed, with nothing destructive on screen', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeTruthy();
    expect(openButton()).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Erase SRS progress' })).toBeNull();
  });

  it('opens a confirmation that names everything erased and kept, and focuses the field', async () => {
    const { user } = setup();
    await user.click(openButton());

    const group = screen.getByRole('group', { name: 'Erase all SRS progress?' });
    for (const item of ERASES) expect(group.textContent).toContain(item);
    expect(group.textContent).toContain('Kept: your streak and accuracy stats.');
    expect(group.textContent).toContain('cannot be undone');
    expect(document.activeElement).toBe(confirmInput());
  });

  it('warns a signed-in user about the account copy and other devices', async () => {
    const { user } = setup({ signedIn: true });
    await user.click(openButton());

    expect(screen.getByText(/copy saved to your account is erased too/)).toBeTruthy();
    expect(screen.getByText(/reset each of them as well/)).toBeTruthy();
  });

  it('tells a signed-out user only this browser is affected', async () => {
    const { user } = setup({ signedIn: false });
    await user.click(openButton());

    expect(screen.getByText(/affects this browser only/)).toBeTruthy();
  });

  it('keeps the erase button disabled until the word matches', async () => {
    const { user, clearLocal } = setup();
    await openAndType(user, 'RESE');

    expect(eraseButton().disabled).toBe(true);
    await user.click(eraseButton());
    await user.keyboard('{Enter}');
    expect(clearLocal).not.toHaveBeenCalled();

    await user.type(confirmInput(), 'T');
    expect(eraseButton().disabled).toBe(false);
  });

  it('erases both copies on confirm and reports success', async () => {
    const { user, clearLocal, clearServer } = setup();
    await openAndType(user);
    await user.click(eraseButton());

    expect(clearLocal).toHaveBeenCalledOnce();
    expect(clearServer).toHaveBeenCalledOnce();
    expect((await screen.findByRole('status')).textContent).toMatch(
      /in this browser and on your account/,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    // The panel closes and focus lands on the result, not the top of the page.
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement?.textContent).toMatch(/SRS progress erased/);
  });

  it('confirms with Enter from the field', async () => {
    const { user, clearLocal } = setup();
    await openAndType(user, 'reset{Enter}');

    expect(clearLocal).toHaveBeenCalledOnce();
    await screen.findByRole('status');
  });

  it('does not touch the server when signed out', async () => {
    const { user, clearServer } = setup({ signedIn: false });
    await openAndType(user);
    await user.click(eraseButton());

    expect(clearServer).not.toHaveBeenCalled();
    expect((await screen.findByRole('status')).textContent).toBe(
      'SRS progress erased in this browser. Every card is new again.',
    );
  });

  it('shows the local reset as done, with a non-blocking alert, when the server delete fails', async () => {
    const clearServer = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { user } = setup({ clearServer });
    await openAndType(user);
    await user.click(eraseButton());

    expect((await screen.findByRole('status')).textContent).toMatch(/erased in this browser/);
    expect(screen.getByRole('alert').textContent).toMatch(/account's copy could not be erased/);

    // The retry repeats only the server half.
    await user.click(screen.getByRole('button', { name: 'Try erasing the account copy again' }));
    expect(clearServer).toHaveBeenCalledTimes(2);
    expect((await screen.findByRole('status')).textContent).toMatch(/and on your account/);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says nothing was erased when this browser cannot be written', async () => {
    const clearLocal = vi.fn(() => {
      throw new Error('SecurityError');
    });
    const { user, clearServer } = setup({ clearLocal });
    await openAndType(user);
    await user.click(eraseButton());

    expect((await screen.findByRole('alert')).textContent).toMatch(/Nothing was erased/);
    expect(clearServer).not.toHaveBeenCalled();
  });

  it('cancels with the Cancel button and returns focus to the opener', async () => {
    const { user, clearLocal } = setup();
    await openAndType(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(openButton());
    expect(clearLocal).not.toHaveBeenCalled();
  });

  it('cancels with Escape, and reopens with an empty field', async () => {
    const { user } = setup();
    await openAndType(user);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group')).toBeNull();
    await user.click(openButton());
    expect(confirmInput().value).toBe('');
  });
});
