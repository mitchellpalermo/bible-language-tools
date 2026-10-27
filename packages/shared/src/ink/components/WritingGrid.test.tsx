import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Stroke } from '../stroke';
import WritingGrid, { type WritingGridCell } from './WritingGrid';

function cell(text: string, over: Partial<WritingGridCell> = {}): WritingGridCell {
  return { text, strokes: [], score: null, ...over };
}

/** דָּבָר, already split into its three consonant clusters. */
const DAVAR = [cell('דָּ'), cell('בָ'), cell('ר')];

const line: Stroke = {
  points: [
    { x: 10, y: 10, pressure: 0.5, t: 0 },
    { x: 40, y: 40, pressure: 0.5, t: 16 },
  ],
};

function setup(props: Partial<React.ComponentProps<typeof WritingGrid>> = {}) {
  const onSelect = vi.fn<(i: number) => void>();
  const view = render(<WritingGrid cells={DAVAR} active={null} onSelect={onSelect} {...props} />);
  return { onSelect, view };
}

describe('WritingGrid', () => {
  it('renders one box per consonant cluster', () => {
    setup();

    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('fills right-to-left for Hebrew without reversing the cells', () => {
    // The container's `dir` does the reversing. Reversing the array as well
    // would render the word backwards — and would break again the moment this
    // sat inside another RTL element.
    const { view } = setup({ direction: 'rtl' });
    const group = view.container.querySelector('.ink-grid');

    expect(group?.getAttribute('dir')).toBe('rtl');
    // First box in DOM order is still the first letter written.
    expect(screen.getAllByRole('button')[0].getAttribute('aria-label')).toContain('Box 1');
  });

  it('honours a left-to-right script', () => {
    // The grid is language-agnostic; greek.tools inherits it (#105).
    const { view } = setup({ direction: 'ltr' });

    expect(view.container.querySelector('.ink-grid')?.getAttribute('dir')).toBe('ltr');
  });

  it('reports which box was tapped', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    await user.click(screen.getAllByRole('button')[1]);

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('marks the bound box as pressed, and only that one', () => {
    setup({ active: 2 });
    const boxes = screen.getAllByRole('button');

    expect(boxes[2].getAttribute('aria-pressed')).toBe('true');
    expect(boxes[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('says in the accessible name whether a box has been written', () => {
    // A row of identical boxes is unusable without this — the score is rendered
    // as a bare number, which tells a screen reader nothing about which box.
    setup({ cells: [cell('דָּ', { score: 91 }), cell('בָ'), cell('ר')] });
    const boxes = screen.getAllByRole('button');

    expect(boxes[0].getAttribute('aria-label')).toContain('scored 91');
    expect(boxes[1].getAttribute('aria-label')).toContain('not yet written');
  });

  it('shows a score once a box has one, and nothing before', () => {
    setup({ cells: [cell('דָּ', { score: 91 }), cell('בָ'), cell('ר')] });

    expect(screen.getByText('91')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('separates a passing box from a close one and a miss', () => {
    // Asserted on `data-verdict` rather than the colour: the colours are CSS
    // custom properties that happy-dom does not resolve, and the verdict is the
    // claim anyway — the colour is how it is shown.
    const { view } = setup({
      cells: [cell('דָּ', { score: 91 }), cell('בָ', { score: 70 }), cell('ר', { score: 30 })],
    });
    const verdicts = [...view.container.querySelectorAll('.ink-grid__score')].map((s) =>
      s.getAttribute('data-verdict'),
    );

    expect(verdicts).toEqual(['pass', 'close', 'miss']);
  });

  it('shows the target letter only when asked', () => {
    const { view } = setup({ showReference: true });

    expect(view.container.querySelectorAll('.ink-grid__ghost')).toHaveLength(3);
    expect(
      render(
        <WritingGrid cells={DAVAR} active={null} onSelect={() => {}} />,
      ).container.querySelectorAll('.ink-grid__ghost'),
    ).toHaveLength(0);
  });

  it('renders a box with ink without a canvas context', () => {
    // happy-dom has no 2D context. The thumbnail must degrade to an empty
    // canvas rather than throwing — a missing renderer is not a reason to stop
    // the session, the same rule `rasterizeGlyph` follows.
    expect(() =>
      setup({ cells: [cell('דָּ', { strokes: [line], score: 88 }), cell('בָ'), cell('ר')] }),
    ).not.toThrow();
  });

  it('gives a repeated letter its own box rather than collapsing the two', () => {
    // הַלְלוּ repeats the lamed. Keyed by text, the two would be one box.
    setup({ cells: [cell('לְ'), cell('לוּ')] });

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
