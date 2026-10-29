import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import posthog from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShiftItem } from '../data/accent-shift';
import { loadSRSStore } from '../data/srs';
import { accentCardKey, buildQueue, SCAFFOLD_HISTORY_KEY, syllableGaps } from '../lib/accent-shift';
import { loadAttempts } from '../lib/attempt-log';
import AccentTrainer from './AccentTrainer';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

/** With `Math.random` pinned, the page deals the same first item as this. */
let first: ShiftItem;

beforeEach(() => {
  localStorage.clear();
  vi.mocked(posthog.capture).mockClear();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  first = buildQueue({}, () => 0)[0];
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderTrainer() {
  render(<AccentTrainer />);
  await screen.findByRole('region', { name: 'The noun and its ending' });
  return userEvent.setup();
}

function stepStatuses() {
  return within(screen.getByRole('list', { name: 'Steps' }))
    .getAllByRole('listitem')
    .map((li) => li.dataset.status);
}

const check = () => screen.getByRole('button', { name: 'Check' });

async function divideSyllables(user: ReturnType<typeof userEvent.setup>, item: ShiftItem) {
  for (const gap of syllableGaps(item)) {
    await user.click(screen.getByRole('button', { name: `Divide after letter ${gap}` }));
  }
  await user.click(check());
}

async function markAccent(user: ReturnType<typeof userEvent.setup>, item: ShiftItem) {
  await user.click(screen.getByRole('button', { name: `Accent on syllable ${item.accent + 1}` }));
  await user.click(check());
}

async function labelPositions(user: ReturnType<typeof userEvent.setup>, item: ShiftItem) {
  for (let i = 0; i < item.accent; i++) {
    const label = i === item.accent - 1 ? 'Pretonic' : 'Distant';
    await user.click(screen.getByRole('button', { name: `Syllable ${i + 1}: ${label}` }));
  }
  await user.click(check());
}

async function typeForm(user: ReturnType<typeof userEvent.setup>, form: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'The new form, pointed' }), {
    target: { value: form },
  });
  await user.click(check());
}

describe('AccentTrainer', () => {
  it('shows the noun, the ending and the gloss of the new form', async () => {
    await renderTrainer();
    const card = screen.getByRole('region', { name: 'The noun and its ending' });
    expect(within(card).getByText(first.base)).toBeInTheDocument();
    expect(within(card).getByText(first.ending)).toBeInTheDocument();
    expect(within(card).getByText(`“${first.gloss}”`)).toBeInTheDocument();
  });

  it('keeps later steps visible but locked', async () => {
    await renderTrainer();
    expect(stepStatuses()).toEqual(['open', 'locked', 'locked', 'locked']);
  });

  it('does not show the pointed form before the last step', async () => {
    await renderTrainer();
    expect(screen.queryByText(first.form)).not.toBeInTheDocument();
  });

  it('walks a clean item through all four steps and schedules it forward', async () => {
    const user = await renderTrainer();
    await divideSyllables(user, first);
    expect(stepStatuses()).toEqual(['done', 'open', 'locked', 'locked']);
    await markAccent(user, first);
    await labelPositions(user, first);
    await typeForm(user, first.form);

    expect(screen.getByText('Every step right first time.')).toBeInTheDocument();
    expect(stepStatuses()).toEqual(['done', 'done', 'done', 'done']);
    expect(screen.getByRole('table', { name: 'How each syllable changed' })).toBeInTheDocument();
    expect(loadSRSStore()[accentCardKey(first.id)].repetition).toBe(1);
    expect(posthog.capture).toHaveBeenCalledWith('hebrew_accent_item_completed', {
      item: first.id,
      clean: true,
      speed_mode: false,
    });
    expect(screen.getByText(/1 done, 1 right first time/)).toBeInTheDocument();
  });

  it('logs every step’s first try', async () => {
    const user = await renderTrainer();
    await user.click(check()); // no gaps: a miss
    await divideSyllables(user, first);
    const log = loadAttempts();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ concept: 'accent-shift/syllables', correct: false });
    expect(typeof log[0].ms).toBe('number');
  });

  it('names the rule on a miss and keeps the step open', async () => {
    const user = await renderTrainer();
    await user.click(check());
    const feedback = screen.getByRole('status', { name: 'Not quite — try again' });
    expect(within(feedback).getAllByRole('link', { name: 'Review this rule' })[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/grammar#/),
    );
    expect(stepStatuses()[0]).toBe('open');
  });

  it('reveals a step after a miss, and sends the item back for review', async () => {
    const user = await renderTrainer();
    expect(screen.queryByRole('button', { name: 'Show me' })).not.toBeInTheDocument();
    await user.click(check());
    await user.click(screen.getByRole('button', { name: 'Show me' }));
    expect(stepStatuses()).toEqual(['missed', 'open', 'locked', 'locked']);

    await markAccent(user, first);
    await labelPositions(user, first);
    await typeForm(user, first.form);
    expect(screen.getByText(/comes back for review tomorrow/)).toBeInTheDocument();
    expect(loadSRSStore()[accentCardKey(first.id)].repetition).toBe(0);
  });

  it('names the vowel rule behind a wrong form', async () => {
    const user = await renderTrainer();
    await divideSyllables(user, first);
    await markAccent(user, first);
    await labelPositions(user, first);
    await typeForm(user, first.form.replace(/[ְ-ֻ]/g, ''));
    expect(screen.getByRole('status', { name: 'Not quite — try again' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show me' }));
    expect(screen.getByText(/comes back for review tomorrow/)).toBeInTheDocument();
  });

  it('moves to another word', async () => {
    const user = await renderTrainer();
    for (let i = 0; i < 4; i++) {
      await user.click(check());
      await user.click(screen.getByRole('button', { name: 'Show me' }));
    }
    await user.click(screen.getByRole('button', { name: 'Next word' }));
    expect(stepStatuses()).toEqual(['open', 'locked', 'locked', 'locked']);
    expect(screen.getByText(/1 done, 0 right first time/)).toBeInTheDocument();
  });

  describe('speed mode', () => {
    it('is hidden until the scaffold has been earned', async () => {
      await renderTrainer();
      expect(screen.queryByRole('switch', { name: 'Speed mode' })).not.toBeInTheDocument();
      expect(screen.getByText(/unlocks at 90%/)).toBeInTheDocument();
    });

    it('skips straight to the form once earned', async () => {
      localStorage.setItem(SCAFFOLD_HISTORY_KEY, JSON.stringify(Array(20).fill(true)));
      const user = await renderTrainer();
      await user.click(screen.getByRole('switch', { name: 'Speed mode' }));
      expect(stepStatuses()).toEqual(['skipped', 'skipped', 'skipped', 'open']);

      await typeForm(user, first.form);
      expect(screen.getByText('Every step right first time.')).toBeInTheDocument();
      expect(posthog.capture).toHaveBeenCalledWith(
        'hebrew_accent_item_completed',
        expect.objectContaining({ speed_mode: true }),
      );
      // Speed mode answers no scaffold steps, so it adds nothing to the record.
      expect(JSON.parse(localStorage.getItem(SCAFFOLD_HISTORY_KEY) ?? '[]')).toHaveLength(20);
    });

    it('records scaffold results outside speed mode', async () => {
      const user = await renderTrainer();
      await divideSyllables(user, first);
      await markAccent(user, first);
      await labelPositions(user, first);
      await typeForm(user, first.form);
      expect(JSON.parse(localStorage.getItem(SCAFFOLD_HISTORY_KEY) ?? '[]')).toEqual([
        true,
        true,
        true,
      ]);
    });
  });

  it('focuses the field when the form step opens', async () => {
    const user = await renderTrainer();
    await divideSyllables(user, first);
    await markAccent(user, first);
    await labelPositions(user, first);
    expect(screen.getByRole('textbox', { name: 'The new form, pointed' })).toHaveFocus();
  });

  it('opens a keypad on the form step', async () => {
    const user = await renderTrainer();
    await divideSyllables(user, first);
    await markAccent(user, first);
    await labelPositions(user, first);
    await user.click(screen.getByRole('switch', { name: 'Keypad' }));
    const keypad = screen.getByRole('region', { name: 'Hebrew keypad' });
    await user.click(within(keypad).getByRole('button', { name: 'alef' }));
    expect(screen.getByRole('textbox', { name: 'The new form, pointed' })).toHaveValue('א');
  });
});
