#!/usr/bin/env node
/**
 * Build script: fetches MorphGNT source files from GitHub and outputs
 * per-book JSON files to public/data/morphgnt/.
 *
 * Each book file (e.g. JHN.json) is structured as:
 *   { [chapter: string]: { [verse: string]: MorphWord[] } }
 *
 * MorphWord: { text, lemma, pos, parsing }
 *
 * Run: node scripts/build-morphgnt.mjs
 * Force re-fetch: node scripts/build-morphgnt.mjs --force
 */

import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'morphgnt');
const BASE_URL = 'https://raw.githubusercontent.com/morphgnt/sblgnt/master';
const FORCE = process.argv.includes('--force');

// MorphGNT book numbering: 61 = Matthew, 87 = Revelation
const BOOKS = [
  { num: 61, file: '61-Mt-morphgnt.txt', code: 'MAT', name: 'Matthew' },
  { num: 62, file: '62-Mk-morphgnt.txt', code: 'MRK', name: 'Mark' },
  { num: 63, file: '63-Lk-morphgnt.txt', code: 'LUK', name: 'Luke' },
  { num: 64, file: '64-Jn-morphgnt.txt', code: 'JHN', name: 'John' },
  { num: 65, file: '65-Ac-morphgnt.txt', code: 'ACT', name: 'Acts' },
  { num: 66, file: '66-Ro-morphgnt.txt', code: 'ROM', name: 'Romans' },
  { num: 67, file: '67-1Co-morphgnt.txt', code: '1CO', name: '1 Corinthians' },
  { num: 68, file: '68-2Co-morphgnt.txt', code: '2CO', name: '2 Corinthians' },
  { num: 69, file: '69-Ga-morphgnt.txt', code: 'GAL', name: 'Galatians' },
  { num: 70, file: '70-Eph-morphgnt.txt', code: 'EPH', name: 'Ephesians' },
  { num: 71, file: '71-Php-morphgnt.txt', code: 'PHP', name: 'Philippians' },
  { num: 72, file: '72-Col-morphgnt.txt', code: 'COL', name: 'Colossians' },
  { num: 73, file: '73-1Th-morphgnt.txt', code: '1TH', name: '1 Thessalonians' },
  { num: 74, file: '74-2Th-morphgnt.txt', code: '2TH', name: '2 Thessalonians' },
  { num: 75, file: '75-1Ti-morphgnt.txt', code: '1TI', name: '1 Timothy' },
  { num: 76, file: '76-2Ti-morphgnt.txt', code: '2TI', name: '2 Timothy' },
  { num: 77, file: '77-Tit-morphgnt.txt', code: 'TIT', name: 'Titus' },
  { num: 78, file: '78-Phm-morphgnt.txt', code: 'PHM', name: 'Philemon' },
  { num: 79, file: '79-Heb-morphgnt.txt', code: 'HEB', name: 'Hebrews' },
  { num: 80, file: '80-Jas-morphgnt.txt', code: 'JAS', name: 'James' },
  { num: 81, file: '81-1Pe-morphgnt.txt', code: '1PE', name: '1 Peter' },
  { num: 82, file: '82-2Pe-morphgnt.txt', code: '2PE', name: '2 Peter' },
  { num: 83, file: '83-1Jn-morphgnt.txt', code: '1JN', name: '1 John' },
  { num: 84, file: '84-2Jn-morphgnt.txt', code: '2JN', name: '2 John' },
  { num: 85, file: '85-3Jn-morphgnt.txt', code: '3JN', name: '3 John' },
  { num: 86, file: '86-Jud-morphgnt.txt', code: 'JUD', name: 'Jude' },
  { num: 87, file: '87-Re-morphgnt.txt', code: 'REV', name: 'Revelation' },
];

/**
 * Parse MorphGNT text format into a chapter→verse→words structure.
 *
 * Each line: BBCCVV POS PARSING TEXT WORD NORMALIZED LEMMA
 *   BBCCVV = 6-digit compact reference (2-digit book, 2-digit chapter, 2-digit verse)
 *   e.g. "040101" = John (book 4) chapter 1 verse 1
 *
 * We store only: text, lemma, pos, parsing (omitting word + normalized to reduce size).
 */
function parseMorphGNT(raw) {
  /** @type {Record<string, Record<string, Array<{text:string,lemma:string,pos:string,parsing:string}>>>} */
  const chapters = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(' ');
    // Expect exactly 7 fields; skip malformed lines
    if (parts.length < 7) continue;

    const [ref, pos, parsing, text, , , lemma] = parts;
    // Reference is BBCCVV — extract chapter (digits 2-3) and verse (digits 4-5)
    if (ref.length < 6) continue;
    const ch = String(parseInt(ref.slice(2, 4), 10));
    const v = String(parseInt(ref.slice(4, 6), 10));

    if (!chapters[ch]) chapters[ch] = {};
    if (!chapters[ch][v]) chapters[ch][v] = [];

    chapters[ch][v].push({ text, lemma, pos, parsing });
  }

  return chapters;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function processBook(book) {
  const outPath = join(OUT_DIR, `${book.code}.json`);

  if (!FORCE && (await fileExists(outPath))) {
    // Still need to return chapter count
    const existing = JSON.parse(
      await (await import('node:fs/promises')).readFile(outPath, 'utf-8'),
    );
    return { code: book.code, name: book.name, chapters: Object.keys(existing).length };
  }

  const url = `${BASE_URL}/${book.file}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} fetching ${url}\n  Check that the file exists at this path in the morphgnt/sblgnt repository.`,
    );
  }

  const raw = await res.text();
  const chapters = parseMorphGNT(raw);
  const chapterCount = Object.keys(chapters).length;

  if (chapterCount === 0) {
    throw new Error(`Parsed 0 chapters from ${book.file} — check the file format`);
  }

  await writeFile(outPath, JSON.stringify(chapters), 'utf-8');

  return { code: book.code, name: book.name, chapters: chapterCount };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const bookIndex = [];
  let errors = 0;

  for (const book of BOOKS) {
    try {
      const info = await processBook(book);
      bookIndex.push(info);
    } catch (_err) {
      errors++;
    }
  }

  if (bookIndex.length > 0) {
    await writeFile(join(OUT_DIR, 'books.json'), JSON.stringify(bookIndex, null, 2), 'utf-8');
  }

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((_err) => {
  process.exit(1);
});
