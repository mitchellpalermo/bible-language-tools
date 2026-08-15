/**
 * Validating the curated Daily Verse list against the corpus.
 *
 * Pure functions over values, with the corpus arriving as a `lookup` callback —
 * the same split as `oshb.mjs` against `build-morphhb.mjs`. Two callers share
 * it, and that is the point:
 *
 * - `scripts/check-daily-verses.mjs`, the CLI, which reads the entries out of
 *   the TypeScript source with `parseEntries` because Node cannot import it.
 * - `src/data/dailyVerses.corpus.test.ts`, which imports `DAILY_VERSES`
 *   directly and skips when the corpus is not built.
 *
 * The checks themselves live here exactly once, so the test suite and the CLI
 * cannot drift into disagreeing about what a valid entry is.
 */

import { BOOKS } from './books.mjs';

/** Verses longer than this stop being a daily verse and become a session. */
export const LONG_VERSE_WORDS = 22;

/**
 * How a reference names each book.
 *
 * `Psalm 23:1` reads better than `Psalms 23:1` — a reference names one psalm,
 * not the collection. Every other name is the book index's own, so this map
 * cannot drift from the reader's book picker.
 */
export const DISPLAY_NAMES = new Map(BOOKS.map((b) => [b.code, b.name]));
DISPLAY_NAMES.set('PSA', 'Psalm');

// ─── Reading the list ─────────────────────────────────────────────────────────

const ENTRY_PATTERN =
  /\{\s*book:\s*'([^']+)',\s*chapter:\s*(\d+),\s*verse:\s*(\d+),\s*displayRef:\s*'([^']+)'(?:,\s*english:\s*'([^']+)')?\s*\}/g;

/**
 * Pull the entries out of the TypeScript source.
 *
 * Only the CLI needs this — vitest imports the array itself. Node cannot import
 * a `.ts` module, and the alternatives (a build step, a loader, type-stripping
 * flags that differ across Node versions) all cost more than a regex over a
 * file that is machine-uniform by construction.
 *
 * **Throws if it parses fewer entries than the source declares.** That guard is
 * what keeps the regex honest: without it, a change to the literal's formatting
 * would leave the CLI quietly validating a subset and reporting success.
 */
export function parseEntries(source) {
  const start = source.indexOf('DAILY_VERSES');
  const end = source.indexOf('] as const;');
  if (start === -1 || end === -1) {
    throw new Error('could not find the DAILY_VERSES literal in the source');
  }
  const body = source.slice(start, end);

  const entries = [...body.matchAll(ENTRY_PATTERN)].map((m) => ({
    book: m[1],
    chapter: Number(m[2]),
    verse: Number(m[3]),
    displayRef: m[4],
    ...(m[5] === undefined ? {} : { english: m[5] }),
  }));

  const declared = (body.match(/\{\s*book:/g) ?? []).length;
  if (declared !== entries.length) {
    throw new Error(
      `parsed ${entries.length} of ${declared} entries — the literal's shape changed, ` +
        'so this is no longer reading all of it. Fix the pattern, not the data.',
    );
  }
  return entries;
}

// ─── Checking ─────────────────────────────────────────────────────────────────

/**
 * Every problem with one entry, as readable strings.
 *
 * `lookup(bookCode)` returns that book's `{ [chapter]: { [verse]: word[] } }`,
 * or `null` when the corpus has no such file. Navigation and message wording
 * stay here so both callers report identically.
 */
function entryProblems(entry, { lookup, displayNames, seen }) {
  const { book, chapter, verse, displayRef, english } = entry;
  const problems = [];

  const name = displayNames.get(book);
  if (!name) problems.push(`unknown book code '${book}'`);

  const key = `${book}.${chapter}.${verse}`;
  if (seen.has(key)) problems.push('duplicate reference');
  seen.add(key);

  // The reference a reader sees must name the verse actually fetched — a
  // mismatch here is the silent typo this whole module exists to catch.
  if (name && displayRef !== `${name} ${chapter}:${verse}`) {
    problems.push(`displayRef '${displayRef}' should read '${name} ${chapter}:${verse}'`);
  }

  // `english` means "the English Bible disagrees". Equal to `displayRef`, it
  // says the opposite of what its presence claims.
  if (english !== undefined && english === displayRef) {
    problems.push(`english '${english}' duplicates displayRef — omit it when the two agree`);
  }

  const data = lookup(book);
  if (!data) return { problems: [...problems, 'no corpus file — run `pnpm build:data`'] };

  const ch = data[String(chapter)];
  if (!ch) {
    const count = Object.keys(data).length;
    return { problems: [...problems, `no chapter ${chapter} (${book} has 1–${count})`] };
  }

  const words = ch[String(verse)];
  if (!words) {
    const count = Object.keys(ch).length;
    return { problems: [...problems, `no verse ${verse} (${book} ${chapter} has 1–${count})`] };
  }

  return { problems, words };
}

/**
 * Check the whole list.
 *
 * Returns one result per entry, in order, each carrying its `problems` and —
 * where it resolved — the `words` of the verse, so a caller can print it or
 * measure its length without a second pass over the corpus.
 */
export function checkEntries(entries, { lookup, displayNames }) {
  const seen = new Set();
  return entries.map((entry) => {
    const { problems, words } = entryProblems(entry, { lookup, displayNames, seen });
    return { entry, problems, words };
  });
}

/** The entries that failed, flattened into printable lines. */
export function failureLines(results) {
  const lines = [];
  for (const { entry, problems } of results) {
    if (problems.length === 0) continue;
    lines.push(`  ${entry.displayRef} (${entry.book}.${entry.chapter}.${entry.verse})`);
    for (const p of problems) lines.push(`      ${p}`);
  }
  return lines;
}

/** Resolved entries whose verse runs longer than a daily verse should. */
export function longVerses(results, limit = LONG_VERSE_WORDS) {
  return results
    .filter((r) => r.problems.length === 0 && r.words && r.words.length > limit)
    .map((r) => `${r.entry.displayRef} (${r.words.length} words)`);
}

/** The word as it should be read: the qere where there is one, no `/` markers. */
export function verseText(words) {
  return words.map((w) => (w.qere ?? w.text).replace(/\//g, '') + (w.after ?? '')).join(' ');
}
