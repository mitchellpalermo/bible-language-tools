import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stroke } from '../stroke';
import InkCanvas from './InkCanvas';

/**
 * Dispatch a pointer event with the fields the surface reads.
 *
 * Built from a plain `Event` rather than `new PointerEvent(...)`: the
 * constructor is not available in every headless DOM, and the component only
 * ever reads these properties. Notably `getCoalescedEvents` is absent here,
 * which exercises the single-sample fallback path.
 */
function firePointer(
  el: Element,
  type: string,
  init: { x?: number; y?: number; pointerId?: number; pointerType?: string; pressure?: number } = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'pen',
    clientX: init.x ?? 0,
    clientY: init.y ?? 0,
    pressure: init.pressure ?? 0.5,
  });
  el.dispatchEvent(event);
}

/** Draw a straight horizontal stroke: down, two moves, up. */
function drawLine(el: Element, opts: { pointerType?: string; pointerId?: number } = {}) {
  firePointer(el, 'pointerdown', { ...opts, x: 10, y: 10 });
  firePointer(el, 'pointermove', { ...opts, x: 60, y: 10 });
  firePointer(el, 'pointermove', { ...opts, x: 110, y: 10 });
  firePointer(el, 'pointerup', { ...opts, x: 160, y: 10 });
}

function setup(props: Partial<React.ComponentProps<typeof InkCanvas>> = {}) {
  const onStrokeComplete = vi.fn<(s: Stroke) => void>();
  const onPenDetected = vi.fn();
  render(
    <InkCanvas
      strokes={[]}
      onStrokeComplete={onStrokeComplete}
      onPenDetected={onPenDetected}
      {...props}
    />,
  );
  return { canvas: screen.getByLabelText('Writing surface'), onStrokeComplete, onPenDetected };
}

describe('InkCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a labelled surface', () => {
    const { canvas } = setup();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('turns a pen gesture into one completed stroke', () => {
    const { canvas, onStrokeComplete } = setup();
    drawLine(canvas);

    expect(onStrokeComplete).toHaveBeenCalledTimes(1);
    const stroke = onStrokeComplete.mock.calls[0][0];
    expect(stroke.points).toHaveLength(4);

    // Smoothing moves the samples, so assert the shape rather than exact
    // coordinates: the stroke must run left to right at a constant height.
    const xs = stroke.points.map(p => p.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    // `toBeCloseTo`, not `===`: the filter computes `a * value + (1 - a) * prev`,
    // and for a constant y that is 10 in real arithmetic but lands a ULP either
    // side of it in floating point for ~8% of the timestamp deltas a DOM happens
    // to produce. Exact equality made this pass locally and fail in CI.
    for (const p of stroke.points) expect(p.y).toBeCloseTo(10, 6);
  });

  it('reports the first stylus contact', () => {
    const { canvas, onPenDetected } = setup();
    firePointer(canvas, 'pointerdown', { pointerType: 'pen' });
    expect(onPenDetected).toHaveBeenCalledTimes(1);

    firePointer(canvas, 'pointerup', { pointerType: 'pen' });
    firePointer(canvas, 'pointerdown', { pointerType: 'pen' });
    expect(onPenDetected).toHaveBeenCalledTimes(1);
  });

  it('lets a finger draw on a device that has never seen a stylus', () => {
    const { canvas, onStrokeComplete } = setup();
    drawLine(canvas, { pointerType: 'touch' });
    expect(onStrokeComplete).toHaveBeenCalledTimes(1);
  });

  it('ignores touch once a stylus has been used', () => {
    // The palm-rejection guarantee, end to end: a hand resting on the glass
    // must not leave a mark.
    const { canvas, onStrokeComplete } = setup();
    drawLine(canvas, { pointerType: 'pen' });
    expect(onStrokeComplete).toHaveBeenCalledTimes(1);

    drawLine(canvas, { pointerType: 'touch', pointerId: 2 });
    expect(onStrokeComplete).toHaveBeenCalledTimes(1);
  });

  it('discards a stroke on pointercancel', () => {
    const { canvas, onStrokeComplete } = setup();
    firePointer(canvas, 'pointerdown', { x: 10, y: 10 });
    firePointer(canvas, 'pointermove', { x: 60, y: 10 });
    firePointer(canvas, 'pointercancel', { x: 60, y: 10 });

    expect(onStrokeComplete).not.toHaveBeenCalled();
  });

  it('ignores movement with no pointer down', () => {
    const { canvas, onStrokeComplete } = setup();
    firePointer(canvas, 'pointermove', { x: 60, y: 10 });
    firePointer(canvas, 'pointerup', { x: 60, y: 10 });

    expect(onStrokeComplete).not.toHaveBeenCalled();
  });

  it('accepts committed strokes and a reference glyph without a canvas context', () => {
    // happy-dom has no 2D context. The draw path must no-op rather than throw,
    // which is also what protects the app in a browser that blocks canvas.
    const strokes: Stroke[] = [{ points: [{ x: 0, y: 0, pressure: 0.5, t: 0 }] }];
    expect(() =>
      setup({
        strokes,
        reference: { text: 'א', fontFamily: 'serif', opacity: 0.2 },
        fontLoadSpec: '400 64px "Noto Sans Hebrew"',
      }),
    ).not.toThrow();
  });

  it('applies the touch-action and selection guards Safari needs', () => {
    // Without these a stroke scrolls the page or raises the callout menu.
    const { canvas } = setup();
    expect(canvas.getAttribute('style')).toContain('touch-action: none');
    expect(canvas.getAttribute('style')).toContain('overscroll-behavior: contain');
  });
});
