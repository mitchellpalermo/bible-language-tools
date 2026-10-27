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
 *   glosses.json  lemma → { g, s? } — BDB's short gloss and a verb's stem senses
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
  buildGlossIndex,
  buildLemmaIndex,
  createLemmaStats,
  parseAugIndex,
  parseBdb,
  parseBook,
  parseLexicalIndex,
  parseStrongGlosses,
} from './lib/oshb.mjs';
import { LEXICON_BASE, WLC_BASE } from './lib/sources.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data', 'morphhb');
const PINS = join(__dirname, 'data', 'bdb-pins.json');
const FORCE = process.argv.includes('--force');

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
    (await fileExists(join(OUT_DIR, 'glosses.json'))) &&
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

  const [augXml, lexXml, strongXml, bdbXml] = await Promise.all([
    fetchText(`${LEXICON_BASE}/AugIndex.xml`),
    fetchText(`${LEXICON_BASE}/LexicalIndex.xml`),
    fetchText(`${LEXICON_BASE}/HebrewStrong.xml`),
    fetchText(`${LEXICON_BASE}/BrownDriverBriggs.xml`),
  ]);
  const augIndex = parseAugIndex(augXml);
  const lexicalIndex = parseLexicalIndex(lexXml);
  const { lemmas, unresolved, glossless, strongConflicts } = buildLemmaIndex(
    stats,
    augIndex,
    lexicalIndex,
    parseStrongGlosses(strongXml),
  );

  await writeFile(join(OUT_DIR, 'lemmas.json'), JSON.stringify(lemmas), 'utf-8');

  // A separate file, not more fields on lemmas.json: the popup needs the
  // lemma index for a count and a root, and the gloss line needs only this.
  const { pins } = JSON.parse(await readFile(PINS, 'utf-8'));
  const glossIndex = buildGlossIndex(lemmas, augIndex, lexicalIndex, parseBdb(bdbXml), pins);
  await writeFile(join(OUT_DIR, 'glosses.json'), JSON.stringify(glossIndex.glosses), 'utf-8');

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

  reportGlosses(glossIndex, lemmas);

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

/**
 * Where the short glosses came from, by lemma and by occurrence. A drop in the
 * BDB share is the first sign the parser stopped reading an entry shape.
 */
function reportGlosses({ sources, stemmed }, lemmas) {
  const numbered = Object.entries(lemmas).filter(([key]) => /^\d/.test(key));
  const totalLemmas = numbered.length;
  const totalTokens = numbered.reduce((sum, [, l]) => sum + l.count, 0);
  const tokens = (list) => list.reduce((sum, item) => sum + item.count, 0);
  const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
  const line = (label, list) =>
    `    ${label.padEnd(30)} ${String(list.length).padStart(5)} lemmas (${pct(list.length, totalLemmas)}), ` +
    `${pct(tokens(list), totalTokens)} of occurrences`;

  log('  short glosses (glosses.json):');
  log(line('BDB', sources.bdb));
  log(line('BDB, pinned sense', sources.pin));
  log(line('proper name, transliteration', sources.xlit));
  log(line("Strong's (BDB bare)", sources.strong));
  if (sources.none.length > 0) log(line('none', sources.none));

  const verbs = numbered.filter(([, l]) => l.pos === 'V');
  const verbKeys = new Set(verbs.map(([key]) => key));
  const covered = stemmed.filter((s) => verbKeys.has(s.lemma));
  log(
    `    verbs with BDB stem senses     ${String(covered.length).padStart(5)} of ${verbs.length} ` +
      `(${pct(
        tokens(covered),
        verbs.reduce((sum, [, l]) => sum + l.count, 0),
      )} of verb occurrences)`,
  );
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
