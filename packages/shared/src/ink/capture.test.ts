import { describe, expect, it } from 'vitest';
import {
  CONSTANT_PRESSURE,
  InkCapture,
  MIN_PEN_PRESSURE,
  normalizePressure,
  type PointerSample,
} from './capture';

/**
 * Smoothing is disabled throughout: these tests are about which pointers are
 * allowed to draw, not about filter response, and a filter between the input
 * and the assertion would make coordinates approximate for no benefit.
 */
function capture() {
  return new InkCapture({ smoothing: false });
}

let nextTime = 0;
function sample(overrides: Partial<PointerSample> = {}): PointerSample {
  nextTime += 8;
  return {
    pointerId: 1,
    pointerType: 'pen',
    x: 0,
    y: 0,
    pressure: 0.5,
    timestamp: nextTime,
    ...overrides,
  };
}

describe('palm rejection', () => {
  it('lets touch draw on a device that has never seen a pen', () => {
    const c = capture();
    expect(c.begin(sample({ pointerType: 'touch' }))).toBe('started');
  });

  it('refuses touch once a pen has been seen', () => {
    const c = capture();
    c.begin(sample({ pointerType: 'pen' }));
    c.end();

    expect(c.hasSeenPen).toBe(true);
    expect(c.begin(sample({ pointerType: 'touch', pointerId: 2 }))).toBe('rejected');
    expect(c.isDrawing).toBe(false);
  });

  it('latches: touch stays refused for the rest of the session', () => {
    const c = capture();
    c.begin(sample({ pointerType: 'pen' }));
    c.end();
    c.begin(sample({ pointerType: 'mouse', pointerId: 3 }));
    c.end();

    expect(c.begin(sample({ pointerType: 'touch', pointerId: 4 }))).toBe('rejected');
  });

  it('lets the pen preempt a stroke a resting palm already started', () => {
    // The realistic sequence when writing right-to-left: the hand lands
    // first, the stylus follows a moment later.
    const c = capture();
    c.begin(sample({ pointerType: 'touch', pointerId: 9, x: 5, y: 5 }));
    c.extend(sample({ pointerType: 'touch', pointerId: 9, x: 40, y: 40 }));

    expect(c.begin(sample({ pointerType: 'pen', pointerId: 1, x: 100, y: 100 }))).toBe('preempted');

    // The palm's marks are gone, not merged into the pen's stroke.
    const stroke = c.end();
    expect(stroke?.points).toHaveLength(1);
    expect(stroke?.points[0]).toMatchObject({ x: 100, y: 100 });
  });

  it('always accepts a mouse, which cannot be a palm', () => {
    const c = capture();
    c.begin(sample({ pointerType: 'pen' }));
    c.end();
    expect(c.begin(sample({ pointerType: 'mouse', pointerId: 7 }))).toBe('started');
  });

  it('ignores a second pointer of the same kind while drawing', () => {
    const c = capture();
    c.begin(sample({ pointerType: 'touch', pointerId: 1 }));
    expect(c.begin(sample({ pointerType: 'touch', pointerId: 2 }))).toBe('rejected');
  });

  it('reports shouldAccept consistently with begin', () => {
    const c = capture();
    expect(c.shouldAccept('touch')).toBe(true);
    c.begin(sample({ pointerType: 'pen' }));
    c.end();
    expect(c.shouldAccept('touch')).toBe(false);
    expect(c.shouldAccept('pen')).toBe(true);
    expect(c.shouldAccept('mouse')).toBe(true);
  });
});

describe('stroke assembly', () => {
  it('collects samples into a stroke and clears state on end', () => {
    const c = capture();
    c.begin(sample({ x: 0, y: 0 }));
    c.extend(sample({ x: 10, y: 0 }));
    c.extend([sample({ x: 20, y: 0 }), sample({ x: 30, y: 0 })]);

    expect(c.isDrawing).toBe(true);
    const stroke = c.end(sample({ x: 40, y: 0 }));

    expect(stroke?.points.map(p => p.x)).toEqual([0, 10, 20, 30, 40]);
    expect(c.isDrawing).toBe(false);
    expect(c.liveStroke).toBeNull();
  });

  it('ignores samples from a pointer that is not the active one', () => {
    // This is what stops a resting palm from dragging the pen's line across
    // the page mid-stroke.
    const c = capture();
    c.begin(sample({ pointerId: 1, x: 0, y: 0 }));
    c.extend(sample({ pointerId: 2, x: 500, y: 500 }));
    c.extend(sample({ pointerId: 1, x: 10, y: 0 }));

    expect(c.end()?.points.map(p => p.x)).toEqual([0, 10]);
  });

  it('drops samples too close to the previous one', () => {
    const c = capture();
    c.begin(sample({ x: 0, y: 0 }));
    c.extend(sample({ x: 0.01, y: 0 }));
    c.extend(sample({ x: 5, y: 0 }));

    expect(c.end()?.points).toHaveLength(2);
  });

  it('records time relative to the start of the stroke', () => {
    const c = capture();
    c.begin(sample({ x: 0, y: 0, timestamp: 1000 }));
    c.extend(sample({ x: 10, y: 0, timestamp: 1016 }));

    const stroke = c.end();
    expect(stroke?.points[0].t).toBe(0);
    expect(stroke?.points[1].t).toBe(16);
  });

  it('clamps a coalesced sample timestamped before pointerdown', () => {
    const c = capture();
    c.begin(sample({ x: 0, y: 0, timestamp: 1000 }));
    c.extend(sample({ x: 10, y: 0, timestamp: 995 }));
    expect(c.end()?.points[1].t).toBe(0);
  });

  it('exposes the in-progress stroke as a copy', () => {
    const c = capture();
    c.begin(sample({ x: 1, y: 1 }));
    const live = c.liveStroke;
    live?.points.push({ x: 99, y: 99, pressure: 1, t: 0 });

    expect(c.liveStroke?.points).toHaveLength(1);
  });

  it('returns null from end and extends nothing when idle', () => {
    const c = capture();
    expect(c.end()).toBeNull();
    c.extend(sample());
    expect(c.liveStroke).toBeNull();
  });

  it('ignores end from a different pointer', () => {
    const c = capture();
    c.begin(sample({ pointerId: 1 }));
    expect(c.end(sample({ pointerId: 2 }))).toBeNull();
    expect(c.isDrawing).toBe(true);
  });

  it('discards the stroke on cancel', () => {
    const c = capture();
    c.begin(sample({ x: 0, y: 0 }));
    c.extend(sample({ x: 20, y: 0 }));
    c.cancel();

    expect(c.isDrawing).toBe(false);
    expect(c.end()).toBeNull();
  });
});

describe('normalizePressure', () => {
  it('passes real pen pressure through', () => {
    expect(normalizePressure('pen', 0.72)).toBeCloseTo(0.72, 6);
  });

  it('floors pen pressure so a stroke never starts invisible', () => {
    expect(normalizePressure('pen', 0)).toBe(MIN_PEN_PRESSURE);
  });

  it('clamps pen pressure above 1', () => {
    expect(normalizePressure('pen', 1.5)).toBe(1);
  });

  it('pins non-pen pointers to a constant so width does not flicker', () => {
    expect(normalizePressure('mouse', 0)).toBe(CONSTANT_PRESSURE);
    expect(normalizePressure('touch', 1)).toBe(CONSTANT_PRESSURE);
  });

  it('falls back to the constant for a non-finite reading', () => {
    expect(normalizePressure('pen', Number.NaN)).toBe(CONSTANT_PRESSURE);
  });

  it('is applied to captured points', () => {
    const c = capture();
    c.begin(sample({ pointerType: 'mouse', pressure: 0, x: 0 }));
    c.extend(sample({ pointerType: 'mouse', pressure: 0, x: 10 }));
    expect(c.end()?.points.every(p => p.pressure === CONSTANT_PRESSURE)).toBe(true);
  });
});

describe('smoothing', () => {
  it('is on by default and moves samples toward the previous point', () => {
    const c = new InkCapture();
    c.begin(sample({ x: 0, y: 0 }));
    c.extend(sample({ x: 100, y: 0 }));

    const x = c.end()?.points[1].x ?? 0;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(100);
  });
});
