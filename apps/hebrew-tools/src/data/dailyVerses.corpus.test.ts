import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkEntries,
  DISPLAY_NAMES,
  failureLines,
  LONG_VERSE_WORDS,
  longVerses,
} from '../../scripts/lib/daily-verses.mjs';
import { hasCorpus } from '../test/corpus';
import { DAILY_VERSES } from './dailyVerses';

/**
 * Every Daily Verse reference, resolved against the real corpus.
 *
 * **This is the check that cannot be done any other way.** A reference typed
 * off an English Bible page still resolves in the Westminster Leningrad Codex
 * and shows a different verse; no amount of reasoning about the array catches
 * it, because the array is internally consistent either way. Only the text can
 * answer.
 *
 * It needs `public/data/morphhb/` — 24 MB, gitignored, regenerated from
 * upstream — so it is guarded by `hasCorpus` like every other corpus check.
 * Locally it skips until `pnpm build:data` has been run. In CI it is part of
 * the corpus gate: `hebrew-tools.yml` builds the corpus before the tests, and
 * `src/test/corpus.test.ts` fails the run if it is missing, so this cannot
 * quietly turn into a skip there.
 *
 * `pnpm check:verses --show` is the same validation with the text printed, for
 * proofreading the list by eye.
 */

const DATA_DIR = join(import.meta.dirname, '..', '..', 'public', 'data', 'morphhb');

const books = new Map<string, unknown>();
function lookup(code: string) {
  if (!books.has(code)) {
    try {
      books.set(code, JSON.parse(readFileSync(join(DATA_DIR, `${code}.json`), 'utf8')));
    } catch {
      books.set(code, null);
    }
  }
  return books.get(code);
}

/**
 * The shape `checkEntries` returns. Declared here because the checker is a
 * `.mjs` — shared with the CLI, which Node runs directly and so cannot be
 * TypeScript.
 */
interface CheckResult {
  entry: (typeof DAILY_VERSES)[number];
  problems: string[];
  /** Absent when the entry did not resolve. */
  words?: unknown[];
}

describe.skipIf(!hasCorpus)('DAILY_VERSES against the corpus', () => {
  const results = (): CheckResult[] =>
    checkEntries(DAILY_VERSES, { lookup, displayNames: DISPLAY_NAMES });

  it('resolves every reference in the Westminster Leningrad Codex', () => {
    // Reported as the checker's own lines so a failure here reads the same as
    // `pnpm check:verses` does, naming each bad entry and why.
    expect(failureLines(results()).join('\n')).toBe('');
  });

  it('keeps every verse short enough to be a daily verse', () => {
    expect(longVerses(results(), LONG_VERSE_WORDS)).toEqual([]);
  });

  it('checked the whole list, not an empty one', () => {
    // A lookup that silently returned nothing would make the assertions above
    // vacuous; this pins that the corpus was actually read.
    const resolved = results().filter((r) => r.words !== undefined);
    expect(resolved).toHaveLength(DAILY_VERSES.length);
  });
});
