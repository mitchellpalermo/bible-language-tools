#!/usr/bin/env node
/**
 * Build script: fetches the Open Scriptures Hebrew Bible (OSHB) and the OSHB
 * Hebrew Lexicon from GitHub and writes the app's morphology data to
 * `public/data/morphhb/`.
 *
 * Output:
 *   {CODE}.json   per book — { [chapter]: { [verse]: HebrewWord[] } }
 *   books.json    the 39-book index, in Tanakh order
 *   lemmas.json   lemma → { count, hebrew?, xlit?, pos?, gender?, root?, gloss? }
 *
 * `lemmas.json` is the authoritative frequency source for the app. Its counts are
 * real occurrence counts over the Westminster Leningrad Codex, computed per
 * *morpheme*, so an inseparable preposition is counted every time it is prefixed
 * to a word and not only where it stands alone.
 *
 * All parsing lives in `lib/oshb.mjs`; this file is fetch, orchestrate and write.
 *
 * Run:          node scripts/build-morphhb.mjs
 * Force refetch: node scripts/build-morphhb.mjs --force
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOOKS } from './lib/books.mjs';
import {
  buildLemmaIndex,
  createLemmaStats,
  parseAugIndex,
  parseBook,
  parseLexicalIndex,
  parseStrongGlosses,
} from './lib/oshb.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'morphhb');
const FORCE = process.argv.includes('--force');

/**
 * The corpus tracks `master`, matching how greek-tools consumes MorphGNT: the
 * WLC is a living critical edition and we want its corrections.
 *
 * The lexicon is pinned to a commit, matching how greek-tools consumes Dodson.
 * It is reference data whose only job is to be stable — an upstream edit that
 * silently changed 9,000 headwords would be invisible in a diff of generated
 * output that is not committed.
 */
const WLC_BASE = 'https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc';
const LEXICON_BASE =
  'https://raw.githubusercontent.com/openscriptures/HebrewLexicon/21c9add13bc727d3a951361778e97e3ff7afd1ce';

const log = (...args) => process.stdout.write(`${args.join(' ')}\n`);
const warn = (...args) => process.stderr.write(`${args.join(' ')}\n`);

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const upToDate =
    !FORCE &&
    (await fileExists(join(OUT_DIR, 'lemmas.json'))) &&
    (await fileExists(join(OUT_DIR, 'books.json'))) &&
    (await Promise.all(BOOKS.map((b) => fileExists(join(OUT_DIR, `${b.code}.json`))))).every(
      Boolean,
    );

  if (upToDate) {
    log('morphhb: data already present — pass --force to refetch');
    return;
  }

  const { stats, record } = createLemmaStats();
  const bookIndex = [];
  let totalWords = 0;

  for (const book of BOOKS) {
    const xml = await fetchText(`${WLC_BASE}/${book.file}.xml`);
    const chapters = parseBook(xml, record);

    const chapterCount = Object.keys(chapters).length;
    if (chapterCount === 0) {
      throw new Error(`Parsed 0 chapters from ${book.file}.xml — check the OSHB file format`);
    }

    let words = 0;
    for (const verses of Object.values(chapters)) {
      for (const verse of Object.values(verses)) words += verse.length;
    }
    totalWords += words;

    await writeFile(join(OUT_DIR, `${book.code}.json`), JSON.stringify(chapters), 'utf-8');
    bookIndex.push({
      code: book.code,
      name: book.name,
      hebrew: book.hebrew,
      section: book.section,
      chapters: chapterCount,
      words,
    });
    log(`  ${book.code.padEnd(3)} ${String(chapterCount).padStart(3)} ch  ${words} words`);
  }

  await writeFile(join(OUT_DIR, 'books.json'), JSON.stringify(bookIndex, null, 2), 'utf-8');

  const [augXml, lexXml, strongXml] = await Promise.all([
    fetchText(`${LEXICON_BASE}/AugIndex.xml`),
    fetchText(`${LEXICON_BASE}/LexicalIndex.xml`),
    fetchText(`${LEXICON_BASE}/HebrewStrong.xml`),
  ]);
  const { lemmas, unresolved, glossless, strongConflicts } = buildLemmaIndex(
    stats,
    parseAugIndex(augXml),
    parseLexicalIndex(lexXml),
    parseStrongGlosses(strongXml),
  );

  await writeFile(join(OUT_DIR, 'lemmas.json'), JSON.stringify(lemmas), 'utf-8');

  const lemmaCount = Object.keys(lemmas).length;
  const glossed = lemmaCount - glossless.length;
  log(`morphhb: ${totalWords} words, ${lemmaCount} lemmas across ${bookIndex.length} books`);
  log(`  ${glossed} lemmas glossed (${((glossed / lemmaCount) * 100).toFixed(1)}%)`);

  // The eight that never resolve are the inseparable prefixes — letter codes
  // with no Strong's entry behind them. They are the most-read words on the
  // page, so `src/lib/gloss.ts` supplies them by hand rather than leaving the
  // popup blank on a ל.
  if (glossless.length > 0) {
    warn(
      `  ${glossless.length} lemmas without a gloss: ` +
        glossless
          .slice(0, 10)
          .map((g) => `${g.lemma}×${g.count}`)
          .join(', '),
    );
  }

  if (strongConflicts.length > 0) {
    warn(
      `  ${strongConflicts.length} lemmas whose key and lexicon disagree on a Strong's number: ` +
        strongConflicts.map((c) => `${c.lemma} vs ${c.lexicon}`).join(', '),
    );
  }

  if (unresolved.length > 0) {
    const tokens = unresolved.reduce((sum, u) => sum + u.count, 0);
    warn(
      `  ${unresolved.length} lemmas absent from the lexicon (${tokens} occurrences): ` +
        unresolved
          .slice(0, 10)
          .map((u) => `${u.lemma}×${u.count}`)
          .join(', '),
    );
  }
}

// Sanity check the written output rather than trusting a clean exit: a silent
// regression in the parser looks exactly like a successful build.
async function verify() {
  const genesis = JSON.parse(await readFile(join(OUT_DIR, 'GEN.json'), 'utf-8'));
  const first = genesis['1']?.['1'];
  if (!first || first.length === 0) throw new Error('GEN.json is missing Genesis 1:1');
  const opening = first.map((w) => w.text.replace(/\//g, '')).join(' ');
  log(`  Genesis 1:1 — ${opening}`);
}

main()
  .then(verify)
  .catch((err) => {
    warn(`morphhb build failed: ${err.message}`);
    process.exit(1);
  });
