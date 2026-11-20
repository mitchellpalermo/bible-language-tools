/**
 * The workload guard on /flashcards (#190). The estimate, the advice and the
 * pace are tested in @tools/shared (workload.test.ts, WorkloadGuard.test.tsx,
 * use-flashcard-session.test.ts); these check this app's wiring: its storage
 * key, the pause reaching SRS Review, and the pace being recorded.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newCard, saveSRSStore } from '../data/srs';
import { WORKLOAD_KEY, workloadStore } from '../lib/workload';
import Flashcards from './Flashcards';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
});

/** `n` cards due today. Their keys need not be in the deck: every due card counts. */
function seedDue(n: number) {
  const store: Record<string, ReturnType<typeof newCard>> = {};
  for (let i = 0; i < n; i++) store[`due-${i}`] = newCard(`due-${i}`);
  saveSRSStore(store);
}

const guard = () => screen.getByTestId('workload-guard');
const advice = () => screen.getByTestId('workload-advice').textContent;

describe('the workload guard on /flashcards', () => {
  it('is stored under this app’s own key', () => {
    expect(WORKLOAD_KEY).toBe('hebrew-tools-workload-v1');
  });

  it('suggests a pause past the limit, and pausing leaves new cards out of SRS Review', async () => {
    const user = userEvent.setup();
    seedDue(150);
    render(<Flashcards />);
    expect(guard().textContent).toContain('(150 cards)');
    expect(advice()).toMatch(/past your 20-minute limit/);

    await user.click(screen.getByRole('button', { name: 'Pause new cards' }));
    expect(workloadStore.load().pauseNew).toBe(true);
    // The due cards are outside the open deck, and its new ones are paused.
    expect(screen.getByText(/all caught up/)).toBeTruthy();
    expect(advice()).toBe('New cards are paused until you resume them.');
  });

  it('keeps the way back on screen when the pause leaves nothing to review', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    expect(screen.getByText('tap to reveal')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Pause new cards' }));
    expect(screen.getByText(/all caught up/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Resume new cards' }));
    expect(screen.getByText('tap to reveal')).toBeTruthy();
    expect(workloadStore.load().pauseNew).toBe(false);
  });

  it('records how long each grade took', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(screen.getByText('tap to reveal'));
    await user.click(screen.getByRole('button', { name: /^good/i }));
    expect(workloadStore.load().paceSeconds).toHaveLength(1);
  });

  it('is not shown in a drill, which the pause does not touch', async () => {
    const user = userEvent.setup();
    render(<Flashcards />);
    await user.click(screen.getByRole('button', { name: 'Study All' }));
    expect(screen.queryByTestId('workload-guard')).toBeNull();
  });
});
