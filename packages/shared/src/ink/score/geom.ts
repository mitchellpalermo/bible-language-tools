// Geometric scoring — how close the student's ink is to the glyph.
//
// Three independent measurements, because one number cannot distinguish the
// ways a letter goes wrong:
//
//   accuracy  did the ink land ON the glyph?      (catches a ד drawn as a ו)
//   coverage  did the ink reach ALL of it?        (catches a half-drawn ה)
//   spill     how far does the worst ink stray?   (catches a stray tick)
//
// Accuracy alone would reward a single confident dot in the middle of the
// letter; coverage alone would reward scribbling over the whole box.
//
// A fourth measurement applies only where the caller supplies a `part` mask:
//
//   placement did the ink reach THAT bit of it?   (catches a qamets drawn high)
//
// It exists because the three above are area measurements, and area is exactly
// what a diacritic does not have. A vowel point is some 4% of a pointed
// consonant's cells, so writing it in the wrong place moves the combined score
// by about three points — while being, pedagogically, the entire error.
//
// Known limitation, and it is a real one: this grades shape occupancy, not
// letter identity or stroke order. A ד drawn as a ר plus a stray tick scores
// respectably. Closing that gap is issue #103's job — stroke templates — and
// this module should not grow heuristics that try to do it here. `placement`
// is not that heuristic sneaking in: it decides nothing about what was drawn,
// it asks the same "were these cells reached" question the coverage pass
// already asks, over a set of cells the caller nominated.

import { normalizeStrokes, resample, type Stroke, strokeLength } from '../stroke';
import { distanceTransform, type GlyphMask } from './mask';

export type Verdict = 'pass' | 'close' | 'miss';

export interface InkScore {
  /** Fraction of ink samples landing within tolerance of the glyph. 0–1. */
  accuracy: number;
  /** Fraction of glyph cells reached by some ink sample. 0–1. */
  coverage: number;
  /**
   * Mean distance of the worst decile of ink, as a fraction of the box.
   *
   * The worst decile rather than the mean or the max: a mean is dominated by
   * the ink that landed correctly and barely moves for one bad mark, and a max
   * is decided by a single sample.
   */
  spill: number;
  /**
   * Fraction of the nominated sub-region reached by ink, or null when the
   * caller nominated none.
   *
   * Null and zero mean different things and the UI must not conflate them:
   * null is "placement was not graded", zero is "you did not put the mark
   * anywhere near where it goes".
   */
  placement: number | null;
  /** The combined 0–100 score. */
  score: number;
  verdict: Verdict;
}

/**
 * How far ink may sit from the glyph and still count, as a fraction of the box.
 *
 * Roughly one stroke-width of a text-weight face. Tighter than this and a
 * legible letter written with a slight lean scores as a miss.
 */
export const DEFAULT_TOLERANCE = 0.08;

/**
 * The window over which coverage is allowed to move the score.
 *
 * Below the floor the mark really is not the letter and the exact figure says
 * nothing. The floor is kept low anyway, because clamping to a flat zero throws
 * away the difference between a near miss and a scribble — a letter that came
 * out 83% accurate but half-finished should not read the same as random ink.
 *
 * The ceiling sits below 1.0 because a literal 1.0 is not reachable by hand,
 * and a top score no student can earn is not a top score.
 */
const COVERAGE_FLOOR = 0.25;
const COVERAGE_CEILING = 0.95;

/**
 * The same window, for the nominated sub-region.
 *
 * The ceiling is lower than coverage's. A diacritic is a handful of cells and
 * tolerance is generous relative to its size, so a student who has genuinely
 * put the point in the right place reaches nearly all of it — demanding 95%
 * would be grading the mark's shape a second time, which the coverage term
 * already does.
 */
const PLACEMENT_FLOOR = 0.2;
const PLACEMENT_CEILING = 0.85;

/** Spill is a multiplier, not a term: it can only take away from a good shape. */
const SPILL_WEIGHT = 0.35;
/** Spill beyond this many tolerances is as bad as spill gets. */
const SPILL_RANGE = 3;

export const VERDICT_THRESHOLDS = { pass: 80, close: 60 } as const;

export function verdictFor(score: number): Verdict {
  if (score >= VERDICT_THRESHOLDS.pass) return 'pass';
  if (score >= VERDICT_THRESHOLDS.close) return 'close';
  return 'miss';
}

export interface ScoreOptions {
  /** Overrides `DEFAULT_TOLERANCE`. Fraction of the box, not pixels. */
  tolerance?: number;
  /**
   * A sub-region of `mask` that has to be hit on its own terms.
   *
   * Must be normalized in the *same frame* as `mask` — which is what
   * `rasterizeComposite` returns a pair for. A mask fitted to its own bounds
   * would be scored as though the mark were the whole glyph, silently turning
   * a placement test into a shape test.
   *
   * Ignored when it is empty, so a font that draws no difference between the
   * composed form and its base degrades to plain shape scoring rather than
   * failing every attempt.
   */
  part?: GlyphMask | null;
}

const EMPTY: InkScore = {
  accuracy: 0,
  coverage: 0,
  spill: 1,
  placement: null,
  score: 0,
  verdict: 'miss',
};

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Ink samples in mask-pixel coordinates.
 *
 * Normalized as one group, not per stroke: the shin/sin dot means nothing on
 * its own, and only its position relative to the rest of the letter says which
 * letter was written. Resampled by arc length so that a slowly-drawn curve
 * does not outvote a fast one of the same shape.
 */
function inkSamples(strokes: Stroke[], size: number, padding: number): { x: number; y: number }[] {
  const normalized = normalizeStrokes(strokes, { size, padding });
  const samples: { x: number; y: number }[] = [];

  for (const stroke of normalized) {
    if (stroke.points.length === 0) continue;
    // About one sample per mask pixel — dense enough that the ink reads as a
    // continuous line to the coverage pass, without paying for more.
    const n = Math.min(2048, Math.max(2, Math.ceil(strokeLength(stroke)) + 1));
    for (const p of resample(stroke, n)) samples.push({ x: p.x, y: p.y });
  }

  return samples;
}

/**
 * Score ink against a glyph mask.
 *
 * Takes the mask rather than a canvas or a character, so this is unit-testable
 * against a hand-built `Uint8Array` with no renderer in sight.
 *
 * Ink with no extent, or a mask with nothing in it, scores zero rather than
 * dividing by it.
 */
export function scoreInk(
  strokes: Stroke[],
  mask: GlyphMask,
  options: ScoreOptions = {},
): InkScore {
  if (mask.filled === 0) return EMPTY;

  const { size, padding } = mask;
  const samples = inkSamples(strokes, size, padding);
  if (samples.length === 0) return EMPTY;

  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const tolerancePx = tolerance * size;
  const last = size - 1;

  // ── Accuracy and spill: read the glyph's distance field at each ink sample.
  const inkBits = new Uint8Array(size * size);
  const distances: number[] = [];
  let onGlyph = 0;

  for (const s of samples) {
    const x = Math.min(last, Math.max(0, Math.round(s.x)));
    const y = Math.min(last, Math.max(0, Math.round(s.y)));
    inkBits[y * size + x] = 1;

    const d = mask.distance[y * size + x];
    distances.push(d);
    if (d <= tolerancePx) onGlyph++;
  }

  const accuracy = onGlyph / samples.length;

  distances.sort((a, b) => b - a);
  const decile = Math.max(1, Math.round(distances.length * 0.1));
  let worstSum = 0;
  for (let i = 0; i < decile; i++) worstSum += distances[i];
  const spill = worstSum / decile / size;

  // ── Coverage: the mirror measurement, glyph cells against the ink's field.
  const inkDistance = distanceTransform(inkBits, size);
  let reached = 0;
  for (let i = 0; i < mask.bits.length; i++) {
    if (mask.bits[i] && inkDistance[i] <= tolerancePx) reached++;
  }
  const coverage = reached / mask.filled;

  // ── Placement: coverage again, restricted to the cells the caller nominated.
  // Same question, same tolerance — the difference is only that these cells are
  // no longer outvoted by the thousands belonging to the host consonant.
  //
  // If issue #114 lands a best-of-placements translation search, this has to be
  // evaluated at the winning offset along with everything else. Left behind at
  // the unaligned position it would contradict the rest of the score — the
  // metric that exists to say "the mark is in the wrong place" would be
  // reporting a displacement the other three had already forgiven.
  const part = options.part;
  let placement: number | null = null;
  if (part && part.filled > 0 && part.size === size) {
    let hit = 0;
    for (let i = 0; i < part.bits.length; i++) {
      if (part.bits[i] && inkDistance[i] <= tolerancePx) hit++;
    }
    placement = hit / part.filled;
  }

  // Combined as a geometric mean, not a weighted sum. A sum lets one metric buy
  // off the other: at any fixed weighting, a single confident dot in the middle
  // of the letter still banks the whole accuracy term. The geometric mean says
  // what the design actually intends — BOTH have to be good.
  //
  // Coverage goes through a response curve first, because linear coverage is far
  // too forgiving. A ה missing its roof reads as 65% covered, which sounds like a
  // near miss and is very nearly a different letter.
  const covered = clamp01((coverage - COVERAGE_FLOOR) / (COVERAGE_CEILING - COVERAGE_FLOOR));
  const shape = Math.sqrt(clamp01(accuracy) * covered);

  // Placement folds in the same way and for the same reason: a beautiful פ must
  // not be able to buy off a qamets written where the holem goes. It weighs as
  // much as the whole shape term, which is the claim the vowel deck makes — for
  // these cards the point IS the card, and the host consonant is scaffolding.
  const placed =
    placement === null
      ? 1
      : clamp01((placement - PLACEMENT_FLOOR) / (PLACEMENT_CEILING - PLACEMENT_FLOOR));
  const graded = placement === null ? shape : Math.sqrt(shape * placed);

  const excess = Math.max(0, spill - tolerance);
  const penalty = clamp01(excess / (SPILL_RANGE * tolerance));
  const score = Math.round(100 * graded * (1 - SPILL_WEIGHT * penalty));

  return { accuracy, coverage, spill, placement, score, verdict: verdictFor(score) };
}
