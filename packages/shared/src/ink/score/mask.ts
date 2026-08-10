// Glyph masks — the reference the student's ink is scored against.
//
// The app already loads a webfont to draw the reference glyph, so the font IS
// the answer key. Rasterize the glyph, threshold its alpha channel, normalize
// it into a square box, and precompute a distance transform. No hand-authored
// outline data and no model.
//
// The split here is the same one the rest of `ink/` uses: `rasterizeGlyph` is
// the only function that touches a canvas, and everything that decides
// anything — normalization, thresholding, the distance transform — is pure and
// operates on a plain `Uint8Array`.

/** A glyph reduced to a square binary grid, with distances precomputed. */
export interface GlyphMask {
  /** Side length of the square grid, in mask pixels. */
  size: number;
  /** Fraction of `size` left empty on each side. Ink must normalize to match. */
  padding: number;
  /** 1 where the glyph covers the cell, 0 elsewhere. Row-major, `size` × `size`. */
  bits: Uint8Array;
  /** Distance in mask pixels from each cell to the nearest set bit. */
  distance: Float32Array;
  /** How many cells are set. Zero for whitespace, or a glyph the font lacks. */
  filled: number;
}

/**
 * Side of the scoring grid.
 *
 * 128, not the 256 the plan called for. A mask's own distance transform is
 * computed once and cached, but the *ink's* is rebuilt on every attempt, and
 * both are linear in cell count — so the grid side lands quadratically on the
 * per-attempt cost: 256 measures at ~1.15ms an attempt against 128's ~0.32ms.
 *
 * Nothing is lost. At 128 a text-weight stem is still some fifteen cells across
 * and the shin dot about eight, which is far more resolution than a metric that
 * only asks which cells are occupied can use.
 */
export const DEFAULT_MASK_SIZE = 128;

/**
 * Side of the intermediate raster the glyph is drawn into before normalizing.
 *
 * Larger than the mask on purpose: the normalize step measures area coverage on
 * the way down, which is what keeps a thin stem from disappearing between
 * sample points. Rasterizing happens once per glyph, so the size is cheap.
 */
export const DEFAULT_SOURCE_SIZE = 512;

/** Empty margin around the normalized glyph, as a fraction of `size`. */
export const DEFAULT_MASK_PADDING = 0.05;

/** Alpha at or above this counts as ink in the source raster. */
export const DEFAULT_ALPHA_THRESHOLD = 128;

/**
 * Fraction of a mask cell's source pixels that must be ink for it to be set.
 *
 * Deliberately below a half. Rounding "more than half covered" is the textbook
 * rule, but a two-pixel stem that straddles two output cells is 50% in each and
 * would vanish from both — and a ו is nothing but that stem.
 */
export const DEFAULT_CELL_COVERAGE = 0.35;

// Chamfer 3-4 weights. Integer arithmetic through both passes, divided back to
// pixels at the end — a 3-4 chamfer approximates Euclidean distance to within
// about 6%, which is far tighter than the tolerances anything downstream uses.
const ORTHO = 3;
const DIAG = 4;

/**
 * Distance from every cell to the nearest set bit, in cells.
 *
 * Two-pass chamfer: a forward sweep propagates distances from the causal
 * neighbours (the row above, and leftward in this row), a backward sweep from
 * the anticausal half. Linear in the number of cells, with no queue.
 *
 * A grid with no set bits comes back uniformly saturated rather than infinite,
 * so arithmetic downstream stays finite. Callers should check `filled` instead
 * of inspecting these values.
 */
export function distanceTransform(bits: Uint8Array, size: number): Float32Array {
  const d = new Float32Array(size * size);
  // Larger than any real chamfer path across the grid, which tops out near
  // size * DIAG on the corner-to-corner diagonal.
  const far = size * (ORTHO + DIAG);
  for (let i = 0; i < d.length; i++) d[i] = bits[i] ? 0 : far;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let best = d[i];
      if (best === 0) continue;
      if (y > 0) {
        if (x > 0) best = Math.min(best, d[i - size - 1] + DIAG);
        best = Math.min(best, d[i - size] + ORTHO);
        if (x + 1 < size) best = Math.min(best, d[i - size + 1] + DIAG);
      }
      if (x > 0) best = Math.min(best, d[i - 1] + ORTHO);
      d[i] = best;
    }
  }

  for (let y = size - 1; y >= 0; y--) {
    for (let x = size - 1; x >= 0; x--) {
      const i = y * size + x;
      let best = d[i];
      if (best === 0) continue;
      if (x + 1 < size) best = Math.min(best, d[i + 1] + ORTHO);
      if (y + 1 < size) {
        if (x > 0) best = Math.min(best, d[i + size - 1] + DIAG);
        best = Math.min(best, d[i + size] + ORTHO);
        if (x + 1 < size) best = Math.min(best, d[i + size + 1] + DIAG);
      }
      d[i] = best;
    }
  }

  for (let i = 0; i < d.length; i++) d[i] /= ORTHO;
  return d;
}

export interface MaskOptions {
  /** Output grid side. Defaults to `DEFAULT_MASK_SIZE`. */
  size?: number;
  /** Empty margin on each side, as a fraction of `size`. */
  padding?: number;
  /** Alpha at or above this counts as ink in the source raster. */
  threshold?: number;
  /** Fraction of a cell's source pixels that must be ink to set the cell. */
  cellCoverage?: number;
}

/** Build an all-empty mask of the given geometry. */
function emptyMask(size: number, padding: number): GlyphMask {
  const bits = new Uint8Array(size * size);
  return { size, padding, bits, distance: distanceTransform(bits, size), filled: 0 };
}

/**
 * Normalize a rasterized alpha channel into a `GlyphMask`.
 *
 * The glyph is fitted to its own ink bounds and centered, preserving aspect
 * ratio — the same convention `normalizeStrokes` applies to the student's ink,
 * which is what makes the two comparable no matter how large either was drawn.
 * Preserving aspect ratio is not optional: stretching a ו to fill the square
 * would make it indistinguishable from a ד.
 *
 * Downsampling measures each output cell's area coverage rather than point-
 * sampling it, so a stem narrower than the sampling stride still survives.
 */
export function maskFromAlpha(
  alpha: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  options: MaskOptions = {},
): GlyphMask {
  const size = options.size ?? DEFAULT_MASK_SIZE;
  const padding = options.padding ?? DEFAULT_MASK_PADDING;
  const threshold = options.threshold ?? DEFAULT_ALPHA_THRESHOLD;
  const cellCoverage = options.cellCoverage ?? DEFAULT_CELL_COVERAGE;

  let minX = sourceWidth;
  let minY = sourceHeight;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sourceHeight; y++) {
    for (let x = 0; x < sourceWidth; x++) {
      if (alpha[y * sourceWidth + x] < threshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return emptyMask(size, padding);

  // Bounds are inclusive cell indices; the covered region is one cell wider.
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const inner = size * (1 - 2 * padding);
  const offset = size * padding;
  const scale = inner / Math.max(width, height);
  const dx = offset + (inner - width * scale) / 2;
  const dy = offset + (inner - height * scale) / 2;

  const bits = new Uint8Array(size * size);
  let filled = 0;

  // Sampling is clamped to the glyph's own bounds, not the source raster's.
  // Clamping to the raster would let an output cell that maps entirely outside
  // the glyph still read the nearest edge pixel — which smears a solid glyph
  // across the whole grid and quietly ignores `padding`.
  for (let oy = 0; oy < size; oy++) {
    // Source span this output row covers, in source pixels.
    const sy0 = (oy - dy) / scale + minY;
    const sy1 = (oy + 1 - dy) / scale + minY;
    if (sy1 <= minY || sy0 >= maxY + 1) continue;
    const iy0 = Math.max(minY, Math.floor(sy0));
    const iy1 = Math.min(maxY + 1, Math.max(iy0 + 1, Math.ceil(sy1)));

    for (let ox = 0; ox < size; ox++) {
      const sx0 = (ox - dx) / scale + minX;
      const sx1 = (ox + 1 - dx) / scale + minX;
      if (sx1 <= minX || sx0 >= maxX + 1) continue;
      const ix0 = Math.max(minX, Math.floor(sx0));
      const ix1 = Math.min(maxX + 1, Math.max(ix0 + 1, Math.ceil(sx1)));

      let inked = 0;
      let count = 0;
      for (let sy = iy0; sy < iy1; sy++) {
        const row = sy * sourceWidth;
        for (let sx = ix0; sx < ix1; sx++) {
          if (alpha[row + sx] >= threshold) inked++;
          count++;
        }
      }
      if (count > 0 && inked / count >= cellCoverage) {
        bits[oy * size + ox] = 1;
        filled++;
      }
    }
  }

  return { size, padding, bits, distance: distanceTransform(bits, size), filled };
}

export interface RasterizeOptions extends MaskOptions {
  /** CSS font-family value — the same one the reference glyph is drawn with. */
  fontFamily: string;
  direction?: 'rtl' | 'ltr';
  /** Side of the intermediate raster. Defaults to `DEFAULT_SOURCE_SIZE`. */
  sourceSize?: number;
}

/** A square 2D drawing surface, however this environment provides one. */
function createSurface(side: number): CanvasRenderingContext2D | null {
  try {
    if (typeof OffscreenCanvas === 'function') {
      const ctx = new OffscreenCanvas(side, side).getContext('2d');
      // OffscreenCanvas' context is structurally the same for what we use.
      if (ctx) return ctx as unknown as CanvasRenderingContext2D;
    }
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    return canvas.getContext('2d');
  } catch {
    // A blocked or unimplemented canvas must degrade to "no score", not throw
    // in the middle of a study session.
    return null;
  }
}

/**
 * Rasterize a glyph and reduce it to a mask.
 *
 * The only canvas-touching function in the scoring path. Returns null when no
 * 2D context is available, which callers should treat as "fall back to
 * self-assessment" rather than as an error.
 *
 * The caller is responsible for having awaited the webfont — see
 * `loadGlyphMask`, which is the entry point that gets that right.
 */
export function rasterizeGlyph(text: string, options: RasterizeOptions): GlyphMask | null {
  const source = options.sourceSize ?? DEFAULT_SOURCE_SIZE;
  const ctx = createSurface(source);
  if (!ctx) return null;

  ctx.clearRect(0, 0, source, source);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 0.6em leaves room for a descender (ק, ן) and for combining marks below the
  // baseline without either clipping at the raster's edge.
  ctx.font = `${Math.round(source * 0.6)}px ${options.fontFamily}`;
  ctx.direction = options.direction ?? 'rtl';
  ctx.fillText(text, source / 2, source / 2);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, source, source).data;
  } catch {
    return null;
  }

  const alpha = new Uint8Array(source * source);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return maskFromAlpha(alpha, source, source, options);
}

const cache = new Map<string, GlyphMask | null>();

function cacheKey(text: string, options: RasterizeOptions): string {
  return [
    text,
    options.fontFamily,
    options.direction ?? 'rtl',
    options.size ?? DEFAULT_MASK_SIZE,
    options.sourceSize ?? DEFAULT_SOURCE_SIZE,
    options.padding ?? DEFAULT_MASK_PADDING,
    options.threshold ?? DEFAULT_ALPHA_THRESHOLD,
    options.cellCoverage ?? DEFAULT_CELL_COVERAGE,
  ].join('|');
}

export interface LoadMaskOptions extends RasterizeOptions {
  /** CSS font shorthand passed to `document.fonts.load()`. */
  fontLoadSpec?: string;
}

/**
 * The mask for a glyph, rasterized once and reused.
 *
 * Awaits the webfont before rasterizing. That await is the whole reason this
 * function exists: rasterize early and the mask is a fallback letterform, so
 * every score computed against it is wrong in a way nothing downstream can
 * detect. A font that fails to load still produces a mask, matching how
 * `InkCanvas` degrades rather than leaving the surface blank.
 */
export async function loadGlyphMask(
  text: string,
  options: LoadMaskOptions,
): Promise<GlyphMask | null> {
  const key = cacheKey(text, options);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  if (options.fontLoadSpec && typeof document !== 'undefined' && document.fonts) {
    await document.fonts.load(options.fontLoadSpec).catch(() => undefined);
  }

  const mask = rasterizeGlyph(text, options);
  cache.set(key, mask);
  return mask;
}

/** Drop every cached mask. For tests, and for a font that loads late. */
export function clearGlyphMaskCache(): void {
  cache.clear();
}
