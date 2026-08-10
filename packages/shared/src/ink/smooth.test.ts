import { describe, expect, it } from 'vitest';
import { catmullRom, OneEuroFilter, PointSmoother } from './smooth';

describe('OneEuroFilter', () => {
  it('passes the first sample through unchanged', () => {
    expect(new OneEuroFilter().filter(42, 0)).toBe(42);
  });

  it('converges on a constant input', () => {
    const f = new OneEuroFilter();
    f.filter(10, 0);
    let out = 0;
    for (let i = 1; i <= 60; i++) out = f.filter(10, i * 8);
    expect(out).toBeCloseTo(10, 6);
  });

  it('reduces jitter around a steady value', () => {
    const noisy = [10, 12, 8, 11, 9, 12, 8, 10, 11, 9, 10, 12, 8, 11];
    const f = new OneEuroFilter();
    const out = noisy.map((v, i) => f.filter(v, i * 8));

    // Compare spread over the settled tail, skipping the filter's warm-up.
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(spread(out.slice(4))).toBeLessThan(spread(noisy.slice(4)));
  });

  it('still tracks a fast ramp rather than lagging far behind', () => {
    // Speed-dependent cutoff is the point of this filter: fast movement must
    // stay responsive even though slow movement is smoothed hard.
    const f = new OneEuroFilter();
    let out = 0;
    for (let i = 0; i <= 20; i++) out = f.filter(i * 50, i * 8);
    expect(out).toBeGreaterThan(700);
  });

  it('survives repeated timestamps without producing NaN', () => {
    // Coalesced pointer events routinely share a timestamp.
    const f = new OneEuroFilter();
    f.filter(5, 100);
    const out = f.filter(6, 100);
    expect(Number.isFinite(out)).toBe(true);
  });

  it('starts over after reset', () => {
    const f = new OneEuroFilter();
    f.filter(10, 0);
    f.filter(10, 8);
    f.reset();
    expect(f.filter(99, 16)).toBe(99);
  });
});

describe('PointSmoother', () => {
  it('filters both axes independently', () => {
    const s = new PointSmoother();
    expect(s.smooth(3, 7, 0)).toEqual({ x: 3, y: 7 });

    const next = s.smooth(100, 7, 8);
    expect(next.x).toBeGreaterThan(3);
    expect(next.x).toBeLessThan(100);
    expect(next.y).toBeCloseTo(7, 6);
  });

  it('resets both axes', () => {
    const s = new PointSmoother();
    s.smooth(1, 1, 0);
    s.smooth(5, 5, 8);
    s.reset();
    expect(s.smooth(50, 60, 16)).toEqual({ x: 50, y: 60 });
  });
});

describe('catmullRom', () => {
  it('passes exactly through its control points', () => {
    expect(catmullRom(0, 10, 20, 30, 0)).toBeCloseTo(10, 10);
    expect(catmullRom(0, 10, 20, 30, 1)).toBeCloseTo(20, 10);
  });

  it('interpolates monotonically along a straight run', () => {
    const mid = catmullRom(0, 10, 20, 30, 0.5);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(20);
  });
});
