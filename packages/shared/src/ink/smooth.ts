// Input smoothing.
//
// Two different jobs, deliberately kept apart:
//
//   OneEuroFilter  — applied to samples as they arrive, to remove sensor jitter
//   catmullRom     — applied at render time, to interpolate between samples
//
// The first changes the stored ink; the second does not. Do not merge them —
// smoothing at capture time with a render-grade spline would round off real
// corners (the square corner of ד is the whole difference from ר).

/**
 * The 1€ filter (Casiewicz et al.) — a low-pass filter whose cutoff rises with
 * speed, so slow movement is smoothed hard and fast movement stays responsive.
 *
 * This is the standard answer to stylus jitter. A fixed low-pass either leaves
 * visible wobble when writing slowly or adds lag when writing quickly; this
 * trades between them per-sample.
 */
export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;

  private prevValue: number | null = null;
  private prevDerivative = 0;
  private prevTime: number | null = null;

  constructor(options: { minCutoff?: number; beta?: number; dCutoff?: number } = {}) {
    // Defaults tuned for pen input in CSS pixels at ~120–240 Hz. Raising beta
    // makes fast strokes track more tightly at the cost of jitter.
    this.minCutoff = options.minCutoff ?? 1.0;
    this.beta = options.beta ?? 0.007;
    this.dCutoff = options.dCutoff ?? 1.0;
  }

  /** Smoothing factor for a given cutoff frequency and time delta (seconds). */
  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /** @param timestamp milliseconds */
  filter(value: number, timestamp: number): number {
    if (this.prevValue === null || this.prevTime === null) {
      this.prevValue = value;
      this.prevTime = timestamp;
      return value;
    }

    // Two samples can share a timestamp — coalesced pointer events routinely
    // do. Treating dt as zero would divide by zero, so fall back to a nominal
    // 1 ms rather than dropping the sample.
    const dt = Math.max((timestamp - this.prevTime) / 1000, 0.001);

    const derivative = (value - this.prevValue) / dt;
    const ad = OneEuroFilter.alpha(this.dCutoff, dt);
    const smoothedDerivative = ad * derivative + (1 - ad) * this.prevDerivative;

    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative);
    const a = OneEuroFilter.alpha(cutoff, dt);
    const smoothed = a * value + (1 - a) * this.prevValue;

    this.prevValue = smoothed;
    this.prevDerivative = smoothedDerivative;
    this.prevTime = timestamp;

    return smoothed;
  }

  reset(): void {
    this.prevValue = null;
    this.prevDerivative = 0;
    this.prevTime = null;
  }
}

/** A 1€ filter per axis, sharing one timestamp. One instance per stroke. */
export class PointSmoother {
  private readonly fx: OneEuroFilter;
  private readonly fy: OneEuroFilter;

  constructor(options?: { minCutoff?: number; beta?: number; dCutoff?: number }) {
    this.fx = new OneEuroFilter(options);
    this.fy = new OneEuroFilter(options);
  }

  smooth(x: number, y: number, timestamp: number): { x: number; y: number } {
    return { x: this.fx.filter(x, timestamp), y: this.fy.filter(y, timestamp) };
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
}

/**
 * Centripetal-ish Catmull-Rom interpolation between p1 and p2, with p0 and p3
 * as the surrounding control points. `t` runs 0–1 from p1 to p2.
 *
 * Catmull-Rom passes exactly through its control points, which matters here:
 * the rendered line has to sit on the samples the student actually drew, not
 * near them.
 */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}
