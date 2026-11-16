import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ParseFeedbackRow,
  ParseProgress,
  ParseResults,
  ParseSelect,
  ParseVerdict,
  SessionLengthPicker,
  ToggleChip,
} from './ParseDrill';

describe('ParseProgress', () => {
  it('counts from one and fills to the forms already answered', () => {
    render(<ParseProgress index={3} total={10} />);
    expect(screen.getByText('4 / 10')).toBeTruthy();
    expect(screen.getByTestId('parse-progress').style.width).toBe('30%');
  });

  it('draws an empty bar for an empty session', () => {
    render(<ParseProgress index={0} total={0} />);
    expect(screen.getByTestId('parse-progress').style.width).toBe('0%');
  });
});

describe('ParseSelect', () => {
  it('is labelled, offers every choice, and reports the one picked', async () => {
    const onChange = vi.fn();
    render(
      <ParseSelect
        label="Stem"
        value=""
        options={['qal', 'piel']}
        labels={{ qal: 'Qal', piel: 'Piel' }}
        onChange={onChange}
      />,
    );
    const select = screen.getByLabelText('Stem');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '— select —',
      'Qal',
      'Piel',
    ]);
    await userEvent.selectOptions(select, 'piel');
    expect(onChange).toHaveBeenCalledWith('piel');
  });
});

describe('ParseFeedbackRow and ParseVerdict', () => {
  it('shows only what was chosen when right', () => {
    render(<ParseFeedbackRow property="Stem" correct given="Qal" expected="Qal" />);
    expect(screen.getByText('Qal')).toBeTruthy();
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('strikes the choice through and names the answer on a miss', () => {
    render(<ParseFeedbackRow property="Stem" correct={false} given="Piel" expected="Qal" />);
    expect(screen.getByText('Piel').style.textDecoration).toBe('line-through');
    expect(screen.getByText('Qal')).toBeTruthy();
    expect(screen.getByText('✗')).toBeTruthy();
  });

  it('gives the verdict', () => {
    const { rerender } = render(<ParseVerdict correct />);
    expect(screen.getByRole('status').textContent).toContain('Correct!');
    rerender(<ParseVerdict correct={false} />);
    expect(screen.getByRole('status').textContent).toContain('Not quite');
  });
});

describe('settings controls', () => {
  it('ToggleChip says whether it is on', async () => {
    const onClick = vi.fn();
    render(<ToggleChip label="Qal" active onClick={onClick} />);
    const chip = screen.getByRole('button', { name: 'Qal' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalled();
  });

  it('SessionLengthPicker offers 10, 20 and 30', async () => {
    const onChange = vi.fn();
    render(<SessionLengthPicker value={20} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '20' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: '30' }));
    expect(onChange).toHaveBeenCalledWith(30);
  });
});

describe('ParseResults', () => {
  const properties = [
    { key: 'stem', label: 'Stem' },
    { key: 'person', label: 'Person' },
  ];

  it('scores the session and each field over the forms that asked it', () => {
    const results = [
      { allCorrect: true, stem: true, person: true },
      { allCorrect: false, stem: false },
    ];
    render(
      <ParseResults
        sessionResults={{ results, total: 2 }}
        properties={properties}
        onRetry={vi.fn()}
        onChangeSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Session Score')).toBeTruthy();
    // The hero and the Stem row; Person was asked of one form only.
    expect(screen.getAllByText('1/2')).toHaveLength(2);
    expect(screen.getByText('50% correct')).toBeTruthy();
    expect(screen.getByText('1/1')).toBeTruthy();
  });

  it('wires its buttons, and offers a review only when something was missed', async () => {
    const onRetry = vi.fn();
    const onChangeSettings = vi.fn();
    const onReviewMissed = vi.fn();
    render(
      <ParseResults
        sessionResults={{ results: [{ allCorrect: false }], total: 1 }}
        properties={properties}
        onRetry={onRetry}
        onChangeSettings={onChangeSettings}
        onReviewMissed={onReviewMissed}
        isReview
      />,
    );
    expect(screen.getByText('Review: Missed Verbs (1)')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await userEvent.click(screen.getByRole('button', { name: 'Change Settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'Review Missed (1)' }));
    expect([onRetry, onChangeSettings, onReviewMissed].every((f) => f.mock.calls.length)).toBe(
      true,
    );
  });
});
