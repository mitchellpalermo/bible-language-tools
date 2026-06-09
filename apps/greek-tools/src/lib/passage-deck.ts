import type { MorphBook } from '../data/morphgnt';
import { normalizeKey } from '../data/srs';
import type { VocabWord } from '../data/vocabulary';

export const GNT_BOOKS: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'MAT', name: 'Matthew' },
  { code: 'MRK', name: 'Mark' },
  { code: 'LUK', name: 'Luke' },
  { code: 'JHN', name: 'John' },
  { code: 'ACT', name: 'Acts' },
  { code: 'ROM', name: 'Romans' },
  { code: '1CO', name: '1 Corinthians' },
  { code: '2CO', name: '2 Corinthians' },
  { code: 'GAL', name: 'Galatians' },
  { code: 'EPH', name: 'Ephesians' },
  { code: 'PHP', name: 'Philippians' },
  { code: 'COL', name: 'Colossians' },
  { code: '1TH', name: '1 Thessalonians' },
  { code: '2TH', name: '2 Thessalonians' },
  { code: '1TI', name: '1 Timothy' },
  { code: '2TI', name: '2 Timothy' },
  { code: 'TIT', name: 'Titus' },
  { code: 'PHM', name: 'Philemon' },
  { code: 'HEB', name: 'Hebrews' },
  { code: 'JAS', name: 'James' },
  { code: '1PE', name: '1 Peter' },
  { code: '2PE', name: '2 Peter' },
  { code: '1JN', name: '1 John' },
  { code: '2JN', name: '2 John' },
  { code: '3JN', name: '3 John' },
  { code: 'JUD', name: 'Jude' },
  { code: 'REV', name: 'Revelation' },
];

export function buildVocabMap(vocab: VocabWord[]): Map<string, VocabWord> {
  const map = new Map<string, VocabWord>();
  for (const word of vocab) {
    map.set(normalizeKey(word.greek), word);
  }
  return map;
}

export function isValidRef(book: MorphBook, chapter: number, verse: number): boolean {
  const chStr = String(chapter);
  if (!(chStr in book)) return false;
  return String(verse) in book[chStr];
}

export function extractPassageLemmas(
  book: MorphBook,
  startCh: number,
  startVs: number,
  endCh: number,
  endVs: number,
  vocabMap: Map<string, VocabWord>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const chapters = Object.keys(book)
    .map(Number)
    .sort((a, b) => a - b);

  for (const ch of chapters) {
    if (ch < startCh || ch > endCh) continue;
    const verseMap = book[String(ch)];
    const verses = Object.keys(verseMap)
      .map(Number)
      .sort((a, b) => a - b);

    for (const vs of verses) {
      if (ch === startCh && vs < startVs) continue;
      if (ch === endCh && vs > endVs) continue;

      for (const word of verseMap[String(vs)]) {
        const key = normalizeKey(word.lemma);
        if (!seen.has(key) && vocabMap.has(key)) {
          seen.add(key);
          result.push(key);
        }
      }
    }
  }

  return result;
}

export function formatPassageRef(
  bookName: string,
  startCh: number,
  startVs: number,
  endCh: number,
  endVs: number,
): string {
  if (startCh === endCh && startVs === endVs) {
    return `${bookName} ${startCh}:${startVs}`;
  }
  if (startCh === endCh) {
    return `${bookName} ${startCh}:${startVs}–${endVs}`;
  }
  return `${bookName} ${startCh}:${startVs}–${endCh}:${endVs}`;
}
