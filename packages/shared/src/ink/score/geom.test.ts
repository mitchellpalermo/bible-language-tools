import { describe, expect, it } from 'vitest';
import type { Stroke } from '../stroke';
import { alphaBounds, type GlyphMask, maskFromAlpha } from './mask';
import {
  DEFAULT_TOLERANCE,
  MAX_REGISTRATION_SHIFT,
  scoreInk,
  verdictFor,
  VERDICT_THRESHOLDS,
} from './geom';

type Poly = [number, number][];

const SOURCE = 200;
/** Roughly the stem weight of a text face at this size. */
const STEM = 9;

function distanceToSegment(px: number, py: number, [ax, ay]: number[], [bx, by]: number[]): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Rasterize polylines at a given stem weight — a stand-in for a font glyph. */
function alphaFrom(lines: Poly[], stem = STEM): Uint8Array {
  const alpha = new Uint8Array(SOURCE * SOURCE);
  for (let y = 0; y < SOURCE; y++) {
    for (let x = 0; x < SOURCE; x++) {
      for (const line of lines) {
        let hit = false;
        for (let i = 1; i < line.length && !hit; i++) {
          if (distanceToSegment(x, y, line[i - 1], line[i]) <= stem / 2) hit = true;
        }
        if (hit) {
          alpha[y * SOURCE + x] = 255;
          break;
        }
      }
    }
  }
  return alpha;
}

function maskFrom(lines: Poly[], stem = STEM): GlyphMask {
  return maskFromAlpha(alphaFrom(lines, stem), SOURCE, SOURCE, { size: 128 });
}

/** Ink follows the same centre-lines a student would trace. */
function inkFrom(lines: Poly[]): Stroke[] {
  return lines.map(line => ({
    points: line.map(([x, y], i) => ({ x, y, pressure: 0.5, t: i * 16 })),
  }));
}

// A stand-in for ה: a roof, a right leg joined to it, and a detached left leg.
// Chosen because its failure modes are the ones the metrics have to separate —
// omit the roof and coverage should fall while accuracy holds.
const ROOF: Poly = [
  [40, 40],
  [160, 40],
];
const RIGHT_LEG: Poly = [
  [160, 40],
  [160, 160],
];
const LEFT_LEG: Poly = [
  [40, 75],
  [40, 160],
];
const LETTER: Poly[] = [ROOF, RIGHT_LEG, LEFT_LEG];

describe('scoreInk', () => {
  it('scores ink traced along the glyph near 100', () => {
    const result = scoreInk(inkFrom(LETTER), maskFrom(LETTER));

    expect(result.accuracy).toBeGreaterThan(0.95);
    expect(result.coverage).toBeGreaterThan(0.9);
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.verdict).toBe('pass');
  });

  it('scores the same shape written larger and off to one side just as well', () => {
    // Normalization is the whole reason a student can write anywhere on the
    // surface at any size. If this regresses, every score depends on penmanship
    // placement rather than letterform.
    const shifted = LETTER.map(line => line.map(([x, y]) => [x * 1.4 + 30, y * 1.4 - 10] as [number, number]));
    const result = scoreInk(inkFrom(shifted), maskFrom(LETTER));

    expect(result.score).toBeGreaterThanOrEqual(95);
  });

  it('scores a random scribble low', () => {
    const scribble: Poly[] = [
      [
        [50, 150],
        [150, 60],
        [60, 55],
        [140, 145],
        [45, 100],
      ],
    ];
    const result = scoreInk(inkFrom(scribble), maskFrom(LETTER));

    expect(result.score).toBeLessThan(VERDICT_THRESHOLDS.close);
    expect(result.verdict).toBe('miss');
  });

  it('penalises half a letter on coverage, and does not let accuracy rescue it', () => {
    // The two legs, no roof. Every mark the student made is in the right place,
    // so accuracy is as good as a complete trace — the letter is simply not
    // finished. Accuracy alone calls this perfect; a weighted sum of the two
    // metrics still banks the whole accuracy term. Only requiring BOTH to be
    // good separates it from a finished letter.
    const mask = maskFrom(LETTER);
    const full = scoreInk(inkFrom(LETTER), mask);
    const partial = scoreInk(inkFrom([RIGHT_LEG, LEFT_LEG]), mask);

    expect(partial.accuracy).toBeCloseTo(full.accuracy, 1);
    expect(partial.coverage).toBeLessThan(0.7);
    expect(partial.score).toBeLessThan(full.score - 20);
    expect(partial.verdict).not.toBe('pass');
  });

  it('is forgiving of a wobbly hand that still makes the letterform', () => {
    // The tolerance is deliberately about one stem-width. Shape errors are what
    // this grades; unsteady penmanship is not one, and a beginner drilling the
    // alphabet on a tablet has plenty of it.
    let seed = 7;
    const jitter = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed / 2147483648 - 0.5) * 16;
    };
    const wobbly = LETTER.map(([from, to]) =>
      Array.from({ length: 25 }, (_, i) => {
        const t = i / 24;
        return [
          from[0] + (to[0] - from[0]) * t + jitter(),
          from[1] + (to[1] - from[1]) * t + jitter(),
        ] as [number, number];
      }),
    );

    expect(scoreInk(inkFrom(wobbly), maskFrom(LETTER)).verdict).toBe('pass');
  });

  it('penalises a stray mark through spill', () => {
    // Clear of the letter by more than a tolerance-width, which is what makes
    // this a test of spill. A tick drawn just *inside* that distance costs
    // almost nothing, and that is the honest reading: tolerance is one stem
    // width, and a mark that close is within the slop the metric grants
    // everywhere else. It used to score lower, but only as a side effect of the
    // registration artefact removed with #114 — the stray dragged the ink's
    // bounding box, and the letter was marked down for the shift.
    const stray: Poly = [
      [20, 185],
      [45, 188],
    ];
    const clean = scoreInk(inkFrom(LETTER), maskFrom(LETTER));
    const messy = scoreInk(inkFrom([...LETTER, stray]), maskFrom(LETTER));

    expect(messy.spill).toBeGreaterThan(clean.spill);
    expect(messy.score).toBeLessThan(clean.score);
  });

  it('does not let one bad sample decide the spill', () => {
    // Spill reads the worst decile, not the maximum. A single sample flicked
    // off-glyph on pen-up is a hardware artefact, not a mistake.
    const flick: Poly = [
      [160, 160],
      [163, 163],
    ];
    const clean = scoreInk(inkFrom(LETTER), maskFrom(LETTER));
    const flicked = scoreInk(inkFrom([...LETTER, flick]), maskFrom(LETTER));

    expect(flicked.score).toBeGreaterThanOrEqual(clean.score - 2);
  });

  it('scores an empty surface zero rather than dividing by it', () => {
    expect(scoreInk([], maskFrom(LETTER)).score).toBe(0);
    expect(scoreInk([{ points: [] }], maskFrom(LETTER)).score).toBe(0);
  });

  it('scores against an empty mask as a miss rather than NaN', () => {
    const blank = maskFromAlpha(new Uint8Array(SOURCE * SOURCE), SOURCE, SOURCE, { size: 128 });
    const result = scoreInk(inkFrom(LETTER), blank);

    expect(result.score).toBe(0);
    expect(result.verdict).toBe('miss');
    expect(Number.isNaN(result.coverage)).toBe(false);
  });

  it('honours a tighter tolerance', () => {
    const drifted = LETTER.map(line => line.map(([x, y]) => [x + 7, y] as [number, number]));
    const mask = maskFrom(LETTER);

    const lenient = scoreInk(inkFrom(drifted), mask, { tolerance: DEFAULT_TOLERANCE });
    const strict = scoreInk(inkFrom(drifted), mask, { tolerance: 0.01 });

    expect(strict.accuracy).toBeLessThan(lenient.accuracy);
  });

  it('scores a single dot without dividing by zero', () => {
    const dot: Stroke[] = [{ points: [{ x: 100, y: 100, pressure: 0.5, t: 0 }] }];
    const result = scoreInk(dot, maskFrom(LETTER));

    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.verdict).toBe('miss');
  });

  it('scores an attempt without a per-attempt search over the glyph', () => {
    // Uninstrumented this runs at about 0.8ms an attempt — up from ~0.3ms before
    // the registration search (#114), which evaluates ~74 candidate offsets.
    // That is the deliberate price of the fix, and it is paid once when the
    // student taps Compare, never inside a render or a pointer handler.
    //
    // The assertion is far looser than either figure because V8 coverage inflates
    // this roughly tenfold — the search is a tight loop of small calls, which is
    // what that instrumentation costs most — and this suite runs both ways. It is
    // here to catch a regression to a brute-force nearest-point search, which
    // costs three orders of magnitude, not to police tenths of a millisecond.
    const mask = maskFrom(LETTER);
    const ink = inkFrom(LETTER);
    for (let i = 0; i < 10; i++) scoreInk(ink, mask);

    const started = performance.now();
    const runs = 50;
    for (let i = 0; i < runs; i++) scoreInk(ink, mask);
    const per = (performance.now() - started) / runs;

    expect(per).toBeLessThan(25);
  });
});

// ── Placement ────────────────────────────────────────────────────────────────
// A vowel point on a host consonant. The point is a couple of percent of the
// composed glyph's area, so the three area metrics cannot see where it went —
// which is the entire skill the vowel deck drills.

/** A qamets: a short bar centred below the letter. */
const POINT: Poly = [
  [85, 185],
  [115, 185],
];
/** The same bar under the letter's left edge instead — a wrong qamets. */
const POINT_LEFT: Poly = [
  [45, 185],
  [75, 185],
];
const POINTED: Poly[] = [...LETTER, POINT];

/**
 * The whole-and-mark pair, built the way `rasterizeComposite` builds it:
 * both fitted to the composed form's bounds, so they share one frame.
 */
function compositeFrom(whole: Poly[], base: Poly[]): { whole: GlyphMask; mark: GlyphMask } {
  const wholeAlpha = alphaFrom(whole);
  const baseAlpha = alphaFrom(base);
  const bounds = alphaBounds(wholeAlpha, SOURCE, SOURCE);
  if (!bounds) throw new Error('expected ink');

  const markAlpha = new Uint8Array(wholeAlpha.length);
  for (let i = 0; i < markAlpha.length; i++) {
    markAlpha[i] = baseAlpha[i] >= 128 ? 0 : wholeAlpha[i];
  }

  return {
    whole: maskFromAlpha(wholeAlpha, SOURCE, SOURCE, { size: 128, bounds }),
    mark: maskFromAlpha(markAlpha, SOURCE, SOURCE, { size: 128, bounds }),
  };
}

describe('scoreInk placement', () => {
  const composite = compositeFrom(POINTED, LETTER);

  it('is null when the caller nominates no sub-region', () => {
    // Null and zero are different answers, and the readout depends on it.
    expect(scoreInk(inkFrom(POINTED), composite.whole).placement).toBeNull();
  });

  it('is high for a point written where it belongs', () => {
    const result = scoreInk(inkFrom(POINTED), composite.whole, { part: composite.mark });

    expect(result.placement).toBeGreaterThan(0.85);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('collapses for a correctly-shaped point in the wrong place', () => {
    // The acceptance criterion for the vowel deck, and the reason this metric
    // exists at all: everything about this attempt is right except *where* the
    // qamets went, and it has to read as a miss.
    //
    // The bar lands about a third of its own length from where it belongs —
    // deliberately a near miss, so the two are closer than a tolerance-width at
    // their nearest ends and some overlap is arithmetic rather than credit. The
    // claim worth pinning is the verdict and the collapse in score, not a
    // particular fraction; `far misplacement` below pins the clean-zero case.
    const misplaced = [...LETTER, POINT_LEFT];
    const result = scoreInk(inkFrom(misplaced), composite.whole, { part: composite.mark });

    expect(result.placement).toBeLessThan(0.35);
    expect(result.score).toBeLessThan(VERDICT_THRESHOLDS.close);
    expect(result.verdict).toBe('miss');
  });

  it('does not let the registration search slide a mark into its slot', () => {
    // The guard on #114's translation search, and the reason that search is
    // bounded and driven by shape alone. A mark written where a different vowel
    // goes is half a box from its slot — far outside the search — and letting
    // placement vote on the alignment would have the search trade a little
    // letterform accuracy for exactly the rescue this must never grant.
    const above: Poly = [
      [85, 25],
      [115, 25],
    ];
    const result = scoreInk(inkFrom([...LETTER, above]), composite.whole, {
      part: composite.mark,
    });

    expect(result.placement).toBe(0);
    expect(result.verdict).toBe('miss');
  });

  it('is the only metric that notices, which is why it is not optional', () => {
    // Without the part mask the same misplaced attempt still passes: the point
    // is a rounding error against the host consonant's area.
    const misplaced = inkFrom([...LETTER, POINT_LEFT]);
    const blind = scoreInk(misplaced, composite.whole);
    const graded = scoreInk(misplaced, composite.whole, { part: composite.mark });

    expect(blind.verdict).toBe('pass');
    expect(graded.score).toBeLessThan(blind.score - 30);
  });

  it('falls when the point is omitted entirely', () => {
    const result = scoreInk(inkFrom(LETTER), composite.whole, { part: composite.mark });

    expect(result.placement).toBeLessThan(0.2);
    expect(result.verdict).toBe('miss');
  });

  it('ignores an empty sub-region rather than failing every attempt', () => {
    // A font that draws no difference between the composed form and its base
    // must degrade to plain shape scoring, not mark everything wrong.
    const empty = maskFromAlpha(new Uint8Array(SOURCE * SOURCE), SOURCE, SOURCE, { size: 128 });
    const result = scoreInk(inkFrom(POINTED), composite.whole, { part: empty });

    expect(result.placement).toBeNull();
    expect(result.score).toBe(scoreInk(inkFrom(POINTED), composite.whole).score);
  });

  it('ignores a sub-region from a different grid', () => {
    // Two grids are two frames, and comparing across them would be nonsense.
    const other = maskFromAlpha(alphaFrom([POINT]), SOURCE, SOURCE, { size: 64 });
    expect(scoreInk(inkFrom(POINTED), composite.whole, { part: other }).placement).toBeNull();
  });

  it('leaves the empty-ink result unplaced', () => {
    expect(scoreInk([], composite.whole, { part: composite.mark }).placement).toBeNull();
  });
});

describe('verdictFor', () => {
  it('splits at the documented thresholds', () => {
    expect(verdictFor(100)).toBe('pass');
    expect(verdictFor(VERDICT_THRESHOLDS.pass)).toBe('pass');
    expect(verdictFor(VERDICT_THRESHOLDS.pass - 1)).toBe('close');
    expect(verdictFor(VERDICT_THRESHOLDS.close)).toBe('close');
    expect(verdictFor(VERDICT_THRESHOLDS.close - 1)).toBe('miss');
    expect(verdictFor(0)).toBe('miss');
  });
});

// ── Registration (#114) ──────────────────────────────────────────────────────
// Both the ink and the mask are fitted to their own bounds, which makes absolute
// position irrelevant — that part always worked. What did not is that the fit is
// pinned by the *extreme* points, so one stroke overshooting the reference's
// ceiling shifts the whole letter body and every metric downstream reads the
// shift as letterform error.

/** The letter, drawn correctly, but with the right leg started `over` px high. */
function overshootBy(over: number): Poly[] {
  return [
    ROOF,
    [
      [160, 40 - over],
      [160, 160],
    ],
    LEFT_LEG,
  ];
}

describe('scoreInk registration', () => {
  it('does not mark down a legible letter for where its bounding box landed', () => {
    // The reported bug, reduced to the fixture. An overshoot of 22 source pixels
    // — about a tenth of the box, the same order as the offset measured on the
    // real attempt — used to cost 21 points and drop a correct letter from
    // "Good match" to "Not there yet". The letterform itself is untouched.
    const result = scoreInk(inkFrom(overshootBy(22)), maskFrom(LETTER));

    expect(result.verdict).toBe('pass');
    expect(result.score).toBeGreaterThanOrEqual(95);
    // Coverage is where the artefact showed up worst: 0.69 unregistered.
    expect(result.coverage).toBeGreaterThan(0.9);
  });

  it('reports the offset it scored at, bounded by the search', () => {
    const result = scoreInk(inkFrom(overshootBy(22)), maskFrom(LETTER));

    // Non-zero, because correcting the overshoot is the whole point here.
    expect(Math.abs(result.offset.y)).toBeGreaterThan(0);
    expect(Math.abs(result.offset.x)).toBeLessThanOrEqual(MAX_REGISTRATION_SHIFT);
    expect(Math.abs(result.offset.y)).toBeLessThanOrEqual(MAX_REGISTRATION_SHIFT);
  });

  it('leaves well-registered ink where it is', () => {
    // The search is seeded at the identity offset and only moves on a strict
    // improvement, so an attempt that needs no correction reports none — and a
    // score that was already right cannot drift.
    const result = scoreInk(inkFrom(LETTER), maskFrom(LETTER));

    expect(result.offset).toEqual({ x: 0, y: 0 });
    expect(result.score).toBe(100);
  });

  it('still fails ink that is the wrong shape, however it is shifted', () => {
    // The bound is what keeps "best placement" from becoming "best excuse".
    const scribble: Poly[] = [
      [
        [50, 150],
        [150, 60],
        [60, 55],
        [140, 145],
        [45, 100],
      ],
    ];
    const result = scoreInk(inkFrom(scribble), maskFrom(LETTER));

    expect(result.verdict).toBe('miss');
  });
});
