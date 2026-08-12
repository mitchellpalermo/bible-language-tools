#!/usr/bin/env node
/**
 * Build script: merges the course vocabulary handout with the Open Scriptures
 * Hebrew Bible and writes `src/data/vocabulary-garrett.ts` (issue #109).
 *
 * Inputs:
 *   scripts/data/garrett-handout.json   the handout, extracted once from the
 *                                       course `.docx` — chapter map and answer key
 *   scripts/data/garrett-oshb.json      hand-adjudicated exceptions: headwords
 *                                       that resolve to no lemma, and Strong's
 *                                       pins for homographs too close to call
 *   public/data/morphhb/                the corpus and the lexicon (`build-morphhb.mjs`)
 *
 * Output is committed source, not a build artifact: the corpus is 24 MB and
 * gitignored, so the app must not need it at build time to know what חֶסֶד means.
 *
 * The build **fails** on a headword that resolves to nothing and is not listed in
 * `garrett-oshb.json`, and on a homograph whose two readings are within a factor
 * of `AMBIGUITY_RATIO` and is not pinned. An unmatched Core entry is a signal —
 * either a handout typo the corpus can see and a reader could not, or a lemma
 * form worth looking at by hand — and silently passing it through is the failure
 * mode this script exists to prevent.
 *
 * All matching lives in `lib/vocab-oshb.mjs`; this file is read, orchestrate and
 * write.
 *
 * Run: node scripts/build-vocabulary.mjs
 *      node scripts/build-vocabulary.mjs --check   report only, write nothing
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOOKS } from './lib/books.mjs';
import {
  buildFormIndex,
  buildLexiconIndex,
  emitModule,
  entryKey,
  mergeEntry,
  resolveHeadword,
} from './lib/vocab-oshb.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const MORPHHB_DIR = join(__dirname, '..', 'public', 'data', 'morphhb');
const OUT_FILE = join(__dirname, '..', 'src', 'data', 'vocabulary-garrett.ts');
const CHECK_ONLY = process.argv.includes('--check');

const log = (...args) => process.stdout.write(`${args.join(' ')}\n`);
const warn = (...args) => process.stderr.write(`${args.join(' ')}\n`);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf-8'));

/** The section a word sits in, for reporting. Core entries are the ones that must match. */
const categoryOf = (entry) => entry.chapters[0]?.split(':')[1] ?? 'unknown';

async function main() {
  const handout = await readJson(join(DATA_DIR, 'garrett-handout.json'));
  const adjudicated = await readJson(join(DATA_DIR, 'garrett-oshb.json'));

  let lemmas;
  try {
    lemmas = await readJson(join(MORPHHB_DIR, 'lemmas.json'));
  } catch {
    throw new Error('public/data/morphhb/ is missing — run `pnpm build:data` first');
  }
  const books = await Promise.all(
    BOOKS.map((book) => readJson(join(MORPHHB_DIR, `${book.code}.json`))),
  );

  const lexicon = buildLexiconIndex(lemmas);
  const { forms, pairs } = buildFormIndex(books);
  log(`vocabulary: ${lexicon.size} lexicon forms, ${forms.size} attested forms`);

  const accepted = new Map(adjudicated.unmatched.map((u) => [u.entry, u.reason]));
  const words = [];
  const divergences = [];
  const unmatched = [];
  const respellings = [];
  const problems = [];
  const counts = { lexicon: 0, corpus: 0, collision: 0, absent: 0 };

  for (const entry of handout.entries) {
    const resolution = resolveHeadword(entry, {
      lexicon,
      forms,
      pairs,
      lemmas,
      pins: adjudicated.pins,
    });
    counts[resolution.status] += 1;

    if (resolution.status === 'collision' || resolution.status === 'absent') {
      const reason = accepted.get(entryKey(entry));
      if (reason === undefined) {
        problems.push(
          `${entryKey(entry)} (${categoryOf(entry)}, ch ${entry.chapters.join(' ')}) — ` +
            `${resolution.status === 'absent' ? 'no such form in the WLC' : 'only homographs of another part of speech'}` +
            ` — "${entry.gloss}"`,
        );
      } else {
        unmatched.push({ entry: entryKey(entry), reason });
      }
    } else if (resolution.ambiguous) {
      problems.push(
        `${entry.hebrew} (${categoryOf(entry)}) — homographs too close to call: ` +
          `${resolution.ranked.map((g) => `${g.strong}×${g.count}`).join(' ')} — "${entry.gloss}" ` +
          '— add a pin to scripts/data/garrett-oshb.json',
      );
    }

    const { word, divergence } = mergeEntry(entry, resolution);
    words.push(word);
    if (divergence) divergences.push(divergence);
    // A lexeme's OSHB citation form can differ from the handout's spelling in
    // ways that are not typos — a restored maqqef, a defective holam. Taking
    // OSHB's is the point of this pipeline, but a student comparing the app to
    // the book must still be able to find out why they differ.
    if (word.hebrew !== entry.hebrew.normalize('NFC')) {
      respellings.push({ printed: entry.hebrew, oshb: word.hebrew, strong: word.strong });
    }
  }

  log(
    `  ${counts.lexicon} lexicon headwords, ${counts.corpus} attested forms, ` +
      `${counts.collision + counts.absent} unresolved (${unmatched.length} accepted)`,
  );
  log(`  ${divergences.length} nouns where the textbook's gender differs from the corpus`);
  if (respellings.length > 0) {
    log(`  ${respellings.length} headword(s) respelled to the OSHB form:`);
    for (const r of respellings) log(`    ${r.printed} → ${r.oshb}  [${r.strong}]`);
  }

  // Two entries that share a headword are only different cards if they are
  // different words. Before this pipeline that claim rested on a hand-written
  // `sense`; now OSHB can check it, and a collapsed pair means one of them needs
  // a Strong's pin.
  const byHeadword = new Map();
  for (const word of words) {
    if (!word.strong) continue;
    const seen = byHeadword.get(word.hebrew) ?? new Set();
    if (seen.has(word.strong)) {
      problems.push(
        `${word.hebrew} — two entries resolve to the same lemma ${word.strong}; ` +
          'pin one of their senses in scripts/data/garrett-oshb.json',
      );
    }
    seen.add(word.strong);
    byHeadword.set(word.hebrew, seen);
  }

  const stale = adjudicated.unmatched.filter((u) => !unmatched.some((m) => m.entry === u.entry));
  if (stale.length > 0) {
    problems.push(
      `${stale.length} accepted exception(s) now resolve and should be deleted from ` +
        `scripts/data/garrett-oshb.json: ${stale.map((u) => u.entry).join(' ')}`,
    );
  }

  if (problems.length > 0) {
    warn(`\n${problems.length} entr${problems.length === 1 ? 'y' : 'ies'} need adjudication:`);
    for (const problem of problems) warn(`  ${problem}`);
    throw new Error('unadjudicated entries — fix the handout or record the exception');
  }

  const source = emitModule({
    words,
    corrections: handout.corrections,
    editorialNotes: handout.editorialNotes,
    // Sorted so the generated list does not reshuffle when a chapter is retagged.
    unmatched: [...unmatched].sort((a, b) => a.entry.localeCompare(b.entry, 'he')),
    respellings,
    divergences,
  });

  if (CHECK_ONLY) {
    const current = await readFile(OUT_FILE, 'utf-8').catch(() => '');
    if (current !== source) throw new Error(`${OUT_FILE} is stale — run \`pnpm build:vocab\``);
    log('vocabulary: generated file is up to date');
    return;
  }

  await writeFile(OUT_FILE, source, 'utf-8');
  log(`vocabulary: wrote ${words.length} entries to src/data/vocabulary-garrett.ts`);
}

main().catch((err) => {
  warn(`vocabulary build failed: ${err.message}`);
  process.exit(1);
});
