#!/usr/bin/env node
/**
 * Build script: generates src/data/vocabulary.ts from MorphGNT frequency data
 * and the Dodson Greek-English Lexicon (CC0 public domain).
 *
 * Prerequisites: public/data/morphgnt/ must exist (run build-morphgnt.mjs first)
 *
 * Run:        node scripts/build-vocabulary.mjs
 * Force regen: node scripts/build-vocabulary.mjs --force
 */

import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MORPHGNT_DIR = join(__dirname, '..', 'public', 'data', 'morphgnt');
const OUT_FILE = join(__dirname, '..', 'src', 'data', 'vocabulary.ts');
const FORCE = process.argv.includes('--force');

// Dodson Greek-English Lexicon, John Jeffrey Dodson (2010), CC0 public domain
// biblicalhumanities/dodson-greek-lexicon — pinned to a specific commit for reproducibility
const DODSON_URL =
  'https://raw.githubusercontent.com/biblicalhumanities/dodson-greek-lexicon/74f70358d4acfaf2f980bf2feb58ab7115cbbcbc/dodson.xml';

const BOOK_CODES = [
  'MAT',
  'MRK',
  'LUK',
  'JHN',
  'ACT',
  'ROM',
  '1CO',
  '2CO',
  'GAL',
  'EPH',
  'PHP',
  'COL',
  '1TH',
  '2TH',
  '1TI',
  '2TI',
  'TIT',
  'PHM',
  'HEB',
  'JAS',
  '1PE',
  '2PE',
  '1JN',
  '2JN',
  '3JN',
  'JUD',
  'REV',
];

// MorphGNT 2-char POS code → our POS enum value
const MORPHGNT_POS_MAP = {
  'N-': 'noun',
  'V-': 'verb',
  RA: 'article',
  RD: 'pronoun', // demonstrative
  RI: 'pronoun', // interrogative/indefinite
  RP: 'pronoun', // personal
  RR: 'pronoun', // relative
  'A-': 'adjective',
  'C-': 'conjunction',
  'D-': 'adverb',
  'P-': 'preposition',
  'I-': 'particle', // interjection
  'X-': 'particle', // indeclinable/other
};

/**
 * Hand-curated overrides for the existing top-50 entries.
 * These are preserved verbatim and take precedence over Dodson data.
 * Keys are the MorphGNT lemma forms; `greek` is the display form used in the output.
 */
const OVERRIDES = new Map([
  // Multi-form display entries (MorphGNT lemma differs from display form)
  ['ὁ', { greek: 'ὁ, ἡ, τό', gloss: 'the', partOfSpeech: 'article' }],
  ['οὐ', { greek: 'οὐ, οὐκ, οὐχ', gloss: 'not', partOfSpeech: 'adverb' }],
  ['ἐκ', { greek: 'ἐκ, ἐξ', gloss: 'from, out of (+ gen.)', partOfSpeech: 'preposition' }],

  // Single-form overrides (same as MorphGNT lemma)
  ['καί', { greek: 'καί', gloss: 'and, even, also', partOfSpeech: 'conjunction' }],
  ['αὐτός', { greek: 'αὐτός', gloss: 'he, she, it; self, same', partOfSpeech: 'pronoun' }],
  ['σύ', { greek: 'σύ', gloss: 'you (singular)', partOfSpeech: 'pronoun' }],
  ['δέ', { greek: 'δέ', gloss: 'but, and, now', partOfSpeech: 'conjunction' }],
  ['ἐν', { greek: 'ἐν', gloss: 'in, on, among (+ dat.)', partOfSpeech: 'preposition' }],
  ['εἰμί', { greek: 'εἰμί', gloss: 'I am, exist', partOfSpeech: 'verb' }],
  ['λέγω', { greek: 'λέγω', gloss: 'I say, speak', partOfSpeech: 'verb' }],
  ['εἰς', { greek: 'εἰς', gloss: 'into, to, for (+ acc.)', partOfSpeech: 'preposition' }],
  ['ἐγώ', { greek: 'ἐγώ', gloss: 'I', partOfSpeech: 'pronoun' }],
  ['οὗτος', { greek: 'οὗτος', gloss: 'this (one)', partOfSpeech: 'pronoun' }],
  ['ὅτι', { greek: 'ὅτι', gloss: 'that, because', partOfSpeech: 'conjunction' }],
  ['γάρ', { greek: 'γάρ', gloss: 'for, because', partOfSpeech: 'conjunction' }],
  ['ἐπί', { greek: 'ἐπί', gloss: 'on, upon, over', partOfSpeech: 'preposition' }],
  ['θεός', { greek: 'θεός', gloss: 'God, god', partOfSpeech: 'noun' }],
  ['κύριος', { greek: 'κύριος', gloss: 'Lord, master', partOfSpeech: 'noun' }],
  ['Ἰησοῦς', { greek: 'Ἰησοῦς', gloss: 'Jesus, Joshua', partOfSpeech: 'noun' }],
  ['Χριστός', { greek: 'Χριστός', gloss: 'Christ, Messiah, anointed one', partOfSpeech: 'noun' }],
  ['ἔχω', { greek: 'ἔχω', gloss: 'I have, hold', partOfSpeech: 'verb' }],
  ['πρός', { greek: 'πρός', gloss: 'to, toward, with (+ acc.)', partOfSpeech: 'preposition' }],
  ['γίνομαι', { greek: 'γίνομαι', gloss: 'I become, am, happen', partOfSpeech: 'verb' }],
  ['ἀλλά', { greek: 'ἀλλά', gloss: 'but, rather', partOfSpeech: 'conjunction' }],
  ['ποιέω', { greek: 'ποιέω', gloss: 'I do, make', partOfSpeech: 'verb' }],
  ['ἄνθρωπος', { greek: 'ἄνθρωπος', gloss: 'man, human being, person', partOfSpeech: 'noun' }],
  ['πᾶς', { greek: 'πᾶς', gloss: 'all, every, each', partOfSpeech: 'adjective' }],
  ['ὅς', { greek: 'ὅς', gloss: 'who, which, that (relative)', partOfSpeech: 'pronoun' }],
  ['μή', { greek: 'μή', gloss: 'not, lest', partOfSpeech: 'adverb' }],
  ['ἀπό', { greek: 'ἀπό', gloss: 'from, away from (+ gen.)', partOfSpeech: 'preposition' }],
  [
    'διά',
    { greek: 'διά', gloss: 'through (+ gen.); because of (+ acc.)', partOfSpeech: 'preposition' },
  ],
  ['ἵνα', { greek: 'ἵνα', gloss: 'in order that, so that', partOfSpeech: 'conjunction' }],
  ['πίστις', { greek: 'πίστις', gloss: 'faith, trust, belief', partOfSpeech: 'noun' }],
  ['ἀγάπη', { greek: 'ἀγάπη', gloss: 'love', partOfSpeech: 'noun' }],
  ['ἁμαρτία', { greek: 'ἁμαρτία', gloss: 'sin', partOfSpeech: 'noun' }],
  ['πνεῦμα', { greek: 'πνεῦμα', gloss: 'spirit, wind, breath', partOfSpeech: 'noun' }],
  ['λόγος', { greek: 'λόγος', gloss: 'word, message, reason', partOfSpeech: 'noun' }],
  ['ἀδελφός', { greek: 'ἀδελφός', gloss: 'brother', partOfSpeech: 'noun' }],
  ['οἶδα', { greek: 'οἶδα', gloss: 'I know, understand', partOfSpeech: 'verb' }],
  ['βασιλεία', { greek: 'βασιλεία', gloss: 'kingdom, reign', partOfSpeech: 'noun' }],
  ['δίδωμι', { greek: 'δίδωμι', gloss: 'I give, grant', partOfSpeech: 'verb' }],
  ['ἔρχομαι', { greek: 'ἔρχομαι', gloss: 'I come, go', partOfSpeech: 'verb' }],
  ['πατήρ', { greek: 'πατήρ', gloss: 'father', partOfSpeech: 'noun' }],
  ['γῆ', { greek: 'γῆ', gloss: 'earth, land, soil', partOfSpeech: 'noun' }],
  ['οὐρανός', { greek: 'οὐρανός', gloss: 'heaven, sky', partOfSpeech: 'noun' }],
  ['ἀκούω', { greek: 'ἀκούω', gloss: 'I hear, listen to', partOfSpeech: 'verb' }],
  ['γράφω', { greek: 'γράφω', gloss: 'I write', partOfSpeech: 'verb' }],
  ['δύναμαι', { greek: 'δύναμαι', gloss: 'I am able, can', partOfSpeech: 'verb' }],
  ['ζωή', { greek: 'ζωή', gloss: 'life', partOfSpeech: 'noun' }],
  ['ἐκκλησία', { greek: 'ἐκκλησία', gloss: 'church, assembly', partOfSpeech: 'noun' }],
]);

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read all MorphGNT JSON book files and compute per-lemma frequency and POS counts.
 * Returns { frequencyMap, posCountMap } where posCountMap[lemma][posCode] = count.
 */
async function buildFrequencyAndPos() {
  const frequencyMap = {};
  const posCountMap = {};
  let _totalWords = 0;

  for (const code of BOOK_CODES) {
    const path = join(MORPHGNT_DIR, `${code}.json`);
    if (!(await fileExists(path))) {
      throw new Error(
        `MorphGNT file not found: ${path}\nRun "node scripts/build-morphgnt.mjs" first.`,
      );
    }

    const raw = await readFile(path, 'utf-8');
    const book = JSON.parse(raw);

    for (const chapter of Object.values(book)) {
      for (const verse of Object.values(chapter)) {
        for (const word of verse) {
          const { lemma, pos } = word;
          frequencyMap[lemma] = (frequencyMap[lemma] || 0) + 1;
          if (!posCountMap[lemma]) posCountMap[lemma] = {};
          posCountMap[lemma][pos] = (posCountMap[lemma][pos] || 0) + 1;
          _totalWords++;
        }
      }
    }
  }
  return { frequencyMap, posCountMap };
}

/**
 * Derive a POS enum value for a lemma from its MorphGNT POS count map.
 * Uses the most frequently assigned POS code.
 */
function derivePOS(posCountEntry) {
  let best = null;
  let bestCount = 0;
  for (const [code, count] of Object.entries(posCountEntry)) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return MORPHGNT_POS_MAP[best] ?? 'particle';
}

/**
 * Fetch and parse the Dodson XML lexicon.
 * Returns a Map from the primary lemma form (first word of <orth>) → brief gloss.
 */
async function fetchDodsonGlosses() {
  const res = await fetch(DODSON_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching Dodson XML: ${DODSON_URL}`);
  }
  const xml = await res.text();

  // Extract all <entry> blocks and parse <orth> + <def role="brief">
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
  const orthRe = /<orth>([\s\S]*?)<\/orth>/;
  const briefRe = /<def role="brief">([\s\S]*?)<\/def>/;

  const glossMap = new Map();
  let match;
  let _parsed = 0;

  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop pattern
  while ((match = entryRe.exec(xml)) !== null) {
    const body = match[1];
    const orthMatch = orthRe.exec(body);
    const briefMatch = briefRe.exec(body);
    if (!orthMatch || !briefMatch) continue;

    const orth = orthMatch[1].trim();
    const gloss = briefMatch[1].trim();

    // Primary key: text before the first comma (the lemma form)
    const primaryLemma = orth.split(',')[0].trim();
    if (primaryLemma && gloss) {
      // Don't overwrite earlier entries (lower Strong's number wins on collision)
      if (!glossMap.has(primaryLemma)) {
        glossMap.set(primaryLemma, gloss);
      }
      _parsed++;
    }
  }
  return glossMap;
}

/**
 * Normalize and escape a string for use in a TypeScript single-quoted string literal.
 * Collapses internal whitespace (including newlines) to a single space.
 */
function escapeStr(s) {
  return s
    .replace(/[\r\n\t]+/g, ' ') // collapse newlines/tabs to space
    .replace(/\s{2,}/g, ' ') // collapse multiple spaces
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

/**
 * Serialize the vocabulary array as a TypeScript source file.
 */
function serializeVocabulary(entries) {
  const lines = entries.map(
    ({ greek, gloss, frequency, partOfSpeech }) =>
      `  { greek: '${escapeStr(greek)}', gloss: '${escapeStr(gloss)}', frequency: ${frequency}, partOfSpeech: '${partOfSpeech}' },`,
  );

  return [
    '// GENERATED FILE — do not edit by hand.',
    '// Source: MorphGNT SBLGNT frequency data + Dodson Greek-English Lexicon (CC0)',
    '// Regenerate: node scripts/build-vocabulary.mjs --force',
    '',
    'export interface VocabWord {',
    '  greek: string;',
    '  gloss: string;',
    '  frequency: number;',
    '  partOfSpeech: string;',
    '}',
    '',
    '// All GNT lemmas sorted by frequency (highest first)',
    'export const vocabulary: VocabWord[] = [',
    ...lines,
    '];',
    '',
  ].join('\n');
}

async function main() {
  if (!FORCE && (await fileExists(OUT_FILE))) {
    return;
  }
  const { frequencyMap, posCountMap } = await buildFrequencyAndPos();
  const _lemmaCount = Object.keys(frequencyMap).length;
  const dodsonMap = await fetchDodsonGlosses();
  const entries = [];
  const unmatched = [];

  for (const [lemma, frequency] of Object.entries(frequencyMap)) {
    // Overrides take full precedence
    if (OVERRIDES.has(lemma)) {
      const ov = OVERRIDES.get(lemma);
      entries.push({ greek: ov.greek, gloss: ov.gloss, frequency, partOfSpeech: ov.partOfSpeech });
      continue;
    }

    // Look up gloss: try exact match first, then handle MorphGNT parenthetical forms
    // e.g. οὕτω(ς) → try οὕτω and οὕτως
    let gloss = dodsonMap.get(lemma);
    let resolvedLemma = lemma;

    if (!gloss) {
      const parenMatch = /^(.+)\((.+)\)$/.exec(lemma);
      if (parenMatch) {
        const withSuffix = parenMatch[1] + parenMatch[2]; // οὕτως
        const withoutSuffix = parenMatch[1]; // οὕτω
        gloss = dodsonMap.get(withSuffix) ?? dodsonMap.get(withoutSuffix);
        if (gloss) resolvedLemma = withSuffix;
      }
    }

    if (!gloss) {
      unmatched.push({ lemma, frequency });
      continue;
    }

    const partOfSpeech = derivePOS(posCountMap[lemma]);
    entries.push({ greek: resolvedLemma, gloss, frequency, partOfSpeech });
  }

  // Deduplicate by greek key, keeping highest-frequency entry
  const deduped = new Map();
  for (const entry of entries) {
    const existing = deduped.get(entry.greek);
    if (!existing || entry.frequency > existing.frequency) {
      deduped.set(entry.greek, entry);
    }
  }
  const uniqueEntries = [...deduped.values()];
  if (uniqueEntries.length < entries.length) {
  }
  entries.length = 0;
  entries.push(...uniqueEntries);

  // Sort by frequency descending
  entries.sort((a, b) => b.frequency - a.frequency);

  if (unmatched.length > 0) {
    // Sort unmatched by frequency so the most critical are surfaced first
    unmatched.sort((a, b) => b.frequency - a.frequency);
    for (const { lemma: _lemma, frequency: _frequency } of unmatched) {
    }
  }
  const source = serializeVocabulary(entries);
  await writeFile(OUT_FILE, source, 'utf-8');
}

main().catch((_err) => {
  process.exit(1);
});
