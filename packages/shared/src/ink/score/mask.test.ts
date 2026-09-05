import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  alphaBounds,
  clearGlyphMaskCache,
  DEFAULT_MASK_PADDING,
  DEFAULT_MASK_SIZE,
  distanceTransform,
  type GlyphMask,
  loadCompositeMask,
  loadGlyphMask,
  maskFromAlpha,
  rasterizeComposite,
  rasterizeGlyph,
} from './mask';

/** A source alpha channel with `fill(x, y)` deciding coverage. */
function alphaGrid(width: number, height: number, fill: (x: number, y: number) => boolean) {
  const a = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) a[y * width + x] = fill(x, y) ? 255 : 0;
  }
  return a;
}

/** Inclusive bounds of the set bits, or null when there are none. */
function bitsBox(mask: GlyphMask) {
  let minX = mask.size;
  let minY = mask.size;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.size; y++) {
    for (let x = 0; x < mask.size; x++) {
      if (!mask.bits[y * mask.size + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

describe('distanceTransform', () => {
  it('is zero on the glyph and grows with distance from it', () => {
    const size = 9;
    const bits = new Uint8Array(size * size);
    bits[4 * size + 4] = 1;
    const d = distanceTransform(bits, size);

    expect(d[4 * size + 4]).toBe(0);
    expect(d[4 * size + 5]).toBeCloseTo(1, 5);
    expect(d[4 * size + 7]).toBeCloseTo(3, 5);
    expect(d[0 * size + 4]).toBeCloseTo(4, 5);
  });

  it('approximates the Euclidean diagonal within chamfer error', () => {
    const size = 9;
    const bits = new Uint8Array(size * size);
    bits[4 * size + 4] = 1;
    const d = distanceTransform(bits, size);

    // Chamfer 3-4 puts the unit diagonal at 4/3 against a true sqrt(2).
    expect(d[5 * size + 5]).toBeCloseTo(4 / 3, 5);
    expect(Math.abs(d[5 * size + 5] - Math.SQRT2)).toBeLessThan(0.1);
  });

  it('propagates in both directions, not just forward', () => {
    // A set bit in the bottom-right can only reach the top-left on the
    // backward pass. A single-pass implementation leaves this saturated.
    const size = 8;
    const bits = new Uint8Array(size * size);
    bits[7 * size + 7] = 1;
    const d = distanceTransform(bits, size);

    expect(d[0]).toBeCloseTo(7 * (4 / 3), 5);
  });

  it('saturates rather than returning Infinity for an empty grid', () => {
    const d = distanceTransform(new Uint8Array(16), 4);
    expect(d.every((v) => Number.isFinite(v) && v > 4)).toBe(true);
  });
});

describe('maskFromAlpha', () => {
  it('fits the glyph to the padded box', () => {
    // A small blob in the corner of the source still fills the mask's box.
    const alpha = alphaGrid(64, 64, (x, y) => x < 8 && y < 8);
    const mask = maskFromAlpha(alpha, 64, 64, { size: 100, padding: 0.1 });

    const box = bitsBox(mask);
    expect(box).not.toBeNull();
    // Inner box is 80 wide, offset 10 — allow a pixel of rounding at each edge.
    expect(box?.minX).toBeLessThanOrEqual(11);
    expect(box?.maxX).toBeGreaterThanOrEqual(89);
    expect(box?.minY).toBeLessThanOrEqual(11);
    expect(box?.maxY).toBeGreaterThanOrEqual(89);
  });

  it('preserves aspect ratio and centers the short axis', () => {
    // A tall bar must stay tall. Stretching it to fill the square is exactly
    // how a ו becomes indistinguishable from a ד.
    const alpha = alphaGrid(64, 64, (x, y) => x >= 30 && x < 34 && y >= 8 && y < 56);
    const mask = maskFromAlpha(alpha, 64, 64, { size: 100, padding: 0 });

    const box = bitsBox(mask);
    if (!box) throw new Error('expected ink');
    const width = box.maxX - box.minX + 1;
    const height = box.maxY - box.minY + 1;

    expect(height).toBeGreaterThan(95);
    // 4/48 of the height, scaled to a 100-tall box.
    expect(width).toBeLessThan(15);
    // Centered horizontally.
    expect(Math.abs((box.minX + box.maxX) / 2 - 50)).toBeLessThan(2);
  });

  it('counts filled cells and records its geometry', () => {
    const alpha = alphaGrid(32, 32, () => true);
    const mask = maskFromAlpha(alpha, 32, 32, { size: 40, padding: 0.25 });

    // A solid source fills the entire inner box: 20 x 20 of the 40 x 40 grid.
    expect(mask.filled).toBe(400);
    expect(mask.size).toBe(40);
    expect(mask.padding).toBe(0.25);
    expect(mask.distance).toHaveLength(1600);
  });

  it('keeps a stem that straddles two output cells', () => {
    // Production downsamples 512 -> 256. A 2px stem landing half in each of two
    // output cells is 50% covered in both, so a "more than half" rule drops it
    // from both and the letter disappears. A ו is nothing but this stem.
    const alpha = alphaGrid(512, 512, (x, y) => x >= 255 && x < 257 && y >= 32 && y < 480);
    const mask = maskFromAlpha(alpha, 512, 512, { size: 256, padding: 0 });

    const box = bitsBox(mask);
    if (!box) throw new Error('the stem was dropped entirely');
    expect(box.maxY - box.minY + 1).toBeGreaterThan(250);
    expect(box.maxX - box.minX + 1).toBeLessThanOrEqual(3);
  });

  it('ignores cells that map outside the glyph, so padding is honoured', () => {
    // Clamping the sample window to the source raster instead of to the glyph
    // lets an out-of-box cell read the nearest edge pixel, which smears a solid
    // glyph across the entire grid.
    const mask = maskFromAlpha(
      alphaGrid(32, 32, () => true),
      32,
      32,
      { size: 40, padding: 0.25 },
    );
    const box = bitsBox(mask);

    expect(box?.minX).toBeGreaterThanOrEqual(9);
    expect(box?.maxX).toBeLessThanOrEqual(30);
  });

  it('returns an empty mask for blank input', () => {
    const mask = maskFromAlpha(new Uint8Array(64), 8, 8, { size: 16 });

    expect(mask.filled).toBe(0);
    expect(mask.bits.every((b) => b === 0)).toBe(true);
    expect(mask.distance).toHaveLength(256);
  });

  it('treats alpha below the threshold as uncovered', () => {
    const faint = new Uint8Array(64).fill(100);
    expect(maskFromAlpha(faint, 8, 8, { size: 16, threshold: 128 }).filled).toBe(0);
    expect(maskFromAlpha(faint, 8, 8, { size: 16, threshold: 64 }).filled).toBeGreaterThan(0);
  });

  it('defaults to the documented geometry', () => {
    const mask = maskFromAlpha(
      alphaGrid(8, 8, () => true),
      8,
      8,
    );
    expect(mask.size).toBe(DEFAULT_MASK_SIZE);
    expect(mask.padding).toBe(DEFAULT_MASK_PADDING);
  });
});

describe('rasterizeGlyph', () => {
  it('returns null when no 2D context is available', () => {
    // happy-dom has no canvas implementation. A study session must degrade to
    // self-assessment here, not throw.
    expect(rasterizeGlyph('א', { fontFamily: 'serif' })).toBeNull();
  });

  it('returns null when the context cannot be read back', () => {
    const ctx = {
      clearRect: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(() => {
        throw new Error('tainted');
      }),
    };
    const spy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ getContext: () => ctx } as unknown as HTMLElement);

    expect(rasterizeGlyph('א', { fontFamily: 'serif' })).toBeNull();
    spy.mockRestore();
  });

  it('rasterizes the alpha channel through maskFromAlpha', () => {
    const source = 16;
    // A fake context that "draws" a solid 4x4 block, alpha only.
    const data = new Uint8ClampedArray(source * source * 4);
    for (let y = 4; y < 8; y++) {
      for (let x = 4; x < 8; x++) data[(y * source + x) * 4 + 3] = 255;
    }
    const ctx = {
      clearRect: vi.fn(),
      fillText: vi.fn(),
      getImageData: vi.fn(() => ({ data })),
    };
    const spy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ getContext: () => ctx } as unknown as HTMLElement);

    const mask = rasterizeGlyph('א', {
      fontFamily: 'serif',
      sourceSize: source,
      size: 10,
      padding: 0,
    });

    expect(ctx.fillText).toHaveBeenCalledWith('א', 8, 8);
    expect(mask?.filled).toBe(100);
    spy.mockRestore();
  });
});

describe('loadGlyphMask', () => {
  beforeEach(() => {
    clearGlyphMaskCache();
  });

  it('awaits the webfont before rasterizing', async () => {
    // The whole reason this function exists. Rasterizing early produces a
    // fallback letterform, and every score against it is silently wrong.
    const order: string[] = [];
    const load = vi.fn(async () => {
      order.push('font');
      return [];
    });
    vi.stubGlobal('document', {
      ...document,
      fonts: { load },
      createElement: () => {
        order.push('raster');
        return { getContext: () => null };
      },
    });

    await loadGlyphMask('א', { fontFamily: 'serif', fontLoadSpec: '16px serif' });

    expect(load).toHaveBeenCalledWith('16px serif');
    expect(order).toEqual(['font', 'raster']);
    vi.unstubAllGlobals();
  });

  it('still produces a mask when the font fails to load', async () => {
    const load = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('document', {
      ...document,
      fonts: { load },
      createElement: () => ({ getContext: () => null }),
    });

    await expect(
      loadGlyphMask('א', { fontFamily: 'serif', fontLoadSpec: '16px serif' }),
    ).resolves.toBeNull();
    vi.unstubAllGlobals();
  });

  it('rasterizes each glyph once', async () => {
    const createElement = vi.fn(() => ({ getContext: () => null }));
    vi.stubGlobal('document', { ...document, fonts: undefined, createElement });

    await loadGlyphMask('א', { fontFamily: 'serif' });
    await loadGlyphMask('א', { fontFamily: 'serif' });
    await loadGlyphMask('ב', { fontFamily: 'serif' });

    expect(createElement).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('keys the cache by geometry, not just by text', async () => {
    const createElement = vi.fn(() => ({ getContext: () => null }));
    vi.stubGlobal('document', { ...document, fonts: undefined, createElement });

    await loadGlyphMask('א', { fontFamily: 'serif', size: 64 });
    await loadGlyphMask('א', { fontFamily: 'serif', size: 128 });

    expect(createElement).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});

describe('alphaBounds', () => {
  it('reports the inclusive box of everything at or above the threshold', () => {
    const alpha = alphaGrid(16, 16, (x, y) => x >= 3 && x <= 9 && y >= 5 && y <= 6);
    expect(alphaBounds(alpha, 16, 16)).toEqual({ minX: 3, minY: 5, maxX: 9, maxY: 6 });
  });

  it('is null for a blank raster', () => {
    expect(alphaBounds(new Uint8Array(256), 16, 16)).toBeNull();
  });

  it('honours the threshold', () => {
    const faint = new Uint8Array(256).fill(100);
    expect(alphaBounds(faint, 16, 16, 128)).toBeNull();
    expect(alphaBounds(faint, 16, 16, 64)).not.toBeNull();
  });
});

describe('maskFromAlpha with explicit bounds', () => {
  // The mechanism behind placement scoring. Fitted to its own bounds a mark is
  // "a bar filling the grid" and says nothing about where it was written;
  // fitted to the composed glyph's bounds it is a bar in one place.
  const MARK = { minX: 0, minY: 24, maxX: 31, maxY: 31 };

  it('fits to the given box rather than the alpha it is handed', () => {
    // Ink in the bottom eighth of a 32-square, framed by the whole square.
    const alpha = alphaGrid(32, 32, (_, y) => y >= 24);
    const own = maskFromAlpha(alpha, 32, 32, { size: 64, padding: 0 });
    const framed = maskFromAlpha(alpha, 32, 32, {
      size: 64,
      padding: 0,
      bounds: { minX: 0, minY: 0, maxX: 31, maxY: 31 },
    });

    // Fitted to itself, the bar is centred — it has forgotten where it was.
    expect(bitsBox(own)?.minY).toBe(24);
    expect(bitsBox(own)?.maxY).toBe(39);
    // Framed by the square, it stays in the bottom quarter where it belongs.
    expect(bitsBox(framed)?.minY).toBe(48);
    expect(bitsBox(framed)?.maxY).toBe(63);
  });

  it('clips anything outside the frame', () => {
    // A stray mark beyond the composed glyph's box is not part of the glyph.
    const alpha = alphaGrid(32, 32, (_, y) => y >= 24);
    const mask = maskFromAlpha(alpha, 32, 32, { size: 64, padding: 0, bounds: MARK });
    const clipped = maskFromAlpha(alpha, 32, 32, {
      size: 64,
      padding: 0,
      bounds: { minX: 0, minY: 0, maxX: 31, maxY: 15 },
    });

    expect(mask.filled).toBeGreaterThan(0);
    expect(clipped.filled).toBe(0);
  });

  it('still returns a well-formed empty mask for an empty region', () => {
    const mask = maskFromAlpha(new Uint8Array(1024), 32, 32, { size: 16, bounds: MARK });
    expect(mask.filled).toBe(0);
    expect(mask.size).toBe(16);
    expect(mask.distance).toHaveLength(256);
  });
});

// ── A stand-in renderer ──────────────────────────────────────────────────────
// Lays glyphs out right-to-left from an anchor, with combining marks drawn
// under the preceding letter and taking no advance of their own. That is the
// one property of real text layout `rasterizeComposite` depends on, and the
// one that breaks under a centred anchor.

const COMPOSITE_SOURCE = 400;
const CHAR_W = 40;
const CHAR_H = 100;
const MARK_W = 20;
const MARK_H = 10;
const COMBINING = new Set(['ָ']); // qamets

type Rect = [number, number, number, number];

function layout(text: string, x: number, align: string): Rect[] {
  const advance = [...text].filter((c) => !COMBINING.has(c)).length * CHAR_W;
  const right = align === 'right' ? x : align === 'left' ? x + advance : x + advance / 2;
  const top = COMPOSITE_SOURCE / 2 - CHAR_H / 2;

  const rects: Rect[] = [];
  let cursor = right;
  for (const ch of text) {
    if (COMBINING.has(ch)) {
      rects.push([cursor + (CHAR_W - MARK_W) / 2, top + CHAR_H, MARK_W, MARK_H]);
    } else {
      cursor -= CHAR_W;
      rects.push([cursor, top, CHAR_W, CHAR_H]);
    }
  }
  return rects;
}

/** Install a canvas that paints via `layout`, returning the recorded calls. */
function stubRenderer() {
  const calls: { text: string; x: number; align: string; direction: string }[] = [];
  const createElement = vi.fn(() => {
    const data = new Uint8ClampedArray(COMPOSITE_SOURCE * COMPOSITE_SOURCE * 4);
    const ctx = {
      textAlign: 'center',
      textBaseline: '',
      direction: 'rtl',
      font: '',
      fillStyle: '',
      clearRect: vi.fn(),
      getImageData: () => ({ data }),
      fillText(text: string, x: number) {
        calls.push({ text, x, align: ctx.textAlign, direction: ctx.direction });
        for (const [rx, ry, w, h] of layout(text, x, ctx.textAlign)) {
          for (let y = Math.round(ry); y < ry + h; y++) {
            for (let px = Math.round(rx); px < rx + w; px++) {
              data[(y * COMPOSITE_SOURCE + px) * 4 + 3] = 255;
            }
          }
        }
      },
    };
    return { getContext: () => ctx };
  });
  vi.stubGlobal('document', { ...document, fonts: undefined, createElement });
  return calls;
}

const COMPOSITE_OPTIONS = {
  fontFamily: 'serif',
  sourceSize: COMPOSITE_SOURCE,
  size: 128,
  padding: 0,
} as const;

describe('rasterizeComposite', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('anchors both renderings on the same edge', () => {
    // The load-bearing detail. Centring would put the pe of 'פָ' and the pe of
    // 'פ' on different pixels, and the difference between them would be a
    // pe-shaped ghost rather than a vowel point.
    const calls = stubRenderer();
    rasterizeComposite('פָ', 'פ', COMPOSITE_OPTIONS);

    expect(calls).toHaveLength(2);
    expect(calls[0].x).toBe(calls[1].x);
    expect(calls.every((c) => c.align === 'right')).toBe(true);
  });

  it('anchors on the left edge under ltr', () => {
    const calls = stubRenderer();
    rasterizeComposite('ab', 'a', { ...COMPOSITE_OPTIONS, direction: 'ltr' });

    expect(calls.every((c) => c.align === 'left')).toBe(true);
    expect(calls[0].x).toBe(calls[1].x);
  });

  it('isolates the mark and drops the base it was drawn on', () => {
    stubRenderer();
    const composite = rasterizeComposite('פָ', 'פ', COMPOSITE_OPTIONS);
    if (!composite) throw new Error('expected a composite mask');

    // The mark is 20x10 against the letter's 40x100 — a couple of percent of
    // the whole, which is precisely why it needs measuring separately.
    expect(composite.mark.filled).toBeGreaterThan(0);
    expect(composite.mark.filled / composite.whole.filled).toBeLessThan(0.1);
  });

  it('places the mark within the whole glyph rather than fitting it to itself', () => {
    stubRenderer();
    const composite = rasterizeComposite('פָ', 'פ', COMPOSITE_OPTIONS);
    const box = bitsBox(composite?.mark as GlyphMask);
    if (!box) throw new Error('expected mark ink');

    // A qamets sits below the letter and centred on it. Fitted to its own
    // bounds it would fill the grid, and every position would score alike.
    expect(box.minY).toBeGreaterThan(0.85 * 128);
    expect(box.maxY).toBeLessThanOrEqual(127);
    expect(Math.abs((box.minX + box.maxX) / 2 - 64)).toBeLessThan(6);
  });

  it('isolates an advancing mark, which a centred anchor could not', () => {
    // Shureq is a vav carrying a dagesh: the composed form is *wider* than its
    // base, so a centred layout shifts the base between the two renderings.
    stubRenderer();
    const composite = rasterizeComposite('פו', 'פ', COMPOSITE_OPTIONS);
    const box = bitsBox(composite?.mark as GlyphMask);
    if (!box) throw new Error('expected mark ink');

    // Exactly one of the two letters survives the subtraction, on the left.
    expect(composite?.mark.filled).toBeGreaterThan(0);
    expect(box.maxX).toBeLessThan(64);
  });

  it('reports an empty mark when the two render identically', () => {
    // Callers must read this as "not graded", not as a failed attempt.
    stubRenderer();
    const composite = rasterizeComposite('פ', 'פ', COMPOSITE_OPTIONS);

    expect(composite?.whole.filled).toBeGreaterThan(0);
    expect(composite?.mark.filled).toBe(0);
  });

  it('returns null when no 2D context is available', () => {
    expect(rasterizeComposite('פָ', 'פ', { fontFamily: 'serif' })).toBeNull();
  });

  it('returns null when the composed form renders blank', () => {
    vi.stubGlobal('document', {
      ...document,
      createElement: () => ({
        getContext: () => ({
          clearRect: vi.fn(),
          fillText: vi.fn(),
          getImageData: () => ({ data: new Uint8ClampedArray(16 * 16 * 4) }),
        }),
      }),
    });

    expect(rasterizeComposite('פָ', 'פ', { fontFamily: 'serif', sourceSize: 16 })).toBeNull();
  });
});

describe('loadCompositeMask', () => {
  beforeEach(() => {
    clearGlyphMaskCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('awaits the webfont before rasterizing', async () => {
    // Sharper here than for a single glyph: a mark is *defined* as the
    // difference between two renderings, so a fallback face does not give a
    // worse answer, it gives an arbitrary one.
    const order: string[] = [];
    const load = vi.fn(async () => {
      order.push('font');
      return [];
    });
    vi.stubGlobal('document', {
      ...document,
      fonts: { load },
      createElement: () => {
        order.push('raster');
        return { getContext: () => null };
      },
    });

    await loadCompositeMask('פָ', 'פ', {
      fontFamily: 'serif',
      fontLoadSpec: '16px serif',
    });

    expect(order[0]).toBe('font');
    expect(order).toContain('raster');
  });

  it('keys the cache by the base as well as the composed form', async () => {
    const calls = stubRenderer();

    await loadCompositeMask('פָ', 'פ', COMPOSITE_OPTIONS);
    await loadCompositeMask('פָ', 'פ', COMPOSITE_OPTIONS);
    await loadCompositeMask('פָ', 'פָ', COMPOSITE_OPTIONS);

    // Two rasterizations per uncached call, and the third differs only by base.
    expect(calls).toHaveLength(4);
  });

  it('does not collide with the plain mask cached under the same text', async () => {
    stubRenderer();

    const plain = await loadGlyphMask('פָ', COMPOSITE_OPTIONS);
    const composite = await loadCompositeMask('פָ', 'פ', COMPOSITE_OPTIONS);

    expect(plain?.filled).toBeGreaterThan(0);
    expect(composite?.mark.filled).toBeGreaterThan(0);
  });
});
