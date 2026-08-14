#!/usr/bin/env node
/**
 * Resolve every entry of `src/data/dailyVerses.ts` against the built corpus.
 *
 * The list is hand-curated, and the failure it exists to catch is silent: a
 * reference typed off an English Bible page still *resolves* in the Westminster
 * Leningrad Codex, and shows a student a different verse. Isaiah 9:6, Jonah
 * 1:17, Joel 2:28, Malachi 4:2 and half a dozen psalms all number differently
 * in Hebrew, and nothing at runtime can tell that the wrong one was fetched.
 *
 * Not part of `pnpm build` and not part of the test suite, for the same reason
 * `build:vocab:check` is neither: it needs `public/data/morphhb/`, which is 24 MB
 * regenerated from upstream and deliberately not committed. Run it after editing
 * the list:
 *
 *     pnpm build:data      # once, if the corpus is not there
 *     pnpm check:verses    # exits non-zero and names every bad entry
 *     pnpm check:verses --show   # ...and prints each verse to read back
 *
 * Usage: node scripts/check-daily-verses.mjs [--show]
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS } from './lib/books.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'public', 'data', 'morphhb');
const SOURCE = join(ROOT, 'src', 'data', 'dailyVerses.ts');

/** `Psalm 23:1` reads better than `Psalms 23:1`; every other name is the index's. */
const DISPLAY_NAMES = new Map(BOOKS.map((b) => [b.code, b.name]));
DISPLAY_NAMES.set('PSA', 'Psalm');

/** Verses much longer than this stop being a daily verse and become a session. */
const LONG_VERSE_WORDS = 22;

// ─── Reading the list ─────────────────────────────────────────────────────────

/**
 * Pull the entries out of the TypeScript source.
 *
 * Node cannot import a `.ts` module, and the alternatives (a build step, a
 * loader, type-stripping flags that differ across Node versions) all cost more
 * than a regex over a file that is machine-uniform by construction. The count
 * cross-check below is what keeps the regex honest: if the file's formatting
 * ever drifts out of this shape, the script fails loudly rather than quietly
 * validating a subset.
 */
function readEntries() {
  const src = readFileSync(SOURCE, 'utf8');
  const body = src.slice(src.indexOf('DAILY_VERSES'), src.indexOf('] as const;'));

  const pattern =
    /\{\s*book:\s*'([^']+)',\s*chapter:\s*(\d+),\s*verse:\s*(\d+),\s*displayRef:\s*'([^']+)'(?:,\s*english:\s*'([^']+)')?\s*\}/g;

  const entries = [...body.matchAll(pattern)].map((m) => ({
    book: m[1],
    chapter: Number(m[2]),
    verse: Number(m[3]),
    displayRef: m[4],
    english: m[5],
  }));

  const declared = (body.match(/\{\s*book:/g) ?? []).length;
  if (declared !== entries.length) {
    throw new Error(
      `parsed ${entries.length} of ${declared} entries — the literal's shape changed, ` +
        'so this script is no longer reading all of it. Fix the pattern, not the data.',
    );
  }
  return entries;
}

// ─── The corpus ───────────────────────────────────────────────────────────────

const books = new Map();

function loadBook(code) {
  if (!books.has(code)) {
    try {
      books.set(code, JSON.parse(readFileSync(join(DATA_DIR, `${code}.json`), 'utf8')));
    } catch {
      books.set(code, null);
    }
  }
  return books.get(code);
}

const wordText = (w) => (w.qere ?? w.text).replace(/\//g, '');

// ─── Checks ───────────────────────────────────────────────────────────────────

function check(entry, seen) {
  const { book, chapter, verse, displayRef, english } = entry;
  const problems = [];

  const name = DISPLAY_NAMES.get(book);
  if (!name) problems.push(`unknown book code '${book}'`);

  const key = `${book}.${chapter}.${verse}`;
  if (seen.has(key)) problems.push('duplicate reference');
  seen.add(key);

  // The reference a reader sees must name the verse actually fetched — a
  // mismatch here is the typo this whole script is about.
  if (name && displayRef !== `${name} ${chapter}:${verse}`) {
    problems.push(`displayRef '${displayRef}' should read '${name} ${chapter}:${verse}'`);
  }

  // `english` means "the English Bible disagrees". Equal to `displayRef`, it
  // says the opposite of what its presence claims.
  if (english !== undefined && english === displayRef) {
    problems.push(`english '${english}' duplicates displayRef — omit it when the two agree`);
  }

  const data = loadBook(book);
  if (!data) return { problems: [...problems, 'no corpus file — run `pnpm build:data`'] };

  const ch = data[String(chapter)];
  if (!ch) {
    return {
      problems: [...problems, `no chapter ${chapter} (${book} has 1–${Object.keys(data).length})`],
    };
  }

  const words = ch[String(verse)];
  if (!words) {
    return {
      problems: [
        ...problems,
        `no verse ${verse} (${book} ${chapter} has 1–${Object.keys(ch).length})`,
      ],
    };
  }

  return { problems, words };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const show = process.argv.includes('--show');
const entries = readEntries();
const seen = new Set();
const failures = [];
const long = [];
const sections = new Map();

for (const entry of entries) {
  const { problems, words } = check(entry, seen);

  if (problems.length > 0) {
    failures.push(`  ${entry.displayRef} (${entry.book}.${entry.chapter}.${entry.verse})`);
    for (const p of problems) failures.push(`      ${p}`);
    continue;
  }

  const section = BOOKS.find((b) => b.code === entry.book)?.section ?? '?';
  sections.set(section, (sections.get(section) ?? 0) + 1);

  if (words.length > LONG_VERSE_WORDS) long.push(`${entry.displayRef} (${words.length} words)`);

  if (show) {
    const text = words.map((w) => wordText(w) + (w.after ?? '')).join(' ');
    const also = entry.english ? `  [English ${entry.english}]` : '';
    console.log(`${entry.displayRef.padEnd(22)} ${String(words.length).padStart(2)}w  ${text}${also}`);
  }
}

console.log(`\n${entries.length} verses checked.`);
for (const section of ['torah', 'neviim', 'ketuvim']) {
  console.log(`  ${section.padEnd(8)} ${sections.get(section) ?? 0}`);
}
const diverging = entries.filter((e) => e.english).length;
console.log(`  ${diverging} numbered differently in English Bibles.`);

if (long.length > 0) {
  console.log(`\nLonger than ${LONG_VERSE_WORDS} words (not an error, but read them again):`);
  for (const l of long) console.log(`  ${l}`);
}

if (failures.length > 0) {
  console.error('\nFAILED — these entries do not resolve against the corpus:');
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log('\nAll references resolve against the Westminster Leningrad Codex.');
