import { buildTranslationPDF as buildPDF } from '@tools/shared/pdf-export';
import type { CrossChapterRange } from '../components/CrossChapterSelector';
import type { MorphBook, MorphWord } from '../data/morphgnt';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerseForExport {
  chapter: number;
  verse: number;
  words: MorphWord[];
}

// The layout, wrapping and page logic are shared with hebrew.tools; see
// `@tools/shared/pdf-export`. This file keeps what is Greek: where the verses
// come from, and which font prints them.

// ─── Data extraction ──────────────────────────────────────────────────────────

export function extractVerses(bookData: MorphBook, range: CrossChapterRange): VerseForExport[] {
  const result: VerseForExport[] = [];

  for (let ch = range.startChapter; ch <= range.endChapter; ch++) {
    const chapter = bookData[String(ch)];
    if (!chapter) continue;

    const verseNums = Object.keys(chapter)
      .map(Number)
      .sort((a, b) => a - b);

    for (const v of verseNums) {
      if (ch === range.startChapter && v < range.startVerse) continue;
      if (ch === range.endChapter && v > range.endVerse) continue;
      result.push({ chapter: ch, verse: v, words: chapter[String(v)] ?? [] });
    }
  }

  return result;
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

export async function buildTranslationPDF(
  verses: VerseForExport[],
  passageRef: string,
): Promise<Uint8Array> {
  const fontBytes = await fetch('/fonts/NotoSans-Regular.ttf').then((r) => r.arrayBuffer());
  return buildPDF({
    verses: verses.map(({ chapter, verse, words }) => ({
      chapter,
      verse,
      words: words.map((w) => w.text),
    })),
    title: passageRef,
    fontBytes,
    direction: 'ltr',
    shaping: 'simple',
    chromeFont: 'script',
    watermark: 'greek.tools',
  });
}
