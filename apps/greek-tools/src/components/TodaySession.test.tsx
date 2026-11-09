import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dayIndex } from '@tools/shared/daily';
import { buildTodayPlan } from '@tools/shared/today';
import posthog from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveFocusPassages, saveParseHistoryStore } from '../data/focusPassages';
import { daysFromNow, loadSRSStore, type SRSCard, saveSRSStore } from '../data/srs';
import { vocabulary } from '../data/vocabulary';
import { loadAttempts } from '../lib/attempt-log';
import { loadStudyStreak } from '../lib/study-streak';
import { BUDGET_KEY, type TodayDrill, type TodayItem, vocabSrsKey } from '../lib/today';
import type { ParseItem } from '../lib/verb-parse';
import TodaySession, { planSteps } from './TodaySession';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

function card(key: string, due: number, overrides: Partial<SRSCard> = {}): SRSCard {
  return {
    key,
    interval: 4,
    repetition: 2,
    easeFactor: 2.5,
    dueDate: daysFromNow(due),
    lastReviewed: daysFromNow(-3),
    ...overrides,
  };
}

/** Every word scheduled ahead except the first `due`, which are due today. */
function seedDueWords(due: number, learnedAhead = true) {
  const store: Record<string, SRSCard> = {};
  vocabulary.forEach((w, i) => {
    if (i < due) store[vocabSrsKey(w)] = card(vocabSrsKey(w), 0);
    else if (learnedAhead) store[vocabSrsKey(w)] = card(vocabSrsKey(w), 7);
  });
  saveSRSStore(store);
}

async function answerCard(user: ReturnType<typeof userEvent.setup>, grade: RegExp = /^good/i) {
  await user.click(screen.getByText('tap to reveal'));
  await user.click(screen.getByRole('button', { name: grade }));
}

/** A local date on which the drill rotation (parse, mixed) lands on `index`. */
function dayWithDrill(index: 0 | 1): Date {
  for (let d = 1; d < 5; d++) {
    const date = new Date(2026, 10, d, 12);
    if (dayIndex(2, date) === index) return date;
  }
  throw new Error('no such day');
}

async function answerParseItem(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Tense'), 'present');
  await user.selectOptions(screen.getByLabelText('Voice'), 'active');
  await user.selectOptions(screen.getByLabelText('Mood'), 'indicative');
  await user.selectOptions(screen.getByLabelText('Person'), '1st');
  await user.selectOptions(screen.getByLabelText('Number'), 'singular');
  await user.click(screen.getByRole('button', { name: /submit/i }));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/today');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the plan screen', () => {
  it('previews the session and remembers the budget', async () => {
    const user = userEvent.setup();
    seedDueWords(2);
    render(<TodaySession />);

    expect(screen.getByText('2 cards due')).toBeInTheDocument();
    expect(screen.getByText(/^About \d+ minutes? of 20\./)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /45/ }));
    expect(localStorage.getItem(BUDGET_KEY)).toBe('45');
    expect(screen.getByRole('button', { name: 'Start 45-minute session' })).toBeEnabled();
  });

  it('says nothing is due when there is nothing to review, and still offers a drill', () => {
    render(<TodaySession />);
    expect(screen.getByTestId('nothing-due')).toHaveTextContent('Nothing is due today');
    expect(screen.getByText(/Parse quiz, \d+ forms/)).toBeInTheDocument();
  });

  it('invites a first session when there is no streak', () => {
    render(<TodaySession />);
    expect(screen.getByTestId('today-streak')).toHaveTextContent('Finish a session to start');
  });

  it('says how many due cards wait when the budget is short', () => {
    seedDueWords(500);
    render(<TodaySession />);
    expect(screen.getByText(/due cards wait for tomorrow/)).toBeInTheDocument();
  });

  it('points at the focus passage parsed worst', () => {
    saveFocusPassages([
      {
        id: 'p1',
        label: 'Prologue',
        book: 'JHN',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 18,
        createdAt: '2026-10-01',
      },
    ]);
    saveParseHistoryStore({ p1: { correct: 3, total: 12 } });
    render(<TodaySession />);
    expect(screen.getByTestId('weak-passage')).toHaveTextContent('Prologue is at 25%');
    expect(screen.getByRole('link', { name: 'Prologue' })).toHaveAttribute('href', '/focus/p1');
  });
});

describe('running a session', () => {
  it('reviews the due cards, moves on to the drill, and ends on a summary', async () => {
    const user = userEvent.setup();
    seedDueWords(2, false);
    render(<TodaySession />);

    await user.click(screen.getByRole('button', { name: 'Start 20-minute session' }));
    expect(posthog.capture).toHaveBeenCalledWith(
      'today_started',
      expect.objectContaining({ budget: 20, vocab: 2 }),
    );
    expect(screen.getByText('Part 1 of 2: Vocabulary')).toBeInTheDocument();

    await answerCard(user);
    await answerCard(user, /^again/i);

    // The vocabulary is done, and the drill is next.
    expect(screen.getByText(/^Part 2 of 2: Drill: /)).toBeInTheDocument();
    // The grades went to the real schedule.
    const store = loadSRSStore();
    expect(Object.values(store).filter((c) => c.lastReviewed === daysFromNow(0))).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'End session' }));
    const summary = screen.getByRole('region', { name: 'Session summary' });
    expect(summary).toHaveTextContent('2reviewed');
    expect(summary).toHaveTextContent('1missed');
    expect(within(summary).getByRole('row', { name: /Vocabulary 2 1/ })).toBeInTheDocument();
    expect(summary).toHaveTextContent('Study streak: 1 day · Ended early.');
    expect(loadStudyStreak().streak).toBe(1);
    expect(posthog.capture).toHaveBeenCalledWith(
      'today_finished',
      expect.objectContaining({ reason: 'early', reviewed: 2, missed: 1 }),
    );

    // Back to a fresh plan, which now shows the streak.
    await user.click(screen.getByRole('button', { name: 'Plan another session' }));
    expect(screen.getByTestId('today-streak')).toHaveTextContent(
      'Study streak: 1 day · today is done.',
    );
  });

  it('does not count a session in which nothing was answered', async () => {
    const user = userEvent.setup();
    seedDueWords(2);
    render(<TodaySession />);
    await user.click(screen.getByRole('button', { name: 'Start 20-minute session' }));
    await user.click(screen.getByRole('button', { name: 'End session' }));
    expect(screen.getByRole('region', { name: 'Session summary' })).toHaveTextContent(
      'Study streak: 0 days',
    );
    expect(loadStudyStreak().streak).toBe(0);
  });

  it('stops when the budget is used, after the card in hand', async () => {
    const user = userEvent.setup();
    seedDueWords(5);
    render(<TodaySession />);
    await user.click(screen.getByRole('button', { name: 'Start 20-minute session' }));

    // Twenty-one minutes pass on the first card.
    const start = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(start + 21 * 60_000);
    await answerCard(user);

    const summary = screen.getByRole('region', { name: 'Session summary' });
    expect(summary).toHaveTextContent('1reviewed');
    expect(summary).toHaveTextContent('Time was up, so the rest waits for tomorrow.');
  });

  it('runs the parse drill, logs each answer, and finishes', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ toFake: ['Date'], now: dayWithDrill(0) });
    seedDueWords(0, false);
    render(<TodaySession />);
    await user.click(screen.getByRole('button', { name: 'Start 20-minute session' }));

    expect(screen.getByText('Part 1 of 1: Drill: Parse quiz')).toBeInTheDocument();
    await answerParseItem(user);
    await user.click(screen.getByRole('button', { name: /next form/i }));
    await answerParseItem(user);

    const log = loadAttempts().filter((a) => a.concept.startsWith('parse/paradigm/'));
    expect(log).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'End session' }));
    const summary = screen.getByRole('region', { name: 'Session summary' });
    expect(summary).toHaveTextContent('2reviewed');
    expect(within(summary).getByRole('row', { name: /Parse quiz/ })).toBeInTheDocument();
  });

  it('stops the parse drill at the end of the clock', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ toFake: ['Date'], now: dayWithDrill(0) });
    render(<TodaySession />);
    await user.click(screen.getByRole('button', { name: 'Start 20-minute session' }));
    await answerParseItem(user);
    vi.setSystemTime(new Date(Date.now() + 25 * 60_000));
    await user.click(screen.getByRole('button', { name: /next form/i }));
    expect(screen.getByRole('region', { name: 'Session summary' })).toHaveTextContent(
      'Time was up',
    );
  });

  it('runs the mixed review as a drill that schedules nothing', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ toFake: ['Date'], now: dayWithDrill(1) });
    seedDueWords(0);
    const before = JSON.stringify(loadSRSStore());
    render(<TodaySession />);
    await user.click(screen.getByRole('button', { name: 'Start 20-minute session' }));

    expect(
      screen.getByText('Part 1 of 1: Drill: Mixed review of learned words'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('today-card-progress')).toHaveTextContent('practice, not scheduled');
    await user.click(screen.getByText('tap to reveal'));
    await user.click(screen.getByRole('button', { name: /got it/i }));
    await user.click(screen.getByText('tap to reveal'));
    await user.click(screen.getByRole('button', { name: /missed/i }));

    await user.click(screen.getByRole('button', { name: 'End session' }));
    expect(screen.getByRole('region', { name: 'Session summary' })).toHaveTextContent('2reviewed');
    expect(JSON.stringify(loadSRSStore())).toBe(before);
  });

  it('starts at once from /today?start=45, and ignores anything else', async () => {
    seedDueWords(2);
    window.history.replaceState(null, '', '/today?start=45');
    render(<TodaySession />);
    expect(await screen.findByText('Part 1 of 2: Vocabulary')).toBeInTheDocument();
    expect(localStorage.getItem(BUDGET_KEY)).toBe('45');
    expect(window.location.search).toBe('');
  });

  it('shows the pick screen for an unsupported start value', () => {
    window.history.replaceState(null, '', '/today?start=7');
    render(<TodaySession />);
    expect(screen.getByRole('button', { name: /Start \d+-minute session/ })).toBeInTheDocument();
  });

  it('pauses the clock while the tab is hidden', async () => {
    const user = userEvent.setup();
    seedDueWords(2);
    render(<TodaySession />);
    await user.click(screen.getByRole('button', { name: 'Start 20-minute session' }));

    const start = Date.now();
    const state = vi.spyOn(document, 'visibilityState', 'get');
    state.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    // An hour passes in the background; the clock does not move.
    vi.spyOn(Date, 'now').mockReturnValue(start + 60 * 60_000);
    state.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await answerCard(user);

    expect(screen.queryByRole('region', { name: 'Session summary' })).not.toBeInTheDocument();
  });
});

describe('planSteps', () => {
  const word = vocabulary[0];
  const item = (id: string): { id: string; tier: 'due'; seconds: number; payload: TodayItem } => ({
    id,
    tier: 'due',
    seconds: 10,
    payload: { kind: 'vocab', word },
  });
  const plan = (drill?: TodayDrill) =>
    buildTodayPlan<TodayItem, TodayDrill>({
      budget: 20,
      sections: [{ id: 'vocab', candidates: [item('a')] }],
      drill: drill ? { id: 'd', seconds: 30, payload: drill } : null,
    });

  it('lists vocabulary, then the drill', () => {
    const parse: TodayDrill = { kind: 'parse', items: [{} as ParseItem] };
    expect(planSteps(plan(parse)).map((s) => s.kind)).toEqual(['vocab', 'parse']);
    const mixed: TodayDrill = { kind: 'mixed', words: [word] };
    const steps = planSteps(plan(mixed));
    expect(steps.map((s) => s.kind)).toEqual(['vocab', 'vocab']);
    expect(steps[1]).toMatchObject({ mode: 'all', section: 'drill' });
  });

  it('has no vocabulary step when nothing is due, and no drill step without a drill', () => {
    expect(planSteps(plan())).toHaveLength(1);
    const empty = buildTodayPlan<TodayItem, TodayDrill>({
      budget: 20,
      sections: [{ id: 'vocab', candidates: [] }],
    });
    expect(planSteps(empty)).toEqual([]);
  });
});
