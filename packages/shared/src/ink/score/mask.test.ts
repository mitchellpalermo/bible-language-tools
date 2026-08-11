import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearGlyphMaskCache,
  DEFAULT_MASK_PADDING,
  DEFAULT_MASK_SIZE,
  distanceTransform,
  type GlyphMask,
  loadGlyphMask,
  maskFromAlpha,
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
    expect(d.every(v => Number.isFinite(v) && v > 4)).toBe(true);
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
    const mask = maskFromAlpha(alphaGrid(32, 32, () => true), 32, 32, { size: 40, padding: 0.25 });
    const box = bitsBox(mask);

    expect(box?.minX).toBeGreaterThanOrEqual(9);
    expect(box?.maxX).toBeLessThanOrEqual(30);
  });

  it('returns an empty mask for blank input', () => {
    const mask = maskFromAlpha(new Uint8Array(64), 8, 8, { size: 16 });

    expect(mask.filled).toBe(0);
    expect(mask.bits.every(b => b === 0)).toBe(true);
    expect(mask.distance).toHaveLength(256);
  });

  it('treats alpha below the threshold as uncovered', () => {
    const faint = new Uint8Array(64).fill(100);
    expect(maskFromAlpha(faint, 8, 8, { size: 16, threshold: 128 }).filled).toBe(0);
    expect(maskFromAlpha(faint, 8, 8, { size: 16, threshold: 64 }).filled).toBeGreaterThan(0);
  });

  it('defaults to the documented geometry', () => {
    const mask = maskFromAlpha(alphaGrid(8, 8, () => true), 8, 8);
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

    const mask = rasterizeGlyph('א', { fontFamily: 'serif', sourceSize: source, size: 10, padding: 0 });

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
    vi.stubGlobal('document', { ...document, fonts: { load }, createElement: () => ({ getContext: () => null }) });

    await expect(loadGlyphMask('א', { fontFamily: 'serif', fontLoadSpec: '16px serif' })).resolves.toBeNull();
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
