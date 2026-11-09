import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { rungStates } from '../ladder';
import { LadderRungList, writesText } from './Ladder';

const RUNGS = [
  { id: 'one', title: 'Endings', detail: 'No noun', meta: '20 forms · not started' },
  { id: 'two', title: 'Stable stem' },
  { id: 'three', title: 'Reducing stem' },
];

function renderLadder(progress: Record<string, number>, selectedId: string | null = null) {
  const onSelect = vi.fn();
  render(
    <LadderRungList
      rungs={RUNGS}
      states={rungStates(
        RUNGS.map((r) => r.id),
        progress,
      )}
      selectedId={selectedId}
      onSelect={onSelect}
      accent="#15803D"
    />,
  );
  return onSelect;
}

describe('LadderRungList', () => {
  it('shows every rung, locked ones included, with what opens them', () => {
    renderLadder({ one: 1 });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1].getAttribute('data-locked')).toBe('true');
    expect(items[1].getAttribute('aria-label')).toBe('Rung 2, locked');
    expect(within(items[1]).getByText(/rung 1 \(1 of 2 so far\)/)).toBeTruthy();
    expect(within(items[0]).getByText('No noun')).toBeTruthy();
    expect(within(items[0]).getByText('20 forms · not started')).toBeTruthy();
  });

  it('selects an open rung by its card', async () => {
    const user = userEvent.setup();
    const onSelect = renderLadder({});
    await user.click(screen.getByRole('button', { name: /Endings/ }));
    expect(onSelect).toHaveBeenLastCalledWith('one');
  });

  it('deselects the selected rung', async () => {
    const user = userEvent.setup();
    const onSelect = renderLadder({}, 'one');
    const card = screen.getByRole('button', { name: /Endings/ });
    expect(card.getAttribute('aria-pressed')).toBe('true');
    await user.click(card);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('opens a locked rung only through its own button', async () => {
    const user = userEvent.setup();
    const onSelect = renderLadder({});
    // The locked card itself is not a button.
    expect(screen.queryByRole('button', { name: /Stable stem/ })).toBeNull();
    const [openTwo] = screen.getAllByRole('button', { name: 'Open anyway' });
    await user.click(openTwo);
    expect(onSelect).toHaveBeenLastCalledWith('two');
  });

  it('shows an opened-anyway rung as selected, and closes it again', async () => {
    const user = userEvent.setup();
    const onSelect = renderLadder({}, 'two');
    const opened = screen.getByRole('button', { name: 'Opened' });
    expect(opened.getAttribute('aria-pressed')).toBe('true');
    await user.click(opened);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});

describe('writesText', () => {
  const [one] = rungStates(['one', 'two'], { one: 1 });

  it('counts toward the next rung, then says it is open', () => {
    expect(writesText(one, false)).toBe('1 of 2 clean writes to open the next rung');
    expect(writesText({ ...one, cleanWrites: 2 }, false)).toBe('2 clean writes · next rung open');
  });

  it('just counts on the top rung', () => {
    expect(writesText(one, true)).toBe('1 clean write');
    expect(writesText({ ...one, cleanWrites: 3 }, true)).toBe('3 clean writes');
  });
});
