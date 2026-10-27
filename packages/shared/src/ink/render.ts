// Ink rendering — variable-width strokes.
//
// Canvas `lineWidth` cannot change partway along a path, so pressure-varying
// ink cannot be a stroked polyline. Instead each segment becomes a filled quad
// whose two ends have different widths, with a filled circle at every joint to
// round the corners. Filled with the nonzero winding rule the pieces union
// cleanly, which avoids the seams and self-intersection artifacts an offset
// outline produces at sharp corners.
//
// Everything here writes to a `PathSink` rather than a canvas context, so the
// geometry is testable against a recording fake. `Path2D` satisfies the
// interface structurally.

import type { InkPoint, Stroke } from './stroke';

/** The subset of `Path2D` this module uses. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  closePath(): void;
}

/**
 * Winding direction for the joint circles.
 *
 * This is load-bearing, not cosmetic. Under the nonzero fill rule, two
 * overlapping subpaths wound in OPPOSITE directions cancel to a hole — and a
 * segment quad, whose corners are emitted along the travel direction, always
 * winds the opposite way from a default `arc()`. Getting this wrong renders
 * every stroke as a dashed line: solid where only the quad covers, punched
 * through wherever a joint circle overlaps it.
 */
const JOINT_WINDING = true;

export interface RibbonOptions {
  /** Width in CSS pixels at zero pressure. */
  minWidth?: number;
  /** Width in CSS pixels at full pressure. */
  maxWidth?: number;
}

const DEFAULT_MIN_WIDTH = 1.5;
const DEFAULT_MAX_WIDTH = 5;

/** Stroke width for a given pressure, linearly interpolated and clamped. */
export function widthAt(pressure: number, options: RibbonOptions = {}): number {
  const min = options.minWidth ?? DEFAULT_MIN_WIDTH;
  const max = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const p = Math.min(1, Math.max(0, Number.isFinite(pressure) ? pressure : 0));
  return min + (max - min) * p;
}

/**
 * The four corners of the quad joining two samples, in order.
 *
 * Returns null for coincident points — there is no perpendicular to offset
 * along, and the joint circle covers that case anyway.
 */
export function segmentQuad(
  a: InkPoint,
  b: InkPoint,
  widthA: number,
  widthB: number,
): [number, number][] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;

  // Unit normal to the segment.
  const nx = -dy / len;
  const ny = dx / len;

  const ha = widthA / 2;
  const hb = widthB / 2;

  return [
    [a.x + nx * ha, a.y + ny * ha],
    [b.x + nx * hb, b.y + ny * hb],
    [b.x - nx * hb, b.y - ny * hb],
    [a.x - nx * ha, a.y - ny * ha],
  ];
}

/** Append one stroke's filled geometry to a path. */
export function appendStroke(sink: PathSink, stroke: Stroke, options: RibbonOptions = {}): void {
  const pts = stroke.points;
  if (pts.length === 0) return;

  // A dot: one tap with no movement. Still worth ink — the shin/sin dots and
  // several nikud are exactly this.
  if (pts.length === 1) {
    const r = widthAt(pts[0].pressure, options) / 2;
    sink.moveTo(pts[0].x + r, pts[0].y);
    sink.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2, JOINT_WINDING);
    return;
  }

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const wa = widthAt(a.pressure, options);
    const wb = widthAt(b.pressure, options);

    const quad = segmentQuad(a, b, wa, wb);
    if (quad) {
      sink.moveTo(quad[0][0], quad[0][1]);
      sink.lineTo(quad[1][0], quad[1][1]);
      sink.lineTo(quad[2][0], quad[2][1]);
      sink.lineTo(quad[3][0], quad[3][1]);
      sink.closePath();
    }

    // Round the joint (and, at i === 1, the start cap).
    if (i === 1) {
      sink.moveTo(a.x + wa / 2, a.y);
      sink.arc(a.x, a.y, wa / 2, 0, Math.PI * 2, JOINT_WINDING);
    }
    sink.moveTo(b.x + wb / 2, b.y);
    sink.arc(b.x, b.y, wb / 2, 0, Math.PI * 2, JOINT_WINDING);
  }
}

/** Append many strokes to one path. */
export function appendStrokes(
  sink: PathSink,
  strokes: Stroke[],
  options: RibbonOptions = {},
): void {
  for (const stroke of strokes) appendStroke(sink, stroke, options);
}
