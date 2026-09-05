import { describe, expect, it } from 'vitest';
import { appendStroke, appendStrokes, type PathSink, segmentQuad, widthAt } from './render';
import type { InkPoint, Stroke } from './stroke';

type Arg = number | boolean | undefined;

type Call =
  | { op: 'moveTo'; args: Arg[] }
  | { op: 'lineTo'; args: Arg[] }
  | { op: 'arc'; args: Arg[] }
  | { op: 'closePath'; args: Arg[] };

/**
 * Records path operations instead of drawing them.
 *
 * `appendStroke` writes to this interface rather than a canvas context
 * precisely so the geometry can be asserted without a canvas implementation —
 * happy-dom has none.
 */
class RecordingSink implements PathSink {
  calls: Call[] = [];
  moveTo(x: number, y: number) {
    this.calls.push({ op: 'moveTo', args: [x, y] });
  }
  lineTo(x: number, y: number) {
    this.calls.push({ op: 'lineTo', args: [x, y] });
  }
  arc(x: number, y: number, r: number, s: number, e: number, ccw?: boolean) {
    this.calls.push({ op: 'arc', args: [x, y, r, s, e, ccw] });
  }
  closePath() {
    this.calls.push({ op: 'closePath', args: [] });
  }
  count(op: Call['op']) {
    return this.calls.filter((c) => c.op === op).length;
  }
}

function point(x: number, y: number, pressure = 0.5): InkPoint {
  return { x, y, pressure, t: 0 };
}

function strokeOf(coords: [number, number][], pressure = 0.5): Stroke {
  return { points: coords.map(([x, y]) => point(x, y, pressure)) };
}

describe('widthAt', () => {
  it('interpolates between the min and max width', () => {
    expect(widthAt(0, { minWidth: 2, maxWidth: 10 })).toBe(2);
    expect(widthAt(1, { minWidth: 2, maxWidth: 10 })).toBe(10);
    expect(widthAt(0.5, { minWidth: 2, maxWidth: 10 })).toBe(6);
  });

  it('clamps out-of-range and non-finite pressure', () => {
    expect(widthAt(-1, { minWidth: 2, maxWidth: 10 })).toBe(2);
    expect(widthAt(5, { minWidth: 2, maxWidth: 10 })).toBe(10);
    expect(widthAt(Number.NaN, { minWidth: 2, maxWidth: 10 })).toBe(2);
  });

  it('has defaults, so a stroke drawn with no options still has width', () => {
    expect(widthAt(0.5)).toBeGreaterThan(0);
  });
});

describe('segmentQuad', () => {
  it('offsets corners along the segment normal', () => {
    const quad = segmentQuad(point(0, 0), point(10, 0), 2, 2);
    expect(quad).toEqual([
      [0, 1],
      [10, 1],
      [10, -1],
      [0, -1],
    ]);
  });

  it('tapers when the two ends have different widths', () => {
    const quad = segmentQuad(point(0, 0), point(10, 0), 2, 6);
    expect(quad?.[0][1]).toBeCloseTo(1, 6);
    expect(quad?.[1][1]).toBeCloseTo(3, 6);
  });

  it('returns null for coincident points, which have no normal', () => {
    expect(segmentQuad(point(5, 5), point(5, 5), 2, 2)).toBeNull();
  });
});

describe('appendStroke', () => {
  it('draws a dot as a single circle', () => {
    // Several nikud and the shin/sin dots are exactly one tap.
    const sink = new RecordingSink();
    appendStroke(sink, strokeOf([[5, 5]]));

    expect(sink.count('arc')).toBe(1);
    expect(sink.count('closePath')).toBe(0);
    expect(sink.calls.find((c) => c.op === 'arc')?.args.slice(0, 2)).toEqual([5, 5]);
  });

  it('emits a closed quad plus a cap at each end for one segment', () => {
    const sink = new RecordingSink();
    appendStroke(
      sink,
      strokeOf([
        [0, 0],
        [10, 0],
      ]),
    );

    expect(sink.count('closePath')).toBe(1);
    expect(sink.count('lineTo')).toBe(3);
    expect(sink.count('arc')).toBe(2);
  });

  it('adds one quad per segment and one joint circle per point', () => {
    const sink = new RecordingSink();
    appendStroke(
      sink,
      strokeOf([
        [0, 0],
        [10, 0],
        [20, 0],
        [30, 0],
      ]),
    );

    expect(sink.count('closePath')).toBe(3);
    expect(sink.count('arc')).toBe(4);
  });

  it('skips the quad for a repeated point but still caps it', () => {
    const sink = new RecordingSink();
    appendStroke(
      sink,
      strokeOf([
        [0, 0],
        [0, 0],
      ]),
    );

    expect(sink.count('closePath')).toBe(0);
    expect(sink.count('arc')).toBe(2);
  });

  it('varies width with pressure', () => {
    const light = new RecordingSink();
    const heavy = new RecordingSink();
    appendStroke(
      light,
      strokeOf(
        [
          [0, 0],
          [10, 0],
        ],
        0.1,
      ),
    );
    appendStroke(
      heavy,
      strokeOf(
        [
          [0, 0],
          [10, 0],
        ],
        0.9,
      ),
    );

    const radius = (s: RecordingSink) => Number(s.calls.find((c) => c.op === 'arc')?.args[2] ?? 0);
    expect(radius(heavy)).toBeGreaterThan(radius(light));
  });

  it('winds joint circles the same way as the segment quads', () => {
    // Regression: with the default arc direction the circles wind opposite to
    // the quads, and under the nonzero fill rule the overlap cancels to a
    // hole — every stroke renders as a dashed line.
    const signedArea = (pts: [number, number][]) =>
      pts.reduce((sum, [x, y], i) => {
        const [nx, ny] = pts[(i + 1) % pts.length];
        return sum + (x * ny - nx * y);
      }, 0) / 2;

    // Quads wind negative whichever way the stroke travels...
    expect(signedArea(segmentQuad(point(0, 0), point(10, 0), 2, 2)!)).toBeLessThan(0);
    expect(signedArea(segmentQuad(point(0, 0), point(0, 10), 2, 2)!)).toBeLessThan(0);
    expect(signedArea(segmentQuad(point(10, 4), point(0, 0), 2, 2)!)).toBeLessThan(0);

    // ...so every arc must be emitted counterclockwise to match.
    const sink = new RecordingSink();
    appendStroke(
      sink,
      strokeOf([
        [0, 0],
        [10, 0],
        [10, 10],
      ]),
    );
    const arcs = sink.calls.filter((c) => c.op === 'arc');
    expect(arcs).not.toHaveLength(0);
    expect(arcs.every((a) => a.args[5] === true)).toBe(true);
  });

  it('winds a lone dot the same way', () => {
    const sink = new RecordingSink();
    appendStroke(sink, strokeOf([[5, 5]]));
    expect(sink.calls.find((c) => c.op === 'arc')?.args[5]).toBe(true);
  });

  it('emits nothing for an empty stroke', () => {
    const sink = new RecordingSink();
    appendStroke(sink, { points: [] });
    expect(sink.calls).toHaveLength(0);
  });
});

describe('appendStrokes', () => {
  it('accumulates every stroke into one path', () => {
    const sink = new RecordingSink();
    appendStrokes(sink, [
      strokeOf([
        [0, 0],
        [10, 0],
      ]),
      strokeOf([
        [0, 20],
        [10, 20],
      ]),
    ]);
    expect(sink.count('closePath')).toBe(2);
  });
});
