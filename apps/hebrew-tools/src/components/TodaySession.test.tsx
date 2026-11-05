import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildTodayPlan } from '@tools/shared/today';
import posthog from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysFromNow, loadSRSStore, type SRSCard, saveSRSStore } from '../data/srs';
import { vocabulary } from '../data/vocabulary';
import { buildTableModels, getQuizCells } from '../lib/paradigm-quiz';
import { paradigmCardKey } from '../lib/paradigm-srs';
import { loadStudyStreak } from '../lib/study-streak';
import { BUDGET_KEY, type TodayDrill, type TodayItem, vocabSrsKey } from '../lib/today';
import TodaySession, { planSteps } from './TodaySession';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

function card(key: string, due: number): SRSCard {
  return {
    key,
    interval: 4,
    repetition: 2,
    easeFactor: 2.5,
    dueDate: daysFromNow(due),
    lastReviewed: daysFromNow(-3),
  };
}

/** Every word scheduled ahead except the first `due`, which are due today. */
function seedDueWords(due: number) {
  const store = Object.fromEntries(
    vocabulary.map((w, i) => [vocabSrsKey(w), card(vocabSrsKey(w), i < due ? 0 : 7)]),
  );
  saveSRSStore(store);
}

async function answerCard(user: ReturnType<typeof userEvent.setup>, grade: RegExp = /^good/i) {
  await user.click(screen.getByText('tap to reveal'));
  await user.click(screen.getByRole('button', { name: grade }));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/today');
});

afterEach(() => {
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

  it('says nothing is due when there is nothing to review', () => {
    render(<TodaySession />);
    expect(screen.getByTestId('nothing-due')).toHaveTextContent('Nothing is due today');
  });

  it('invites a first session when there is no streak', () => {
    render(<TodaySession />);
    expect(screen.getByTestId('today-streak')).toHaveTextContent('Finish a session to start');
  });
});

describe('running a session', () => {
  it('reviews the due cards, moves on to the drill, and ends on a summary', async () => {
    const user = userEvent.setup();
    seedDueWords(2);
    render(<TodaySession />);

    await user.click(screen.getByRole('button', { name: 'Start 20-minute session' }));
    expect(posthog.capture).toHaveBeenCalledWith(
      'hebrew_today_started',
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
      'hebrew_today_finished',
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

  it('runs due paradigm forms one table at a time', async () => {
    const user = userEvent.setup();
    seedDueWords(0);
    const verb = buildTableModels().find((t) => t.layout === 'verb') as ReturnType<
      typeof buildTableModels
    >[number];
    // One form due; the rest of its table learned and scheduled ahead.
    const ids = getQuizCells(verb).flatMap((c) => (c.id ? [c.id] : []));
    saveSRSStore({
      ...loadSRSStore(),
      ...Object.fromEntries(
        ids.map((id, i) => [paradigmCardKey(id), card(paradigmCardKey(id), i === 0 ? -1 : 7)]),
      ),
    });
    render(<TodaySession />);

    expect(screen.getByText('1 form (1 due)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start 20-minute session' }));
    expect(screen.getByText('Part 1 of 2: Paradigm forms')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Check answers' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/^Part 2 of 2: Drill: /)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'End session' }));
    expect(
      within(screen.getByRole('region', { name: 'Session summary' })).getByRole('row', {
        name: /Paradigm forms 1 1/,
      }),
    ).toBeInTheDocument();
  });

  it('starts at once from /today?start=45 and tidies the address', () => {
    seedDueWords(1);
    window.history.replaceState(null, '', '/today?start=45');
    render(<TodaySession />);
    expect(screen.getByText('Part 1 of 2: Vocabulary')).toBeInTheDocument();
    expect(screen.getByTestId('today-clock')).toHaveTextContent('0 of 45 min');
    expect(window.location.search).toBe('');
  });

  it('ignores a start that is not a budget', () => {
    window.history.replaceState(null, '', '/today?start=30');
    render(<TodaySession />);
    expect(screen.getByRole('button', { name: /^Start \d+-minute session$/ })).toBeInTheDocument();
  });
});

describe('planSteps', () => {
  const [w1, w2, w3] = vocabulary;
  const tables = buildTableModels();
  const rung = tables.find((t) => t.rung) as (typeof tables)[number];
  const verb = tables.find((t) => t.layout === 'verb') as (typeof tables)[number];
  const verbIds = getQuizCells(verb).flatMap((c) => (c.id ? [c.id] : []));

  const vocab = (word: typeof w1, tier: 'due' | 'weak' | 'new') => ({
    id: vocabSrsKey(word),
    tier,
    seconds: 10,
    payload: { kind: 'vocab', word } as TodayItem,
  });

  it('runs only due vocabulary, and weak forms as practice', () => {
    const plan = buildTodayPlan<TodayItem, TodayDrill>({
      budget: 20,
      sections: [
        { id: 'vocab', candidates: [vocab(w1, 'due'), vocab(w2, 'weak'), vocab(w3, 'new')] },
        {
          id: 'forms',
          candidates: [
            {
              id: 'f',
              tier: 'weak',
              seconds: 30,
              payload: { kind: 'forms', table: verb, blankIds: verbIds.slice(0, 2) },
            },
          ],
        },
      ],
    });
    const steps = planSteps(plan);
    expect(steps.map((s) => s.label)).toEqual(['Vocabulary', 'Paradigm forms']);
    expect(steps[0]).toMatchObject({ mode: 'srs', words: [w1] });
    expect(steps[1]).toMatchObject({ rounds: [{ practice: true }] });
  });

  it('makes the ladder a Full-table write and mixed review practice', () => {
    const ladder = planSteps(
      buildTodayPlan<TodayItem, TodayDrill>({
        budget: 20,
        sections: [],
        drill: { id: 'ladder', seconds: 60, payload: { kind: 'ladder', table: rung } },
      }),
    );
    expect(ladder).toHaveLength(1);
    const all = getQuizCells(rung).flatMap((c) => (c.id ? [c.id] : []));
    expect(ladder[0]).toMatchObject({
      kind: 'forms',
      section: 'drill',
      label: 'Drill: Suffix ladder',
      rounds: [{ blankIds: all, practice: false }],
    });

    const mixed = planSteps(
      buildTodayPlan<TodayItem, TodayDrill>({
        budget: 20,
        sections: [],
        drill: {
          id: 'mixed',
          seconds: 60,
          payload: { kind: 'mixed', rounds: [{ table: verb, blankIds: verbIds.slice(0, 3) }] },
        },
      }),
    );
    expect(mixed[0]).toMatchObject({ section: 'drill', rounds: [{ practice: true }] });
  });
});
