/**
 * STEPBible's TBESH — the Translators Brief lexicon of Extended Strongs for
 * Hebrew (CC BY 4.0, Tyndale House / STEPBible.org) — as a second opinion on
 * the BDB pins in `scripts/data/bdb-pins.json`.
 *
 * **TBESH is a witness, never a source.** Nothing it says reaches the app. A
 * pin still chooses among BDB's own defs; TBESH is what a pin is checked
 * against before it is added (Mitch, Oct 2026), and every pin records what
 * TBESH said in its `tbesh` field so the comparison stays on the record.
 *
 * Why TBESH: its `Gloss` column is a short gloss per extended Strong's number,
 * written by Tyndale's translators, and its extended numbers are
 * OpenScriptures' — the same keys as our lemmas. (Its `Meaning` column is
 * Abridged BDB, so it would only be BDB agreeing with itself; only `Gloss` is
 * read.) The OSHB lexicon's own `LexicalIndex.xml` `<def>` is no witness for
 * the same reason: it is BDB's first def, cut short.
 *
 * The licence asks that the file not be redistributed, so it is fetched from
 * STEPBible's repository at a pinned commit (`check-bdb-pins.mjs`) and never
 * committed here.
 *
 * Pure functions over the file's text, like `oshb.mjs`.
 */

/**
 * The TBESH id for a lemma key: `430` → `H0430`, `5921a` → `H5921a`.
 *
 * **The suffix stays lowercase and the match is exact.** Uppercasing it, or
 * falling back to the bare number when the exact id is missing, mixes
 * homographs: under bare `H2896` sit טוֹב "pleasant" (`2896a`) and "good"
 * (`2896b`) and "welfare" (`2896c`), three different words. Same trap as
 * joining BDB by bare Strong's number.
 *
 * `undefined` for the inseparable prefixes, which are letter codes.
 */
export function tbeshId(lemmaKey) {
  const m = /^(\d+)([a-z]?)$/.exec(lemmaKey);
  return m ? `H${m[1].padStart(4, '0')}${m[2]}` : undefined;
}

/**
 * TBESH's text → eStrong id → its glosses, in file order, without repeats.
 *
 * A data line is tab-separated: eStrong, dStrong, uStrong, Hebrew,
 * transliteration, morph, gloss, meaning. The first line for an id is its main
 * sense (`H0571G =`); the lines after it are sub-meanings (`H0571H = a Meaning
 * of`). Everything that is not a data line — the licence, the field notes — is
 * skipped by the id pattern.
 */
export function parseTbesh(text) {
  /** @type {Map<string, string[]>} */
  const index = new Map();
  for (const line of text.split('\n')) {
    const cols = line.split('\t');
    const id = cols[0]?.trim();
    if (!id || !/^H\d{4}[a-z]?$/.test(id)) continue;
    const gloss = cols[6]?.trim();
    if (!gloss) continue;
    const glosses = index.get(id) ?? [];
    if (!glosses.includes(gloss)) glosses.push(gloss);
    index.set(id, glosses);
  }
  return index;
}

/** TBESH's main gloss for a lemma, or `null` when TBESH has no entry for it. */
export function tbeshGloss(index, lemmaKey) {
  const id = tbeshId(lemmaKey);
  return (id && index.get(id)?.[0]) ?? null;
}

/**
 * Check every pin's recorded `tbesh` against TBESH as it stands.
 *
 * - `missing` — a pin with no `tbesh` field: TBESH was never consulted.
 * - `stale` — the recorded gloss is not what TBESH now says, so the pin was
 *   judged against something that has changed.
 * - `differs` — the pin and TBESH's main gloss share no word. Not an error: a
 *   pin can only choose BDB's wording, and TBESH may use a word BDB's entry
 *   does not have. It is listed so the `why` can be read against it.
 */
export function checkPins(pins, index) {
  const missing = [];
  const stale = [];
  const differs = [];

  for (const [key, pin] of Object.entries(pins)) {
    const current = tbeshGloss(index, key);
    if (!('tbesh' in pin)) {
      missing.push({ key, current });
      continue;
    }
    if (pin.tbesh !== current) stale.push({ key, recorded: pin.tbesh, current });

    const chosen = [...(pin.gloss ?? []), ...Object.values(pin.stems ?? {}).flat()];
    if (current && !sharesAWord(chosen, current)) differs.push({ key, chosen, current });
  }

  return { missing, stale, differs };
}

const STOP = new Set(['to', 'a', 'an', 'the', 'of', 'be', 'or', 'and']);

/**
 * The content words of a gloss. A parenthesis is read both ways — TBESH's
 * "to(wards)" is "towards" and "to" — and filler words are dropped only when
 * something else is left, so "to be" is still "be".
 */
function words(s) {
  const lower = s.toLowerCase();
  const all = [lower.replace(/[()]/g, ''), lower.replace(/\([^)]*\)/g, ' ')]
    .flatMap((v) => v.split(/[^a-z]+/))
    .filter(Boolean);
  const content = all.filter((w) => !STOP.has(w));
  return content.length > 0 ? content : all;
}

function sharesAWord(chosen, gloss) {
  const theirs = new Set(words(gloss));
  return chosen.some((item) => words(item).some((w) => theirs.has(w)));
}
