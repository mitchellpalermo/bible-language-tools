import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RuleFeedback, STATUS_COLOR, StepList, stepStatus } from './StepDrill';

describe('stepStatus', () => {
  it('reads each step off the drill state', () => {
    const firstTry = [true, false];
    expect(stepStatus(0, 2, firstTry, 0)).toBe('done');
    expect(stepStatus(1, 2, firstTry, 0)).toBe('missed');
    expect(stepStatus(2, 2, firstTry, 0)).toBe('open');
    expect(stepStatus(3, 2, firstTry, 0)).toBe('locked');
  });

  it('marks steps before the start as skipped, and offsets the record', () => {
    expect(stepStatus(0, 3, [], 3)).toBe('skipped');
    expect(stepStatus(3, 4, [true], 3)).toBe('done');
  });
});

describe('StepList', () => {
  it('shows every step, locked ones included, with the open one current', () => {
    render(<StepList labels={['One', 'Two', 'Three']} current={1} firstTry={[true]} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.dataset.status)).toEqual(['done', 'open', 'locked']);
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[2].getAttribute('aria-label')).toMatch(/Step 3, Three: locked/);
  });

  it('shows skipped steps in speed mode', () => {
    render(<StepList labels={['One', 'Two']} current={1} firstTry={[]} startAt={1} />);
    expect(screen.getAllByRole('listitem')[0].dataset.status).toBe('skipped');
  });

  it('marks a step that needed a second try', () => {
    render(<StepList labels={['One', 'Two']} current={2} firstTry={[false, true]} />);
    expect(screen.getAllByRole('listitem')[0].getAttribute('aria-label')).toMatch(
      /done after a miss/,
    );
  });

  it('gives every colour token a literal fallback', () => {
    for (const color of Object.values(STATUS_COLOR)) {
      expect(color).toMatch(/^var\(--[\w-]+, #[0-9A-F]{6}\)$/i);
    }
  });
});

describe('RuleFeedback', () => {
  const rules = [
    { id: 'a', name: 'Rule A', text: 'Explained.', href: '/grammar#a' },
    { id: 'b', name: 'Rule B', text: 'No link.' },
  ];

  it('names each rule and links to where it is taught', () => {
    render(<RuleFeedback rules={rules} />);
    expect(screen.getByRole('status', { name: 'Not quite' })).toBeTruthy();
    expect(screen.getByText('Rule A.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Review this rule' }).getAttribute('href')).toBe(
      '/grammar#a',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders nothing with no rules', () => {
    const { container } = render(<RuleFeedback rules={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('takes a heading, tone and link label', () => {
    render(<RuleFeedback rules={rules} heading="Nice" tone="pass" linkLabel="Read more" />);
    expect(screen.getByRole('status', { name: 'Nice' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Read more' })).toBeTruthy();
  });
});
