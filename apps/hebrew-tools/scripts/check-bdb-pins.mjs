#!/usr/bin/env node
/**
 * Check the BDB pins against STEPBible's TBESH — the step every pin goes
 * through before it is added (see "Glosses" in CLAUDE.md).
 *
 *   pnpm check:pins              check every pin in scripts/data/bdb-pins.json
 *   pnpm check:pins 571 5769     look words up before pinning them
 *
 * **Checking** fails when a pin has no `tbesh` field (TBESH was never
 * consulted) or when its recorded `tbesh` is no longer what TBESH says. It
 * also lists the pins whose words TBESH does not share — not a failure, since
 * a pin may only use BDB's wording, but the pin's `why` should say why.
 *
 * **Looking up** prints, for each lemma key: BDB's head gloss, every def the
 * entry carries (the only words a pin may use), each stem's first sense, and
 * TBESH's glosses. Copy TBESH's first gloss into the pin's `tbesh` field.
 *
 * Fetches the pinned lexicon and TBESH (~8 MB); writes nothing. TBESH's licence
 * asks that it not be redistributed, so it is read from STEPBible's repository
 * every time and never saved here.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseAugIndex, parseBdbEntry, parseLexicalIndex } from './lib/oshb.mjs';
import { LEXICON_BASE, TBESH_URL } from './lib/sources.mjs';
import { checkPins, parseTbesh, tbeshId } from './lib/tbesh.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PINS = join(__dirname, 'data', 'bdb-pins.json');

const log = (...args) => process.stdout.write(`${args.join(' ')}\n`);
const warn = (...args) => process.stderr.write(`${args.join(' ')}\n`);

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function main() {
  const keys = process.argv.slice(2);
  const [augXml, lexXml, bdbXml, tbeshText, pinsJson] = await Promise.all([
    fetchText(`${LEXICON_BASE}/AugIndex.xml`),
    fetchText(`${LEXICON_BASE}/LexicalIndex.xml`),
    fetchText(`${LEXICON_BASE}/BrownDriverBriggs.xml`),
    fetchText(TBESH_URL),
    readFile(PINS, 'utf-8'),
  ]);
  const aug = parseAugIndex(augXml);
  const lexicon = parseLexicalIndex(lexXml);
  const tbesh = parseTbesh(tbeshText);
  const { pins } = JSON.parse(pinsJson);

  // Only the entries asked about are parsed, so a lookup stays quick.
  const bdbBody = (key) => {
    const id = lexicon.get(aug.get(key) ?? '')?.bdb;
    if (!id) return undefined;
    const m = new RegExp(`<entry id="${id.replace(/\./g, '\\.')}"[^>]*>([\\s\\S]*?)</entry>`).exec(
      bdbXml,
    );
    return m ? parseBdbEntry(m[1]) : undefined;
  };
  const headword = (key) => lexicon.get(aug.get(key) ?? '')?.hebrew ?? '';

  if (keys.length > 0) {
    for (const key of keys) {
      const entry = bdbBody(key);
      log(`\n${key}  ${headword(key)}  (TBESH ${tbeshId(key) ?? '—'})`);
      if (!entry) log('  BDB:   no entry');
      else {
        log(`  BDB head:   ${entry.gloss.join(', ') || '—'}`);
        log(`  BDB defs:   ${[...entry.defs].join(' · ')}`);
        for (const [stem, senses] of Object.entries(entry.stems)) {
          log(`  ${stem.padEnd(11)} ${senses[0].join(', ')}`);
        }
      }
      log(`  TBESH:      ${(tbesh.get(tbeshId(key) ?? '') ?? ['— no entry']).join(' | ')}`);
      if (pins[key]) log(`  pinned:     ${JSON.stringify(pins[key])}`);
    }
    return;
  }

  const { missing, stale, differs } = checkPins(pins, tbesh);
  log(`bdb pins: ${Object.keys(pins).length} checked against TBESH`);

  if (differs.length > 0) {
    // Not a failure: a pin need not match TBESH. Each difference is reported
    // to Mitch and explained in the pin's "why".
    log(`\n  ${differs.length} pins TBESH words differently — report these, and check each "why":`);
    for (const d of differs) {
      log(
        `    ${d.key.padEnd(6)} ${headword(d.key).padEnd(10)} pin: ${d.chosen.join(', ')}  ·  TBESH: ${d.current}`,
      );
    }
  }

  for (const m of missing) {
    warn(`  ${m.key}: no "tbesh" field — TBESH says ${JSON.stringify(m.current)}`);
  }
  for (const s of stale) {
    warn(
      `  ${s.key}: recorded "tbesh" ${JSON.stringify(s.recorded)}, TBESH now says ${JSON.stringify(s.current)}`,
    );
  }
  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      `${missing.length} pins never checked, ${stale.length} checked against an older TBESH`,
    );
  }
  log('  every pin records what TBESH says');
}

main().catch((err) => {
  warn(`check:pins failed: ${err.message}`);
  process.exit(1);
});
