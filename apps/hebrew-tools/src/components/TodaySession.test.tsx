import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { drillForToday } from '@tools/shared/today-session';
import posthog from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysFromNow, loadSRSStore, newCard, type SRSCard, saveSRSStore } from '../data/srs';
import { vocabSrsKey, vocabulary } from '../data/vocabulary';
import { saveSelection } from '../lib/deck-selection';
import { buildTableModels, getQuizCells } from '../lib/paradigm-quiz';
import { paradigmCardKey } from '../lib/paradigm-srs';
import {
  BUDGET_KEY,
  buildSessionPlan,
  DRILL_ROTATION,
  loadStudyStreak,
  NEW_WORDS_PER_SESSION,
} from '../lib/today-session';
import TodaySession, { planLines } from './TodaySession';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

// The accent drill has its own tests; here it only has to finish.
vi.mock('./AccentTrainer', () => ({
  default: ({ onComplete }: { onComplete: (t: { done: number; clean: number }) => void }) => (
    <button type="button" onClick={() => onComplete({ done: 4, clean: 3 })}>
      Finish the drill
    </button>
  ),
}));

const due = (key: string): SRSCard => ({
  ...newCard(key),
  interval: 3,
  repetition: 2,
  dueDate: daysFromNow(-1),
});
const word = vocabulary[0];
const verbTable = buildTableModels().find((t) => t.layout === 'verb' && !t.rung);
const cellId = getQuizCells(verbTable as NonNullable<typeof verbTable>).find((c) => c.id)
  ?.id as string;

/** Pin today to a day the rotation gives the accent drill, which is mocked. */
function onAccentDay() {
  for (let i = 0; i < 3; i++) {
    const d = new Date(2026, 9, 31 + i, 9);
    if (drillForToday(DRILL_ROTATION, () => true, d) === 'accent') {
      vi.useFakeTimers({ toFake: ['Date'], now: d });
      return;
    }
  }
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(posthog.capture).mockClear();
  onAccentDay();
});

afterEach(() => {
  vi.useRealTimers();
});

const start = () => screen.getByRole('button', { name: 'Start' });

/** Reveal the card on screen and grade it. */
async function grade(user: ReturnType<typeof userEvent.setup>, name: 'Good' | 'Again') {
  await user.click(screen.getByText(/tap to reveal/));
  await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
}

describe('the start screen', () => {
  it('plans after hydration and shows what the session holds', async () => {
    saveSRSStore({ [vocabSrsKey(word)]: due(vocabSrsKey(word)) });
    render(<TodaySession />);
    expect(await screen.findByText('1 word to review')).toBeInTheDocument();
    expect(screen.getByText(`${NEW_WORDS_PER_SESSION} new words`)).toBeInTheDocument();
    expect(screen.getByText('Drill: Accent shift')).toBeInTheDocument();
    expect(screen.getByText(/of your 20$/)).toBeInTheDocument();
  });

  it('remembers the budget picked', async () => {
    const user = userEvent.setup();
    render(<TodaySession />);
    await user.click(screen.getByRole('button', { name: '45 min' }));
    expect(screen.getByRole('button', { name: '45 min' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(BUDGET_KEY)).toBe('45');
    expect(screen.getByText(/of your 45$/)).toBeInTheDocument();
  });
});

describe('a session', () => {
  it('runs every part in order, then counts the day and summarises', async () => {
    const user = userEvent.setup();
    saveSRSStore({
      [vocabSrsKey(word)]: due(vocabSrsKey(word)),
      [paradigmCardKey(cellId)]: due(paradigmCardKey(cellId)),
    });
    render(<TodaySession />);
    await user.click(start());

    const parts = screen.getByRole('list', { name: 'Session parts' });
    expect(
      within(parts)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Review words', 'Review forms', 'New words', 'Accent shift']);
    expect(posthog.capture).toHaveBeenCalledWith(
      'hebrew_session_started',
      expect.objectContaining({ budget: 20, review_words: 1, review_forms: 1, drill: 'accent' }),
    );

    // Review words: the due word, graded Good, moves on in the schedule.
    await grade(user, 'Good');
    expect(loadSRSStore()[vocabSrsKey(word)].dueDate > daysFromNow(0)).toBe(true);

    // Review forms: checked blank, so a miss.
    expect(screen.getByText('Today’s forms — 1 blank')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check answers' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // New words, every one.
    for (let i = 0; i < NEW_WORDS_PER_SESSION; i++) await grade(user, 'Good');

    await user.click(screen.getByRole('button', { name: 'Finish the drill' }));

    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    const reviewed = 1 + 1 + NEW_WORDS_PER_SESSION + 4;
    expect(screen.getByText('Reviewed').nextSibling?.textContent).toBe(String(reviewed));
    expect(screen.getByText('Missed').nextSibling?.textContent).toBe('2');
    // The missed form is due tomorrow; so is every new word graded Good.
    expect(Number(screen.getByText('Due tomorrow').nextSibling?.textContent)).toBe(
      1 + NEW_WORDS_PER_SESSION,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Study streak: 1 day.');
    expect(loadStudyStreak().streak).toBe(1);
    expect(posthog.capture).toHaveBeenCalledWith(
      'hebrew_session_completed',
      expect.objectContaining({ finished: true, reviewed, missed: 2 }),
    );
  });

  it('keeps what was done when ended early, without counting the day', async () => {
    const user = userEvent.setup();
    saveSRSStore({ [vocabSrsKey(word)]: due(vocabSrsKey(word)) });
    render(<TodaySession />);
    await user.click(start());
    await grade(user, 'Again');
    await user.click(screen.getByRole('button', { name: 'End session' }));

    expect(screen.getByRole('heading', { name: 'Session ended' })).toBeInTheDocument();
    expect(screen.getByText('Reviewed').nextSibling?.textContent).toBe('1');
    expect(screen.getByText('Missed').nextSibling?.textContent).toBe('1');
    expect(screen.getByRole('status')).toHaveTextContent(/Finish a whole session/);
    expect(loadStudyStreak().streak).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Back to Study' }));
    expect(start()).toBeInTheDocument();
  });

  it('starts with new words from the student’s own chapters when nothing is due', async () => {
    const user = userEvent.setup();
    saveSelection({ deck: 'garrett-derouchie', chapters: [2], categories: ['core'] });
    render(<TodaySession />);
    await user.click(start());
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('New words');
  });
});

describe('planLines', () => {
  it('names each part the plan holds, and only those', () => {
    const plan = buildSessionPlan({
      store: {},
      budget: 20,
      selection: { deck: 'all', chapters: [], categories: ['core'] },
      ladder: {},
    });
    expect(planLines(plan)).toEqual([`${NEW_WORDS_PER_SESSION} new words`, 'Drill: Accent shift']);
  });
});
