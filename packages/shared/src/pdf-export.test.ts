import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFPage } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import {
  buildTranslationPDF,
  CONTENT_W,
  clusterShaper,
  type ExportOptions,
  LINE_BLOCK_H,
  lineBlockHeight,
  RULE_COUNT,
  simpleShaper,
  splitClusters,
  wrapWords,
} from './pdf-export';

const fontFile = (app: string, name: string) =>
  new Uint8Array(readFileSync(resolve(__dirname, `../../../apps/${app}/public/fonts/${name}`)));
const HEBREW_FONT = fontFile('hebrew-tools', 'NotoSansHebrew-Regular.ttf');
const GREEK_FONT = fontFile('greek-tools', 'NotoSans-Regular.ttf');

const BERESHIT = 'בְּרֵאשִׁ֖ית'; // pointed and accented
const BARA = 'בָּרָ֣א';
const NO_COLOR = undefined as never;

const hebrew = (over: Partial<ExportOptions> = {}): ExportOptions => ({
  verses: [{ chapter: 1, verse: 1, words: [BERESHIT, BARA] }],
  title: 'Genesis 1:1',
  fontBytes: HEBREW_FONT,
  direction: 'rtl',
  shaping: 'clustered',
  scriptTag: 'hebr',
  watermark: 'hebrew.tools',
  scriptSize: 18,
  scriptLeading: 30,
  ...over,
});

const greek = (over: Partial<ExportOptions> = {}): ExportOptions => ({
  verses: [{ chapter: 1, verse: 1, words: ['ἐν', 'ἀρχῇ'] }],
  title: 'John 1:1',
  fontBytes: GREEK_FONT,
  direction: 'ltr',
  shaping: 'simple',
  chromeFont: 'script',
  watermark: 'greek.tools',
  ...over,
});

const asText = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');
const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

// ─── wrapWords ────────────────────────────────────────────────────────────────

describe('wrapWords', () => {
  const widthOf = (t: string) => t.length * 10;

  it('keeps words that fit on one line', () => {
    expect(wrapWords(['ab', 'cd'], widthOf, 100)).toEqual([['ab', 'cd']]);
  });

  it('wraps words that exceed maxWidth onto the next line', () => {
    expect(wrapWords(['aaaa', 'bbbb', 'cccc'], widthOf, 100)).toEqual([['aaaa', 'bbbb'], ['cccc']]);
  });

  it('uses firstLineMaxWidth for the first line only', () => {
    expect(wrapWords(['aaaa', 'bbbb', 'cccc'], widthOf, 100, 50)).toEqual([
      ['aaaa'],
      ['bbbb', 'cccc'],
    ]);
  });

  it('puts a word wider than the line on a line of its own', () => {
    expect(wrapWords(['aaaaaaaaaaaaaaa', 'b'], widthOf, 50)).toEqual([['aaaaaaaaaaaaaaa'], ['b']]);
  });

  it('returns no lines for no words', () => {
    expect(wrapWords([], widthOf, 100)).toEqual([]);
  });
});

describe('layout constants', () => {
  it('derive the line block from the leading and the ruled lines', () => {
    expect(RULE_COUNT).toBe(2);
    expect(CONTENT_W).toBe(504);
    expect(LINE_BLOCK_H).toBe(lineBlockHeight());
    expect(lineBlockHeight(30)).toBe(LINE_BLOCK_H + 12);
  });
});

// ─── splitClusters ────────────────────────────────────────────────────────────

describe('splitClusters', () => {
  it('keeps a base character with every mark after it', () => {
    const clusters = splitClusters(BERESHIT);
    expect(clusters).toHaveLength(6);
    expect(clusters[0]).toBe('בְּ');
  });

  it('returns each plain character alone, and nothing for empty text', () => {
    expect(splitClusters('אב ')).toEqual(['א', 'ב', ' ']);
    expect(splitClusters('')).toEqual([]);
  });
});

// ─── Shapers ──────────────────────────────────────────────────────────────────

async function env() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(HEBREW_FONT);
  const calls: { text: string; x: number; y: number }[] = [];
  const page = {
    drawText: vi.fn((text: string, o: { x: number; y: number }) =>
      calls.push({ text, x: o.x, y: o.y }),
    ),
  } as unknown as PDFPage;
  return { font, page, calls };
}

describe('clusterShaper', () => {
  it('measures a word as the sum of its clusters, scaled by size', async () => {
    const { font } = await env();
    const s = clusterShaper(font, HEBREW_FONT, 'rtl', 'hebr');
    expect(s.width(BERESHIT, 20)).toBeCloseTo(2 * s.width(BERESHIT, 10), 6);
    expect(s.width('', 10)).toBe(0);
    expect(s.width(BERESHIT, 10)).toBeGreaterThan(s.width('בְּ', 10));
  });

  it('draws every glyph of a pointed word, marks included', async () => {
    const { font, page, calls } = await env();
    clusterShaper(font, HEBREW_FONT, 'rtl', 'hebr').draw(page, BERESHIT, 500, 100, 20, NO_COLOR);
    // More glyphs than letters: the points and the accent are glyphs too.
    expect(calls.length).toBeGreaterThan(splitClusters(BERESHIT).length);
  });

  it('lays RTL clusters out leftward from the right edge', async () => {
    const { font, page, calls } = await env();
    const s = clusterShaper(font, HEBREW_FONT, 'rtl', 'hebr');
    s.draw(page, 'אב', 500, 100, 20, NO_COLOR);
    expect(calls.map((c) => c.text)).toEqual(['א', 'ב']);
    expect(calls[0].x).toBeLessThan(500);
    expect(calls[1].x).toBeLessThan(calls[0].x);
    expect(500 - calls[1].x).toBeCloseTo(s.width('אב', 20), 6);
  });

  it('lays LTR clusters out rightward from the left edge', async () => {
    const { font, page, calls } = await env();
    clusterShaper(font, HEBREW_FONT, 'ltr', 'hebr').draw(page, 'אב', 50, 100, 20, NO_COLOR);
    expect(calls[0].x).toBe(50);
    expect(calls[1].x).toBeGreaterThan(50);
  });

  it('places a vowel point inside the letter it belongs to', async () => {
    const { font, page, calls } = await env();
    const s = clusterShaper(font, HEBREW_FONT, 'rtl', 'hebr');
    // A patah is a zero-width glyph. Drawn without its GPOS offset it would
    // sit at the letter's origin, on its left edge.
    s.draw(page, 'פַ', 500, 100, 100, NO_COLOR);
    const left = 500 - s.width('פַ', 100);
    const mark = calls.find((c) => c.text === 'ַ');
    expect(mark).toBeDefined();
    expect(mark?.x).toBeGreaterThan(left);
    expect(mark?.x).toBeLessThan(500);
  });

  it('reuses a cluster it has already shaped', async () => {
    const { font, page } = await env();
    const s = clusterShaper(font, HEBREW_FONT, 'rtl', 'hebr');
    expect(s.width('בְּבְּ', 10)).toBeCloseTo(2 * s.width('בְּ', 10), 9);
    expect(() => s.draw(page, 'בְּבְּ', 100, 100, 10, NO_COLOR)).not.toThrow();
  });
});

describe('simpleShaper', () => {
  it('draws LTR text from its left edge and RTL text to its right edge', async () => {
    const { font, page, calls } = await env();
    const w = simpleShaper(font, 'ltr').width('אב', 10);
    expect(w).toBeGreaterThan(0);
    simpleShaper(font, 'ltr').draw(page, 'אב', 100, 0, 10, NO_COLOR);
    simpleShaper(font, 'rtl').draw(page, 'אב', 100, 0, 10, NO_COLOR);
    expect(calls[0].x).toBe(100);
    expect(calls[1].x).toBeCloseTo(100 - w, 6);
  });
});

// ─── buildTranslationPDF ─────────────────────────────────────────────────────

describe('buildTranslationPDF', () => {
  it('returns a PDF', async () => {
    const bytes = await buildTranslationPDF(hebrew());
    expect(asText(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('embeds the Hebrew face, with Latin chrome in a face of its own', async () => {
    const text = asText(await buildTranslationPDF(hebrew()));
    expect(text).toMatch(/\/BaseFont\s*\/\w*NotoSansHebrew/);
    // Noto Sans Hebrew has no Latin letters, so the title and numbers cannot
    // use it.
    expect(text).toMatch(/\/BaseFont\s*\/Helvetica/);
  });

  it('embeds the script font once when it also sets the chrome', async () => {
    const text = asText(await buildTranslationPDF(greek()));
    expect(text).toMatch(/\/BaseFont\s*\/\w*NotoSans/);
    expect(text).not.toMatch(/\/BaseFont\s*\/Helvetica/);
  });

  it('refuses a font that lacks the script, instead of printing blank boxes', async () => {
    await expect(
      buildTranslationPDF(hebrew({ fontBytes: GREEK_FONT, requiredCodePoint: 0x05d0 })),
    ).rejects.toThrow(/no glyphs/);
  });

  it('accepts a font that has the script', async () => {
    await expect(
      buildTranslationPDF(hebrew({ requiredCodePoint: 0x05d0 })),
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it('accepts the font as an ArrayBuffer', async () => {
    const buffer = HEBREW_FONT.buffer.slice(
      HEBREW_FONT.byteOffset,
      HEBREW_FONT.byteOffset + HEBREW_FONT.byteLength,
    ) as ArrayBuffer;
    await expect(buildTranslationPDF(hebrew({ fontBytes: buffer }))).resolves.toBeInstanceOf(
      Uint8Array,
    );
  });

  it('starts a new page when the passage overflows one', async () => {
    const verses = Array.from({ length: 40 }, (_, i) => ({
      chapter: 1,
      verse: i + 1,
      words: [BERESHIT, BARA, BERESHIT, BARA, BERESHIT, BARA],
    }));
    expect(await pageCount(await buildTranslationPDF(hebrew({ verses })))).toBeGreaterThan(1);
  });

  it('wraps a long verse onto several lines', async () => {
    const words = Array.from({ length: 40 }, () => BERESHIT);
    const long = await buildTranslationPDF(hebrew({ verses: [{ chapter: 1, verse: 1, words }] }));
    const short = await buildTranslationPDF(hebrew());
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('prints an empty verse, an empty passage and a chapter change', async () => {
    await expect(
      buildTranslationPDF(hebrew({ verses: [{ chapter: 1, verse: 1, words: [] }] })),
    ).resolves.toBeInstanceOf(Uint8Array);
    await expect(buildTranslationPDF(hebrew({ verses: [] }))).resolves.toBeInstanceOf(Uint8Array);
    const two = hebrew({
      verses: [
        { chapter: 1, verse: 1, words: [BARA] },
        { chapter: 2, verse: 1, words: [BARA] },
      ],
    });
    await expect(buildTranslationPDF(two)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('builds an LTR Greek passage the same way', async () => {
    const bytes = await buildTranslationPDF(
      greek({
        verses: Array.from({ length: 50 }, (_, i) => ({
          chapter: 1,
          verse: i + 1,
          words: ['ἐν', 'ἀρχῇ', 'ἦν', 'ὁ', 'λόγος'],
        })),
      }),
    );
    expect(await pageCount(bytes)).toBeGreaterThan(1);
  });
});
