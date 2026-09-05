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
// All four are measured at the ink's BEST registration, not at the one
// bounding-box normalization happened to produce — see `MAX_REGISTRATION_SHIFT`.
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
   * Where the ink sat, relative to bounding-box registration, when it scored
   * best — as a fraction of the box, positive meaning right and down.
   *
   * Reported because it is the one number that says *why* a legible letter
   * scored low: a large offset means bounding-box normalization had misregistered
   * the attempt and the search corrected it. Nothing in the UI depends on it.
   */
  offset: { x: number; y: number };
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

/**
 * How far the ink may be shifted looking for its best registration, as a
 * fraction of the box.
 *
 * Absolute canvas position is already irrelevant — `normalizeStrokes` and
 * `maskFromAlpha` each fit their side to its own bounds and centre it, so
 * writing small in a corner scores the same as writing large in the middle.
 * What is *not* irrelevant is that both sides are pinned by their extreme
 * points. A stroke that overshoots the printed glyph's ceiling by a few percent
 * shifts the whole letter body relative to the reference, and every metric
 * downstream then measures that shift as if it were letterform error. On a real
 * alef that cost about 13 points of a 40 — registration, not handwriting.
 *
 * The bound is load-bearing, and 12% is not a round number picked for comfort:
 * it is a little beyond the worst registration error a bounding box can induce,
 * and far short of the distance a diacritic would have to travel to reach
 * another slot. Widen it and `placement` stops meaning anything — a qamets
 * written where the holem goes is about half a box away, and a search allowed to
 * reach that far would slide it into place and call it correct.
 *
 * Scale is deliberately not searched. Measured against the reported attempt,
 * k = 1.0 won on its own, which is the tell that this is a translation problem
 * specifically.
 */
export const MAX_REGISTRATION_SHIFT = 0.12;

/**
 * Search stride, in cells, for the first pass over candidate offsets.
 *
 * Coarse-to-fine rather than exhaustive: the score surface over translation is
 * smooth at this scale — neighbouring offsets differ by a fraction of a stroke
 * width — so a stride of 4 finds the right basin and the refinement pass finds
 * the floor of it. Exhaustive at stride 1 would be ~900 evaluations against
 * ~74, for a winner that measured identically on the reported attempt.
 */
const COARSE_STEP = 4;

/**
 * Radius, in cells, of the stride-1 sweep around the coarse winner.
 *
 * Two, because that is what a stride of 4 leaves uncovered: the true optimum can
 * sit at most half a stride from the nearest coarse sample, so ±2 reaches it and
 * anything wider is re-testing ground the coarse pass already lost.
 */
const REFINE_RADIUS = 2;

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
  offset: { x: 0, y: 0 },
  spill: 1,
  placement: null,
  score: 0,
  verdict: 'miss',
};

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Ink samples as integer cell coordinates in the mask's grid.
 *
 * Normalized as one group, not per stroke: the shin/sin dot means nothing on
 * its own, and only its position relative to the rest of the letter says which
 * letter was written. Resampled by arc length so that a slowly-drawn curve
 * does not outvote a fast one of the same shape.
 *
 * Rounded to cells once, here, rather than inside the registration search.
 * Every offset the search tries is a whole number of cells, so `round(x + dx)`
 * equals `round(x) + dx` and shifting stays exact however many offsets are
 * tried — which is also what makes a shifted ink field a plain lookup into the
 * unshifted one.
 */
function inkSamples(
  strokes: Stroke[],
  size: number,
  padding: number,
): { x: Int32Array; y: Int32Array } {
  const normalized = normalizeStrokes(strokes, { size, padding });
  const xs: number[] = [];
  const ys: number[] = [];
  const last = size - 1;

  for (const stroke of normalized) {
    if (stroke.points.length === 0) continue;
    // About one sample per mask pixel — dense enough that the ink reads as a
    // continuous line to the coverage pass, without paying for more.
    const n = Math.min(2048, Math.max(2, Math.ceil(strokeLength(stroke)) + 1));
    for (const p of resample(stroke, n)) {
      xs.push(Math.min(last, Math.max(0, Math.round(p.x))));
      ys.push(Math.min(last, Math.max(0, Math.round(p.y))));
    }
  }

  return { x: Int32Array.from(xs), y: Int32Array.from(ys) };
}

/**
 * Coordinates of every set cell in a mask, so a sweep skips the empty ones.
 *
 * As x and y rather than flat indices because the registration search visits
 * these cells once per candidate offset, and recovering a coordinate from an
 * index costs a modulo and a divide on every visit.
 */
function setCells(bits: Uint8Array, size: number): { x: Int32Array; y: Int32Array } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      xs.push(i % size);
      ys.push((i / size) | 0);
    }
  }
  return { x: Int32Array.from(xs), y: Int32Array.from(ys) };
}

/**
 * Fold the measurements into a 0–100 score.
 *
 * Combined as a geometric mean, not a weighted sum. A sum lets one metric buy
 * off the other: at any fixed weighting, a single confident dot in the middle
 * of the letter still banks the whole accuracy term. The geometric mean says
 * what the design actually intends — BOTH have to be good.
 *
 * Coverage goes through a response curve first, because linear coverage is far
 * too forgiving. A ה missing its roof reads as 65% covered, which sounds like a
 * near miss and is very nearly a different letter.
 */
function combine(
  accuracy: number,
  coverage: number,
  spill: number,
  placement: number | null,
  tolerance: number,
): number {
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
  return Math.round(100 * graded * (1 - SPILL_WEIGHT * penalty));
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
export function scoreInk(strokes: Stroke[], mask: GlyphMask, options: ScoreOptions = {}): InkScore {
  if (mask.filled === 0) return EMPTY;

  const { size, padding } = mask;
  const ink = inkSamples(strokes, size, padding);
  const count = ink.x.length;
  if (count === 0) return EMPTY;

  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const tolerancePx = tolerance * size;
  const last = size - 1;

  // The ink's own distance field, built ONCE from the unshifted samples.
  //
  // This is what makes searching over placements affordable. Shifting the ink by
  // a whole number of cells shifts its distance field by the same amount, so
  // "is this glyph cell within tolerance of the shifted ink" is a lookup into
  // the unshifted field at the opposite offset. Rebuilding the transform per
  // candidate — it is the one O(size²) step in an attempt — would multiply the
  // cost of a score by the size of the search.
  const inkBits = new Uint8Array(size * size);
  for (let i = 0; i < count; i++) inkBits[ink.y[i] * size + ink.x[i]] = 1;
  const inkDistance = distanceTransform(inkBits, size);

  const maskCells = setCells(mask.bits, size);
  // Narrowed once, here, so the rest of the function can just ask whether there
  // is a part to grade. An empty difference means the font draws no distinction
  // between the composed form and its base, which is "not graded" — never a
  // failed attempt.
  const part =
    options.part && options.part.filled > 0 && options.part.size === size ? options.part : null;
  const partCells = part ? setCells(part.bits, size) : null;

  // Distance to fall back on when a shifted cell leaves the grid entirely. Read
  // as "it fell outside the frame" — the same reading `maskFromAlpha` gives to
  // anything outside its bounds — rather than clamping to the edge, which would
  // let ink pushed off one side pile up against the nearest cell and be scored
  // as though it had landed there.
  const OUTSIDE = size;

  const distances = new Float64Array(count);
  const decile = Math.max(1, Math.round(count * 0.1));

  /**
   * How many of `cells` sit within tolerance of the ink shifted by (dx, dy).
   *
   * Reads the ink's field at the opposite offset — the equivalence the field
   * was built once for.
   */
  const reach = (cells: { x: Int32Array; y: Int32Array }, dx: number, dy: number) => {
    let hit = 0;
    for (let c = 0; c < cells.x.length; c++) {
      const x = cells.x[c] - dx;
      const y = cells.y[c] - dy;
      if (x < 0 || y < 0 || x > last || y > last) continue;
      if (inkDistance[y * size + x] <= tolerancePx) hit++;
    }
    return hit;
  };

  /**
   * How well the ink overlays the glyph, shifted by (dx, dy) whole cells.
   *
   * This is the search's objective, and it is deliberately only the two overlap
   * terms. Neither penalty is allowed to vote on the alignment it will be
   * charged at:
   *
   * - **Placement** would slide a qamets written under the wrong side of the פ
   *   toward the slot it belongs in, trading a little accuracy for a lot of
   *   placement — the one error the vowel deck exists to catch.
   * - **Spill** is a penalty for ink that should not be on the page at all. A
   *   stray tick is not evidence about where the letter sits, and letting it
   *   steer registration would be the same mistake in a quieter form.
   *
   * Registration is a property of the letter body: the artifact being undone is
   * where a bounding box landed, and the bounding box is set by the shape. Both
   * penalties are measured once, afterwards, at the offset overlap chose.
   *
   * Left unrounded, unlike the reported score. Rounding to a point would flatten
   * the objective into plateaus and let the winner be decided by iteration order.
   */
  const overlapAt = (dx: number, dy: number) => {
    let onGlyph = 0;
    for (let i = 0; i < count; i++) {
      const x = ink.x[i] + dx;
      const y = ink.y[i] + dy;
      const inside = x >= 0 && y >= 0 && x <= last && y <= last;
      if ((inside ? mask.distance[y * size + x] : OUTSIDE) <= tolerancePx) onGlyph++;
    }
    const accuracy = onGlyph / count;
    const coverage = reach(maskCells, dx, dy) / mask.filled;
    const covered = clamp01((coverage - COVERAGE_FLOOR) / (COVERAGE_CEILING - COVERAGE_FLOOR));

    return { accuracy, coverage, overlap: Math.sqrt(clamp01(accuracy) * covered) };
  };

  /**
   * Mean distance of the worst decile of ink, at a given offset.
   *
   * The worst decile rather than the mean or the max: a mean is dominated by the
   * ink that landed correctly and barely moves for one bad mark, and a max is
   * decided by a single sample. Run once, at the winning offset — the sort is
   * the most expensive step in an attempt, and inside the search it would be
   * paid once per candidate.
   */
  const spillAt = (dx: number, dy: number) => {
    for (let i = 0; i < count; i++) {
      const x = ink.x[i] + dx;
      const y = ink.y[i] + dy;
      const inside = x >= 0 && y >= 0 && x <= last && y <= last;
      distances[i] = inside ? mask.distance[y * size + x] : OUTSIDE;
    }
    distances.sort();
    let worstSum = 0;
    for (let i = 0; i < decile; i++) worstSum += distances[count - 1 - i];
    return worstSum / decile / size;
  };

  // ── The registration search: coarse sweep, then refine around the winner.
  const span = Math.round(MAX_REGISTRATION_SHIFT * size);
  let bestDx = 0;
  let bestDy = 0;
  // Seeded at the identity offset so that bounding-box registration always
  // competes, and a search that finds nothing better changes no score.
  let best = overlapAt(0, 0);

  const consider = (dx: number, dy: number) => {
    if (dx === bestDx && dy === bestDy) return;
    const candidate = overlapAt(dx, dy);
    if (candidate.overlap > best.overlap) {
      best = candidate;
      bestDx = dx;
      bestDy = dy;
    }
  };

  // Stepped outward from zero rather than up from -span, so the grid is centred
  // on the identity offset. Starting at -span leaves the sweep off by
  // `span % COARSE_STEP` and it never samples 0 at all — which is the one
  // placement most attempts want.
  const steps = Math.floor(span / COARSE_STEP);
  for (let ky = -steps; ky <= steps; ky++) {
    for (let kx = -steps; kx <= steps; kx++) consider(kx * COARSE_STEP, ky * COARSE_STEP);
  }

  const coarseDx = bestDx;
  const coarseDy = bestDy;
  for (let dy = coarseDy - REFINE_RADIUS; dy <= coarseDy + REFINE_RADIUS; dy++) {
    for (let dx = coarseDx - REFINE_RADIUS; dx <= coarseDx + REFINE_RADIUS; dx++) {
      if (Math.abs(dx) > span || Math.abs(dy) > span) continue;
      consider(dx, dy);
    }
  }

  // Both penalties, at the offset overlap settled on — see `overlapAt`.
  const spill = spillAt(bestDx, bestDy);
  const placement = part && partCells ? reach(partCells, bestDx, bestDy) / part.filled : null;
  const score = combine(best.accuracy, best.coverage, spill, placement, tolerance);

  return {
    accuracy: best.accuracy,
    coverage: best.coverage,
    offset: { x: bestDx / size, y: bestDy / size },
    spill,
    placement,
    score,
    verdict: verdictFor(score),
  };
}
