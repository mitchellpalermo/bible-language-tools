import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MorphWord } from '../data/morphgnt';
import {
  CONTENT_W,
  LINE_BLOCK_H,
  RULE_COUNT,
  buildTranslationPDF,
  extractVerses,
  wrapWords,
} from './pdf-export';

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

// ─── wrapWords ────────────────────────────────────────────────────────────────

describe('wrapWords', () => {
  // Fake width function: each character is 8pt, plus 4pt space
  const widthOf = (text: string) => text.length * 8;

  it('returns a single line when all words fit', () => {
    const lines = wrapWords(['ab', 'cd'], widthOf, 100);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual(['ab', 'cd']);
  });

  it('wraps words that exceed maxWidth onto the next line', () => {
    // widthOf('word ') = word.length * 8; each 4-char word = 40pt
    // maxWidth=75: 'aaaa'(40) fits; adding 'bbbb'(40) = 80 > 75 → new line; etc.
    const lines = wrapWords(['aaaa', 'bbbb', 'cccc'], widthOf, 75);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual(['aaaa']);
    expect(lines[1]).toEqual(['bbbb']);
    expect(lines[2]).toEqual(['cccc']);
  });

  it('packs multiple words on a line when they fit within maxWidth', () => {
    // widthOf('ab ')=24, widthOf('cd ')=24; 24+24=48 <= 100
    const lines = wrapWords(['ab', 'cd', 'ef'], widthOf, 100);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual(['ab', 'cd', 'ef']);
  });

  it('handles a firstLineMaxWidth shorter than maxWidth', () => {
    // First line max = 30, subsequent = 80
    // 'aaaa '=40 > 30, so... wait, first word always fits (no prior words)
    // word='aaaa': current=[], 0+40<=30? No, but current is empty so it just goes in.
    // word='bbbb': current=['aaaa'] width=40, 40+40=80>30 → new line. line0=['aaaa']
    // word='cccc': current=['bbbb'] width=40, 40+40=80>80 → fits exactly. current=['bbbb','cccc']
    // end: push ['bbbb','cccc']. lines=[['aaaa'],['bbbb','cccc']]
    const lines = wrapWords(['aaaa', 'bbbb', 'cccc'], widthOf, 80, 30);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual(['aaaa']);
    expect(lines[1]).toEqual(['bbbb', 'cccc']);
  });

  it('returns an empty array for empty input', () => {
    expect(wrapWords([], widthOf, 100)).toEqual([]);
  });

  it('always places at least one word on the first line even if it exceeds maxWidth', () => {
    // Single very long word that exceeds maxWidth
    const lines = wrapWords(['averylongword'], widthOf, 10);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual(['averylongword']);
  });

  it('does not apply firstLineMaxWidth to subsequent lines', () => {
    // firstLine=20 forces each word onto its own line if words are wider
    // subsequent lines use maxWidth=200 which fits multiple words
    const lines = wrapWords(['ab', 'cd', 'ef', 'gh'], widthOf, 200, 20);
    // line0=['ab'] (24 > 20 would overflow next word; but 'ab '=24 and 24>20 so after ab any next word forces break)
    // Actually: 'ab '=24. First word: current=[], 0+24<=20? No wait: current is empty → just add.
    // current=['ab'], width=24. Next 'cd ': 24+24=48 > 20 → new line. line0=['ab']
    // Now firstLine=false. current=['cd'], width=24. 'ef ': 24+24=48 <= 200 → add. current=['cd','ef']
    // 'gh ': 48+24=72 <= 200 → add. current=['cd','ef','gh']. lines=[['ab'],['cd','ef','gh']]
    expect(lines[0]).toEqual(['ab']);
    expect(lines[1]).toEqual(['cd', 'ef', 'gh']);
  });
});

// ─── buildTranslationPDF ─────────────────────────────────────────────────────

describe('buildTranslationPDF', () => {
  beforeEach(() => {
    const fontBytes = readFileSync(
      resolve(__dirname, '../../public/fonts/NotoSans-Regular.ttf'),
    );
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

// ─── Constant sanity checks ───────────────────────────────────────────────────

describe('layout constants', () => {
  it('LINE_BLOCK_H is a positive integer', () => {
    expect(LINE_BLOCK_H).toBeGreaterThan(0);
    expect(Number.isInteger(LINE_BLOCK_H)).toBe(true);
  });

  it('CONTENT_W fits within a Letter page with margins', () => {
    // Letter = 612pt, left + right margins = 108pt, content = 504pt
    expect(CONTENT_W).toBe(504);
  });

  it('RULE_COUNT is 2', () => {
    expect(RULE_COUNT).toBe(2);
  });
});
