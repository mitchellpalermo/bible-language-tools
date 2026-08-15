#!/usr/bin/env node
/**
 * Resolve every entry of `src/data/dailyVerses.ts` against the built corpus,
 * and print the list back so it can be read.
 *
 * The checks live in `lib/daily-verses.mjs` and are shared with
 * `src/data/dailyVerses.corpus.test.ts`, which runs the same validation inside
 * `pnpm test` whenever the corpus happens to be built. This file is I/O and
 * output: read the source, read the books, print. Same split as `oshb.mjs`
 * against `build-morphhb.mjs`.
 *
 * The test is the gate; this is the tool. It exists for `--show`, which prints
 * each verse beside its reference — the only practical way to proofread a
 * hand-curated list of 85 references.
 *
 *     pnpm build:data            # once, if the corpus is not there
 *     pnpm check:verses
 *     pnpm check:verses --show
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS } from './lib/books.mjs';
import {
  checkEntries,
  DISPLAY_NAMES,
  failureLines,
  LONG_VERSE_WORDS,
  longVerses,
  parseEntries,
  verseText,
} from './lib/daily-verses.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'public', 'data', 'morphhb');
const SOURCE = join(ROOT, 'src', 'data', 'dailyVerses.ts');

const SECTION_OF = new Map(BOOKS.map((b) => [b.code, b.section]));

// ─── The corpus ───────────────────────────────────────────────────────────────

const books = new Map();

function lookup(code) {
  if (!books.has(code)) {
    try {
      books.set(code, JSON.parse(readFileSync(join(DATA_DIR, `${code}.json`), 'utf8')));
    } catch {
      books.set(code, null);
    }
  }
  return books.get(code);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const show = process.argv.includes('--show');
const entries = parseEntries(readFileSync(SOURCE, 'utf8'));
const results = checkEntries(entries, { lookup, displayNames: DISPLAY_NAMES });

const sections = new Map();
for (const { entry, problems, words } of results) {
  if (problems.length > 0 || !words) continue;

  const section = SECTION_OF.get(entry.book) ?? '?';
  sections.set(section, (sections.get(section) ?? 0) + 1);

  if (show) {
    const also = entry.english ? `  [English ${entry.english}]` : '';
    const count = String(words.length).padStart(2);
    console.log(`${entry.displayRef.padEnd(22)} ${count}w  ${verseText(words)}${also}`);
  }
}

console.log(`\n${entries.length} verses checked.`);
for (const section of ['torah', 'neviim', 'ketuvim']) {
  console.log(`  ${section.padEnd(8)} ${sections.get(section) ?? 0}`);
}
console.log(`  ${entries.filter((e) => e.english).length} numbered differently in English Bibles.`);

const long = longVerses(results);
if (long.length > 0) {
  console.log(`\nLonger than ${LONG_VERSE_WORDS} words (not an error, but read them again):`);
  for (const l of long) console.log(`  ${l}`);
}

const failures = failureLines(results);
if (failures.length > 0) {
  console.error('\nFAILED — these entries do not resolve against the corpus:');
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log('\nAll references resolve against the Westminster Leningrad Codex.');
