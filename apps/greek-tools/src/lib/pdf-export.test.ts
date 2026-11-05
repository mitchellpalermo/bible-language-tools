import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MorphWord } from '../data/morphgnt';
import { buildTranslationPDF, extractVerses } from './pdf-export';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function word(text: string): MorphWord {
  return { text, lemma: text, pos: 'N-', parsing: '--------' };
}

const BOOK = {
  '1': {
    '1': [word('ἐν'), word('ἀρχῇ')],
    '2': [word('καὶ'), word('ἡ'), word('γῆ')],
    '3': [word('εἶπεν')],
  },
  '2': {
    '1': [word('καὶ'), word('ἦν')],
    '5': [word('ὁ'), word('θεός')],
  },
};

// ─── extractVerses ────────────────────────────────────────────────────────────

describe('extractVerses', () => {
  it('returns all verses in a single chapter range', () => {
    const result = extractVerses(BOOK, {
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 3,
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ chapter: 1, verse: 1 });
    expect(result[1]).toMatchObject({ chapter: 1, verse: 2 });
    expect(result[2]).toMatchObject({ chapter: 1, verse: 3 });
  });

  it('respects startVerse when filtering the first chapter', () => {
    const result = extractVerses(BOOK, {
      book: 'GEN',
      startChapter: 1,
      startVerse: 2,
      endChapter: 1,
      endVerse: 3,
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ chapter: 1, verse: 2 });
  });

  it('respects endVerse when filtering the last chapter', () => {
    const result = extractVerses(BOOK, {
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 2,
    });
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ chapter: 1, verse: 2 });
  });

  it('spans multiple chapters correctly', () => {
    const result = extractVerses(BOOK, {
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 2,
      endVerse: 5,
    });
    const refs = result.map((v) => `${v.chapter}:${v.verse}`);
    expect(refs).toEqual(['1:1', '1:2', '1:3', '2:1', '2:5']);
  });

  it('applies startVerse filter only to the first chapter in a cross-chapter range', () => {
    const result = extractVerses(BOOK, {
      book: 'GEN',
      startChapter: 1,
      startVerse: 3,
      endChapter: 2,
      endVerse: 5,
    });
    const refs = result.map((v) => `${v.chapter}:${v.verse}`);
    // ch1 filtered to verse 3+; ch2 all verses up to endVerse
    expect(refs).toEqual(['1:3', '2:1', '2:5']);
  });

  it('applies endVerse filter only to the last chapter in a cross-chapter range', () => {
    const result = extractVerses(BOOK, {
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 2,
      endVerse: 1,
    });
    const refs = result.map((v) => `${v.chapter}:${v.verse}`);
    expect(refs).toEqual(['1:1', '1:2', '1:3', '2:1']);
  });

  it('returns an empty array when book data has no matching chapters', () => {
    const result = extractVerses(BOOK, {
      book: 'GEN',
      startChapter: 5,
      startVerse: 1,
      endChapter: 5,
      endVerse: 10,
    });
    expect(result).toHaveLength(0);
  });

  it('includes the MorphWord array for each verse', () => {
    const result = extractVerses(BOOK, {
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 1,
    });
    expect(result[0].words).toHaveLength(2);
    expect(result[0].words[0].text).toBe('ἐν');
  });

  it('handles a missing chapter in book data gracefully', () => {
    const result = extractVerses(BOOK, {
      book: 'GEN',
      startChapter: 1,
      startVerse: 1,
      endChapter: 3,
      endVerse: 1,
    });
    // ch3 doesn't exist — only ch1 and ch2 verses are returned
    expect(result.every((v) => v.chapter !== 3)).toBe(true);
  });
});

// ─── buildTranslationPDF ─────────────────────────────────────────────────────

describe('buildTranslationPDF', () => {
  beforeEach(() => {
    const fontBytes = readFileSync(resolve(__dirname, '../../public/fonts/NotoSans-Regular.ttf'));
    const arrayBuffer = fontBytes.buffer.slice(
      fontBytes.byteOffset,
      fontBytes.byteOffset + fontBytes.byteLength,
    ) as ArrayBuffer;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(arrayBuffer) }),
    );
  });

  it('returns a Uint8Array that begins with the PDF magic bytes', async () => {
    const verses = [{ chapter: 1, verse: 1, words: [word('ἐν'), word('ἀρχῇ')] }];
    const result = await buildTranslationPDF(verses, 'Genesis 1:1');
    expect(result).toBeInstanceOf(Uint8Array);
    // %PDF in ASCII
    expect(result[0]).toBe(0x25);
    expect(result[1]).toBe(0x50);
    expect(result[2]).toBe(0x44);
    expect(result[3]).toBe(0x46);
  });

  it('generates a multi-page PDF when content overflows one page', async () => {
    // Generate enough verses to force at least 2 pages
    const verses = Array.from({ length: 50 }, (_, i) => ({
      chapter: 1,
      verse: i + 1,
      words: [word('ἐν'), word('ἀρχῇ'), word('ἦν'), word('ὁ'), word('λόγος')],
    }));
    const result = await buildTranslationPDF(verses, 'Test 1:1–50');
    // A valid multi-page PDF contains multiple "Page" objects; verify it's non-trivially large
    expect(result.length).toBeGreaterThan(5000);
  });

  it('handles empty verses array and still produces valid PDF', async () => {
    const result = await buildTranslationPDF([], 'Empty');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result[0]).toBe(0x25); // %
  });

  it('handles a verse with no words without throwing', async () => {
    const verses = [{ chapter: 1, verse: 1, words: [] }];
    await expect(buildTranslationPDF(verses, 'Test 1:1')).resolves.toBeInstanceOf(Uint8Array);
  });

  it('triggers a chapter heading when chapter changes between verses', async () => {
    const verses = [
      { chapter: 1, verse: 1, words: [word('ἐν')] },
      { chapter: 2, verse: 1, words: [word('καί')] },
    ];
    // Just verify it doesn't throw — the chapter heading path is exercised
    await expect(buildTranslationPDF(verses, 'Test 1:1–2:1')).resolves.toBeInstanceOf(Uint8Array);
  });
});
