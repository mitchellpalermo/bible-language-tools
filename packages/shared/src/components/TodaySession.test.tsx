import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BudgetPicker, SessionSummaryCard } from './TodaySession';

describe('BudgetPicker', () => {
  it('marks the chosen budget and reports a new one', async () => {
    const onChange = vi.fn();
    render(<BudgetPicker value={45} onChange={onChange} accent="#15803D" />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    await userEvent.click(screen.getByRole('radio', { name: /90/ }));
    expect(onChange).toHaveBeenCalledWith(90);
  });
});

describe('SessionSummaryCard', () => {
  it('shows the totals, the rows and the streak', () => {
    render(
      <SessionSummaryCard
        rows={[
          { label: 'Vocabulary', reviewed: 12, missed: 2 },
          { label: 'Paradigm forms', reviewed: 8, missed: 1 },
        ]}
        reviewed={20}
        missed={3}
        dueTomorrow={14}
        streak={1}
        accent="#15803D"
        note="Time was up"
      />,
    );
    const summary = screen.getByRole('region', { name: 'Session summary' });
    const text = summary.textContent ?? '';
    expect(text).toContain('20reviewed');
    expect(text).toContain('3missed');
    expect(text).toContain('14due tomorrow');
    expect(screen.getByRole('row', { name: /Vocabulary 12 2/ })).toBeTruthy();
    expect(text).toContain('Study streak: 1 day · Time was up');
  });

  it('pluralises the streak and omits an empty table', () => {
    render(
      <SessionSummaryCard
        rows={[]}
        reviewed={0}
        missed={0}
        dueTomorrow={0}
        streak={3}
        accent="#15803D"
      />,
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/3 days/)).toBeTruthy();
  });
});
