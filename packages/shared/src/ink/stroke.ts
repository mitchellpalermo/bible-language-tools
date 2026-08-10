// Ink primitives — the data model every other module in `ink/` operates on.
//
// Everything here is pure geometry over plain arrays. No DOM, no canvas, no
// pointer events. That is deliberate: the parts of handwriting practice that
// are worth testing (resampling, normalization, scoring) should be testable
// without a renderer, exactly as `nav-menu.ts` is testable without Astro.

/**
 * One sample from the stylus.
 *
 * Coordinates are CSS pixels relative to the writing surface's top-left, NOT
 * device pixels — the canvas scales by devicePixelRatio at draw time, and
 * baking that in here would make stored ink resolution-dependent.
 */
export interface InkPoint {
  x: number;
  y: number;
  /** 0–1. Non-pen pointers are normalized to a constant by `capture.ts`. */
  pressure: number;
  /** Milliseconds since the stroke began. Relative, so strokes replay standalone. */
  t: number;
}

/** One continuous pen-down-to-pen-up mark. */
export interface Stroke {
  points: InkPoint[];
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function distance(a: InkPoint, b: InkPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Total arc length along a stroke's samples. Zero for a dot. */
export function strokeLength(stroke: Stroke): number {
  let total = 0;
  for (let i = 1; i < stroke.points.length; i++) {
    total += distance(stroke.points[i - 1], stroke.points[i]);
  }
  return total;
}

/** Bounding box across every point in every stroke, or null if there are none. */
export function boundingBox(strokes: Stroke[]): BoundingBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

function lerpPoint(a: InkPoint, b: InkPoint, t: number): InkPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure: a.pressure + (b.pressure - a.pressure) * t,
    t: a.t + (b.t - a.t) * t,
  };
}

/**
 * Resample a stroke to exactly `n` points spaced evenly by arc length.
 *
 * This is the $1-recognizer resampling step, and it is what makes two strokes
 * comparable: raw pointer samples are spaced by *time*, so a slowly-drawn
 * curve has many more points than a fast one of the same shape.
 *
 * A stroke with no length (a dot, or a single sample) resamples to `n` copies
 * of its first point rather than dividing by zero.
 */
export function resample(stroke: Stroke, n: number): InkPoint[] {
  if (n < 2) throw new RangeError('resample needs at least 2 points');
  const src = stroke.points;
  if (src.length === 0) return [];

  const total = strokeLength(stroke);
  if (total === 0) return Array.from({ length: n }, () => ({ ...src[0] }));

  const step = total / (n - 1);
  const out: InkPoint[] = [{ ...src[0] }];

  // `pts` is mutated: when a sample lands mid-segment we splice it in so the
  // remainder of that segment is measured from the new point.
  const pts = src.slice();
  let carried = 0;

  for (let i = 1; i < pts.length && out.length < n; i++) {
    const d = distance(pts[i - 1], pts[i]);
    if (d === 0) continue;

    if (carried + d >= step) {
      const t = (step - carried) / d;
      const q = lerpPoint(pts[i - 1], pts[i], t);
      out.push(q);
      pts.splice(i, 0, q);
      carried = 0;
    } else {
      carried += d;
    }
  }

  // Floating-point drift can leave us a point or two short of n.
  while (out.length < n) out.push({ ...pts[pts.length - 1] });

  return out;
}

export interface NormalizeOptions {
  /** Side length of the target square. Defaults to 1 (a unit box). */
  size?: number;
  /** Fraction of `size` left empty around the ink. Defaults to 0. */
  padding?: number;
}

/**
 * Map strokes into a centered square box, preserving aspect ratio.
 *
 * Aspect ratio is preserved on purpose: stretching a ו to fill a square would
 * make it indistinguishable from a ד, and the whole point of the comparison
 * layers downstream is telling those apart.
 *
 * Ink with no extent (a single dot) is placed at the center of the box.
 */
export function normalizeStrokes(strokes: Stroke[], options: NormalizeOptions = {}): Stroke[] {
  const { size = 1, padding = 0 } = options;
  const box = boundingBox(strokes);
  if (!box) return [];

  const inner = size * (1 - 2 * padding);
  const offset = size * padding;

  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const extent = Math.max(width, height);

  // A dot has zero extent; scaling it by anything is meaningless, so pin it.
  const scale = extent === 0 ? 0 : inner / extent;
  const dx = offset + (inner - width * scale) / 2;
  const dy = offset + (inner - height * scale) / 2;

  return strokes.map(stroke => ({
    points: stroke.points.map(p => ({
      x: (p.x - box.minX) * scale + dx,
      y: (p.y - box.minY) * scale + dy,
      pressure: p.pressure,
      t: p.t,
    })),
  }));
}

/** Total ink laid down across every stroke — used to tell a mark from a smudge. */
export function totalLength(strokes: Stroke[]): number {
  return strokes.reduce((sum, s) => sum + strokeLength(s), 0);
}
