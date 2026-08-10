import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  type InkPoint,
  normalizeStrokes,
  resample,
  type Stroke,
  strokeLength,
  totalLength,
} from './stroke';

/** Build a stroke from [x, y] pairs, with uniform pressure and 10ms spacing. */
function strokeOf(coords: [number, number][], pressure = 0.5): Stroke {
  return {
    points: coords.map(([x, y], i): InkPoint => ({ x, y, pressure, t: i * 10 })),
  };
}

describe('strokeLength', () => {
  it('sums the distance between consecutive samples', () => {
    expect(strokeLength(strokeOf([[0, 0], [3, 4], [3, 14]]))).toBe(15);
  });

  it('is zero for a dot and for an empty stroke', () => {
    expect(strokeLength(strokeOf([[5, 5]]))).toBe(0);
    expect(strokeLength({ points: [] })).toBe(0);
  });
});

describe('boundingBox', () => {
  it('spans every point across every stroke', () => {
    const box = boundingBox([strokeOf([[0, 10], [5, 2]]), strokeOf([[-3, 4], [8, 20]])]);
    expect(box).toEqual({ minX: -3, minY: 2, maxX: 8, maxY: 20 });
  });

  it('returns null when there is no ink', () => {
    expect(boundingBox([])).toBeNull();
    expect(boundingBox([{ points: [] }])).toBeNull();
  });
});

describe('resample', () => {
  it('spaces points evenly by arc length', () => {
    const points = resample(strokeOf([[0, 0], [10, 0]]), 11);
    expect(points).toHaveLength(11);
    points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(i, 6);
      expect(p.y).toBeCloseTo(0, 6);
    });
  });

  it('redistributes points regardless of original sample density', () => {
    // The same shape drawn slowly (many samples) and quickly (few) must
    // resample to the same points — that equivalence is the entire reason
    // this function exists.
    const slow = strokeOf(Array.from({ length: 50 }, (_, i): [number, number] => [i / 49 * 10, 0]));
    const fast = strokeOf([[0, 0], [10, 0]]);

    const a = resample(slow, 8);
    const b = resample(fast, 8);
    a.forEach((p, i) => expect(p.x).toBeCloseTo(b[i].x, 4));
  });

  it('interpolates pressure and time along with position', () => {
    const stroke: Stroke = {
      points: [
        { x: 0, y: 0, pressure: 0, t: 0 },
        { x: 10, y: 0, pressure: 1, t: 100 },
      ],
    };
    const mid = resample(stroke, 3)[1];
    expect(mid.pressure).toBeCloseTo(0.5, 6);
    expect(mid.t).toBeCloseTo(50, 6);
  });

  it('returns n copies of the point for a zero-length stroke', () => {
    const points = resample(strokeOf([[4, 7], [4, 7]]), 5);
    expect(points).toHaveLength(5);
    expect(points.every(p => p.x === 4 && p.y === 7)).toBe(true);
  });

  it('returns nothing for an empty stroke and rejects n < 2', () => {
    expect(resample({ points: [] }, 4)).toEqual([]);
    expect(() => resample(strokeOf([[0, 0], [1, 1]]), 1)).toThrow(RangeError);
  });
});

describe('normalizeStrokes', () => {
  it('maps ink into the unit box', () => {
    const [s] = normalizeStrokes([strokeOf([[10, 10], [20, 20]])]);
    expect(s.points[0]).toMatchObject({ x: 0, y: 0 });
    expect(s.points[1]).toMatchObject({ x: 1, y: 1 });
  });

  it('preserves aspect ratio and centers the shorter axis', () => {
    // A horizontal line must not be stretched to fill the box vertically —
    // if it were, a ו and a ד would normalize to the same thing.
    const [s] = normalizeStrokes([strokeOf([[0, 0], [10, 0]])]);
    expect(s.points[0].x).toBeCloseTo(0, 6);
    expect(s.points[1].x).toBeCloseTo(1, 6);
    expect(s.points[0].y).toBeCloseTo(0.5, 6);
    expect(s.points[1].y).toBeCloseTo(0.5, 6);
  });

  it('honours size and padding', () => {
    const [s] = normalizeStrokes([strokeOf([[0, 0], [10, 10]])], { size: 100, padding: 0.1 });
    expect(s.points[0].x).toBeCloseTo(10, 6);
    expect(s.points[1].x).toBeCloseTo(90, 6);
  });

  it('pins a dot at the center instead of dividing by zero', () => {
    const [s] = normalizeStrokes([strokeOf([[7, 7]])]);
    expect(s.points[0].x).toBeCloseTo(0.5, 6);
    expect(s.points[0].y).toBeCloseTo(0.5, 6);
  });

  it('carries pressure and time through untouched', () => {
    const [s] = normalizeStrokes([strokeOf([[0, 0], [10, 10]], 0.8)]);
    expect(s.points[1].pressure).toBe(0.8);
    expect(s.points[1].t).toBe(10);
  });

  it('returns nothing when there is no ink', () => {
    expect(normalizeStrokes([])).toEqual([]);
  });
});

describe('totalLength', () => {
  it('sums across strokes', () => {
    expect(totalLength([strokeOf([[0, 0], [3, 4]]), strokeOf([[0, 0], [0, 10]])])).toBe(15);
  });
});
