import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { daysFromNow, newCard, type SRSCard } from '../srs';
import { useWorkload } from '../use-workload';
import { createWorkloadStore } from '../workload';
import { describeMinutes, WorkloadGuard } from './WorkloadGuard';

const KEY = 'test-workload-guard-v1';
const advice = () => screen.getByTestId('workload-advice');
afterEach(() => localStorage.clear());

/** A store with `n` cards due today. */
function dueStore(n: number): Record<string, SRSCard> {
  const out: Record<string, SRSCard> = {};
  for (let i = 0; i < n; i++) out[`w${i}`] = newCard(`w${i}`);
  return out;
}

/** The panel over the real hook, as an app wires it. */
function Guard({ due }: { due: number }) {
  const workload = useWorkload(createWorkloadStore(KEY));
  return <WorkloadGuard workload={workload} srsStore={dueStore(due)} accent="#15803D" />;
}

describe('describeMinutes', () => {
  it('rounds up, and says so for less than a minute', () => {
    expect(describeMinutes(20)).toBe('under a minute');
    expect(describeMinutes(60)).toBe('about 1 minute');
    expect(describeMinutes(61)).toBe('about 2 minutes');
  });
});

describe('WorkloadGuard', () => {
  it('shows the day’s reviews, quietly, while they are under the limit', () => {
    render(<Guard due={30} />);
    expect(screen.getByText(/Today’s reviews:/).textContent).toBe(
      'Today’s reviews: about 5 minutes (30 cards).',
    );
    expect(advice().textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Pause new cards' })).toBeTruthy();
  });

  it('says so when nothing is due', () => {
    render(<Guard due={0} />);
    expect(screen.getByText('No reviews due today.')).toBeTruthy();
  });

  it('suggests a pause past the limit; one tap pauses and one undoes it', async () => {
    const user = userEvent.setup();
    render(<Guard due={150} />);
    expect(advice().textContent).toMatch(/past your 20-minute limit/);

    await user.click(screen.getByRole('button', { name: 'Pause new cards' }));
    expect(
      screen.getByRole('button', { name: 'Resume new cards' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(advice().textContent).toBe('New cards are paused until you resume them.');
    expect(createWorkloadStore(KEY).load().pauseNew).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Resume new cards' }));
    expect(createWorkloadStore(KEY).load().pauseNew).toBe(false);
  });

  it('suggests resuming once the pile is back under, and never resumes by itself', () => {
    createWorkloadStore(KEY).save({ pauseNew: true, limitMinutes: 20, paceSeconds: [] });
    render(<Guard due={12} />);
    expect(advice().textContent).toMatch(/back under your 20-minute limit/);
    expect(screen.getByRole('button', { name: 'Resume new cards' })).toBeTruthy();
  });

  it('moves the limit, and keeps it', async () => {
    const user = userEvent.setup();
    render(<Guard due={150} />);
    await user.selectOptions(screen.getByLabelText('Limit'), '30');
    expect(advice().textContent).toBe('');
    expect(createWorkloadStore(KEY).load().limitMinutes).toBe(30);
  });

  it('lists a stored limit that is not one of the choices', () => {
    const workload = {
      pauseNew: false,
      limitMinutes: 25,
      pace: 10,
      setPauseNew: () => {},
      setLimitMinutes: () => {},
    };
    render(<WorkloadGuard workload={workload} srsStore={dueStore(10)} accent="#1D4ED8" />);
    expect((screen.getByLabelText('Limit') as HTMLSelectElement).value).toBe('25');
  });
});

describe('useWorkload', () => {
  it('takes the pace from recorded answers', () => {
    const { result } = renderHook(() => useWorkload(createWorkloadStore(KEY)));
    expect(result.current.pace).toBe(10);
    act(() => {
      for (let i = 0; i < 10; i++) result.current.recordAnswer(5);
    });
    expect(result.current.pace).toBe(5);
    expect(createWorkloadStore(KEY).load().paceSeconds).toHaveLength(10);
  });

  it('feeds the estimate the student’s own pace', () => {
    createWorkloadStore(KEY).save({
      pauseNew: false,
      limitMinutes: 20,
      paceSeconds: Array(10).fill(30),
    });
    render(<Guard due={45} />);
    // 45 cards at 30 seconds is past 20 minutes; at the default 10 it would not be.
    expect(screen.getByText(/Today’s reviews:/).textContent).toContain('about 23 minutes');
    expect(advice().textContent).toMatch(/past your/);
  });

  it('counts only cards due today', () => {
    const store = { ...dueStore(2), later: { ...newCard('later'), dueDate: daysFromNow(4) } };
    const workload = renderHook(() => useWorkload(createWorkloadStore(KEY))).result.current;
    render(<WorkloadGuard workload={workload} srsStore={store} accent="#15803D" />);
    expect(screen.getByText(/Today’s reviews:/).textContent).toContain('(2 cards)');
  });
});
