import { describe, expect, it } from 'vitest';
import {
  buildTodayPlan,
  type Candidate,
  canStartNext,
  createActiveClock,
  formatMinutes,
  isTimeBudget,
  OVERRUN_ALLOWANCE,
  planTierCounts,
  summarizeSession,
  type Tier,
} from './today';

const c = (id: string, tier: Tier, seconds = 60): Candidate<null> => ({
  id,
  tier,
  seconds,
  payload: null,
});

const ids = (plan: { sections: { id: string; items: { id: string }[] }[] }) =>
  Object.fromEntries(plan.sections.map((s) => [s.id, s.items.map((i) => i.id)]));

describe('buildTodayPlan', () => {
  it('takes everything when it all fits, in tier order within each section', () => {
    const plan = buildTodayPlan({
      budget: 20,
      sections: [
        { id: 'vocab', candidates: [c('n1', 'new'), c('d1', 'due'), c('w1', 'weak')] },
        { id: 'forms', candidates: [c('d2', 'due')] },
      ],
    });
    expect(ids(plan)).toEqual({ vocab: ['d1', 'w1', 'n1'], forms: ['d2'] });
    expect(plan.plannedSeconds).toBe(240);
    expect(plan.leftOut).toEqual({ due: 0, weak: 0, new: 0 });
  });

  it('never plans past the budget', () => {
    const many = Array.from({ length: 100 }, (_, i) => c(`d${i}`, 'due', 45));
    for (const budget of [20, 45, 90] as const) {
      const plan = buildTodayPlan({ budget, sections: [{ id: 'v', candidates: many }] });
      expect(plan.plannedSeconds).toBeLessThanOrEqual(budget * 60);
    }
  });

  it('reserves the drill first', () => {
    const many = Array.from({ length: 30 }, (_, i) => c(`d${i}`, 'due', 60));
    const plan = buildTodayPlan({
      budget: 20,
      sections: [{ id: 'v', candidates: many }],
      drill: { id: 'accent', seconds: 300, payload: 'x' },
    });
    expect(plan.drill?.id).toBe('accent');
    expect(plan.sections[0].items).toHaveLength(15);
    expect(plan.plannedSeconds).toBe(1200);
    expect(plan.leftOut.due).toBe(15);
  });

  it('drops a drill longer than the whole budget', () => {
    const plan = buildTodayPlan({
      budget: 20,
      sections: [],
      drill: { id: 'big', seconds: 2000, payload: null },
    });
    expect(plan.drill).toBeNull();
    expect(plan.plannedSeconds).toBe(0);
  });

  it('gives lower tiers nothing once a higher tier is left out', () => {
    const plan = buildTodayPlan({
      budget: 20,
      sections: [
        {
          id: 'v',
          candidates: [
            ...Array.from({ length: 25 }, (_, i) => c(`d${i}`, 'due', 60)),
            c('n1', 'new', 1),
          ],
        },
      ],
    });
    expect(plan.sections[0].items.every((i) => i.tier === 'due')).toBe(true);
    expect(plan.leftOut).toEqual({ due: 5, weak: 0, new: 1 });
  });

  it('still fits a smaller item of the same tier after a big one is skipped', () => {
    const plan = buildTodayPlan({
      budget: 20,
      sections: [{ id: 'v', candidates: [c('big', 'due', 1300), c('small', 'due', 30)] }],
    });
    expect(ids(plan).v).toEqual(['small']);
    expect(plan.leftOut.due).toBe(1);
  });

  it('shares a tier between sections by time spent', () => {
    const plan = buildTodayPlan({
      budget: 20,
      sections: [
        { id: 'vocab', candidates: Array.from({ length: 200 }, (_, i) => c(`v${i}`, 'due', 10)) },
        { id: 'forms', candidates: Array.from({ length: 50 }, (_, i) => c(`f${i}`, 'due', 60)) },
      ],
    });
    const [vocab, forms] = plan.sections;
    const vocabTime = vocab.items.length * 10;
    const formsTime = forms.items.length * 60;
    expect(Math.abs(vocabTime - formsTime)).toBeLessThanOrEqual(60);
  });

  it('caps new candidates per section without counting the cap as left out', () => {
    const plan = buildTodayPlan({
      budget: 90,
      sections: [
        {
          id: 'v',
          candidates: Array.from({ length: 50 }, (_, i) => c(`n${i}`, 'new', 10)),
          maxNew: 5,
        },
      ],
    });
    expect(plan.sections[0].items).toHaveLength(5);
    expect(plan.leftOut.new).toBe(0);
  });

  it('counts planned items by tier', () => {
    const plan = buildTodayPlan({
      budget: 20,
      sections: [
        { id: 'a', candidates: [c('1', 'due'), c('2', 'new')] },
        { id: 'b', candidates: [c('3', 'weak'), c('4', 'due')] },
      ],
    });
    expect(planTierCounts(plan)).toEqual({ due: 2, weak: 1, new: 1 });
  });
});

describe('canStartNext', () => {
  it('allows an item that ends inside the allowance', () => {
    expect(canStartNext(0, 60, 20)).toBe(true);
    expect(canStartNext(19 * 60_000, 120, 20)).toBe(true);
  });

  it('refuses once the budget is used', () => {
    expect(canStartNext(20 * 60_000, 1, 20)).toBe(false);
  });

  it('refuses an item that would end past the allowance', () => {
    const limit = 20 * 60 * (1 + OVERRUN_ALLOWANCE);
    expect(canStartNext(19 * 60_000, limit - 19 * 60 + 1, 20)).toBe(false);
  });
});

describe('createActiveClock', () => {
  it('counts only while running', () => {
    let t = 1000;
    const clock = createActiveClock(() => t);
    expect(clock.elapsedMs()).toBe(0);
    clock.start();
    expect(clock.running).toBe(true);
    t += 500;
    expect(clock.elapsedMs()).toBe(500);
    clock.pause();
    t += 10_000;
    expect(clock.elapsedMs()).toBe(500);
    clock.start();
    clock.start(); // a second start does not reset the lap
    t += 250;
    expect(clock.elapsedMs()).toBe(750);
    clock.pause();
    clock.pause();
    expect(clock.running).toBe(false);
    expect(clock.elapsedMs()).toBe(750);
  });
});

describe('summarizeSession', () => {
  it('counts each item once, by its first outcome', () => {
    const s = summarizeSession([
      { section: 'vocab', id: 'a', correct: false },
      { section: 'vocab', id: 'a', correct: true },
      { section: 'vocab', id: 'b', correct: true },
      { section: 'forms', id: 'a', correct: false },
    ]);
    expect(s.reviewed).toBe(3);
    expect(s.missed).toBe(2);
    expect(s.bySection).toEqual({
      vocab: { reviewed: 2, missed: 1 },
      forms: { reviewed: 1, missed: 1 },
    });
    expect(s.missedIds).toEqual({ vocab: ['a'], forms: ['a'] });
  });

  it('is empty for no outcomes', () => {
    expect(summarizeSession([])).toEqual({ reviewed: 0, missed: 0, bySection: {}, missedIds: {} });
  });
});

describe('helpers', () => {
  it('recognises the budgets', () => {
    expect(isTimeBudget(20)).toBe(true);
    expect(isTimeBudget(30)).toBe(false);
    expect(isTimeBudget('20')).toBe(false);
  });

  it('rounds minutes up', () => {
    expect(formatMinutes(0)).toBe('1 minute');
    expect(formatMinutes(61)).toBe('2 minutes');
    expect(formatMinutes(1200)).toBe('20 minutes');
  });
});
