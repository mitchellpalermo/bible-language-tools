#!/usr/bin/env node
/**
 * Build script: inventories every morph code the Westminster Leningrad Codex
 * actually uses and writes `src/lib/morph-codes.json` (issue #117).
 *
 * `src/lib/morph-parse.ts` is written from the OSHB morphology spec. The spec is
 * a table of letters; it does not say which combinations occur, and it does not
 * mention the shapes that only turn up in the text — `Pdxms`, where `x` fills a
 * person slot a demonstrative does not have, or `Nxxxa`, where the sub-type slot
 * is empty too. So the corpus is the second witness: `morph-parse.test.ts` walks
 * this inventory and asserts every code in it parses.
 *
 * The output is committed source for the same reason `vocabulary-garrett.ts` is:
 * the corpus is 24 MB and gitignored, and CI runs tests without building it. A
 * test that skips when the data is absent is not coverage.
 *
 * Counts are deliberately not recorded. `openscriptures/morphhb` tracks `master`
 * — a living critical edition — so a single corrected word would churn the file
 * and fail `--check` for no reason. The *set* of codes is what the parser has to
 * cover, and it moves only when the morphology itself does.
 *
 * Run: node scripts/extract-morph-codes.mjs
 *      node scripts/extract-morph-codes.mjs --check   report only, write nothing
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOOKS } from './lib/books.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'public/data/morphhb');
const OUT_FILE = join(ROOT, 'src/lib/morph-codes.json');

const CHECK_ONLY = process.argv.includes('--check');

const log = (msg) => process.stdout.write(`${msg}\n`);
const warn = (msg) => process.stderr.write(`${msg}\n`);

async function collect() {
  const codes = new Set();
  for (const book of BOOKS) {
    const path = join(DATA_DIR, `${book.code}.json`);
    const chapters = JSON.parse(await readFile(path, 'utf-8'));
    for (const verses of Object.values(chapters)) {
      for (const words of Object.values(verses)) {
        for (const word of words) {
          // The language marker leads the whole word's parsing and governs every
          // segment in it — a stem letter means one thing in Hebrew and another
          // in Aramaic, so it is carried onto each code here rather than dropped.
          const language = word.parsing[0];
          for (const segment of word.parsing.slice(1).split('/')) {
            codes.add(`${language}${segment}`);
          }
        }
      }
    }
  }
  return [...codes].sort();
}

async function main() {
  const codes = await collect().catch((err) => {
    throw new Error(`${err.message} — run \`pnpm build:data\` first`);
  });
  const source = `${JSON.stringify(codes, null, 2)}\n`;

  if (CHECK_ONLY) {
    const current = await readFile(OUT_FILE, 'utf-8').catch(() => '');
    if (current !== source) {
      const known = new Set(JSON.parse(current || '[]'));
      const added = codes.filter((c) => !known.has(c));
      const removed = [...known].filter((c) => !codes.includes(c));
      throw new Error(
        `src/lib/morph-codes.json is stale — run \`pnpm build:morph-codes\`` +
          (added.length ? `\n  new: ${added.join(', ')}` : '') +
          (removed.length ? `\n  gone: ${removed.join(', ')}` : ''),
      );
    }
    log(`morph codes: inventory is up to date (${codes.length} codes)`);
    return;
  }

  await writeFile(OUT_FILE, source, 'utf-8');
  log(`morph codes: wrote ${codes.length} codes to src/lib/morph-codes.json`);
}

main().catch((err) => {
  warn(`morph code extraction failed: ${err.message}`);
  process.exit(1);
});
