// Stroke capture and palm rejection.
//
// This module is framework-free and DOM-free on purpose — the same reasoning as
// `nav-menu.ts`. The React component owns `addEventListener`, coalesced-event
// extraction, and pointer capture; it feeds plain samples in here. That keeps
// the part with actual decisions in it (which pointer is a palm?) testable
// without simulating a tablet.

import { PointSmoother } from './smooth';
import type { InkPoint, Stroke } from './stroke';

export type PointerKind = 'pen' | 'touch' | 'mouse';

/** A pointer event reduced to what ink capture actually needs. */
export interface PointerSample {
  pointerId: number;
  pointerType: string;
  /** CSS pixels relative to the writing surface. */
  x: number;
  y: number;
  /** Raw `PointerEvent.pressure`, 0–1. Ignored for non-pen pointers. */
  pressure: number;
  /** `PointerEvent.timeStamp` — absolute; converted to stroke-relative here. */
  timestamp: number;
}

export type BeginOutcome =
  /** A new stroke is now in progress. */
  | 'started'
  /** Ignored: a palm, or a second finger while already drawing. */
  | 'rejected'
  /** The pen interrupted a touch stroke; the touch stroke was discarded. */
  | 'preempted';

/**
 * Pressure reported for pointers that have no sensor. Mouse-down reports 0.5 in
 * most browsers and touch reports 0 or 0.5 inconsistently, so it is pinned
 * rather than passed through — otherwise line width flickers with the browser.
 */
export const CONSTANT_PRESSURE = 0.5;

/**
 * Floor for pen pressure. A real stylus often reports 0 on the first sample of
 * a stroke, and a zero-width segment is invisible — the stroke would appear to
 * start a few pixels late.
 */
export const MIN_PEN_PRESSURE = 0.08;

/** Samples closer than this to the previous one are dropped as redundant. */
const MIN_SAMPLE_DISTANCE = 0.1;

export interface InkCaptureOptions {
  /** Disable the 1€ filter. Tests and template authoring want raw samples. */
  smoothing?: boolean;
  smoothingParams?: { minCutoff?: number; beta?: number; dCutoff?: number };
}

export class InkCapture {
  private readonly options: InkCaptureOptions;
  private smoother: PointSmoother | null = null;

  private penSeen = false;
  private activeId: number | null = null;
  private activeKind: PointerKind | null = null;
  private startTime = 0;
  private points: InkPoint[] = [];

  constructor(options: InkCaptureOptions = {}) {
    this.options = options;
  }

  /**
   * True once any pen input has been seen.
   *
   * This latches for the lifetime of the instance and is the whole basis of
   * palm rejection: a device that has produced a pen event is a device whose
   * touch events, during writing, are far more likely to be a resting hand
   * than an intentional finger stroke.
   */
  get hasSeenPen(): boolean {
    return this.penSeen;
  }

  get isDrawing(): boolean {
    return this.activeId !== null;
  }

  /** The in-progress stroke, or null. The array is a copy; mutate freely. */
  get liveStroke(): Stroke | null {
    return this.activeId === null ? null : { points: this.points.slice() };
  }

  /**
   * Whether this pointer type may draw right now.
   *
   * Touch is the only kind that gets refused, and only after a pen has been
   * seen. Mouse is always allowed — a mouse cannot be a palm, and refusing it
   * would break desktop development and the Playwright specs.
   */
  shouldAccept(pointerType: string): boolean {
    return pointerType !== 'touch' || !this.penSeen;
  }

  begin(sample: PointerSample): BeginOutcome {
    if (sample.pointerType === 'pen') this.penSeen = true;

    if (!this.shouldAccept(sample.pointerType)) return 'rejected';

    let outcome: BeginOutcome = 'started';

    if (this.activeId !== null) {
      // A pen landing mid-stroke means the palm touched down first and the
      // stylus followed — the common case when writing right-to-left with the
      // hand resting. Throw away what the palm drew and let the pen through.
      if (sample.pointerType === 'pen' && this.activeKind !== 'pen') {
        outcome = 'preempted';
      } else {
        return 'rejected';
      }
    }

    this.activeId = sample.pointerId;
    this.activeKind = sample.pointerType === 'pen' ? 'pen' : sample.pointerType === 'touch' ? 'touch' : 'mouse';
    this.startTime = sample.timestamp;
    this.points = [];
    this.smoother = this.options.smoothing === false ? null : new PointSmoother(this.options.smoothingParams);

    this.push(sample);
    return outcome;
  }

  /**
   * Add samples to the in-progress stroke. Samples from any other pointer are
   * ignored, which is what keeps a resting palm from dragging the pen's line
   * across the page.
   */
  extend(samples: PointerSample | PointerSample[]): void {
    if (this.activeId === null) return;
    const list = Array.isArray(samples) ? samples : [samples];
    for (const s of list) {
      if (s.pointerId !== this.activeId) continue;
      this.push(s);
    }
  }

  /** Finish the stroke. Returns null if nothing was drawn or none was active. */
  end(sample?: PointerSample): Stroke | null {
    if (this.activeId === null) return null;
    if (sample && sample.pointerId !== this.activeId) return null;
    if (sample) this.push(sample);

    const stroke = this.points.length > 0 ? { points: this.points } : null;
    this.reset();
    return stroke;
  }

  /** Abandon the in-progress stroke (pointercancel, or a preempting pen). */
  cancel(): void {
    this.reset();
  }

  private reset(): void {
    this.activeId = null;
    this.activeKind = null;
    this.points = [];
    this.smoother?.reset();
    this.smoother = null;
  }

  private push(sample: PointerSample): void {
    const raw = this.smoother
      ? this.smoother.smooth(sample.x, sample.y, sample.timestamp)
      : { x: sample.x, y: sample.y };

    const prev = this.points[this.points.length - 1];
    if (prev && Math.hypot(raw.x - prev.x, raw.y - prev.y) < MIN_SAMPLE_DISTANCE) return;

    this.points.push({
      x: raw.x,
      y: raw.y,
      pressure: normalizePressure(sample.pointerType, sample.pressure),
      // Clamped at 0 because a coalesced event can carry a timestamp fractionally
      // before the pointerdown that started the stroke.
      t: Math.max(0, sample.timestamp - this.startTime),
    });
  }
}

export function normalizePressure(pointerType: string, pressure: number): number {
  if (pointerType !== 'pen') return CONSTANT_PRESSURE;
  if (!Number.isFinite(pressure)) return CONSTANT_PRESSURE;
  return Math.min(1, Math.max(MIN_PEN_PRESSURE, pressure));
}
