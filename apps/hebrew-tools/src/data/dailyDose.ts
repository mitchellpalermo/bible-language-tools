/**
 * hebrew.tools' binding of the Daily Dose of Scripture feed (Phase 3b, #129).
 *
 * `/daily` shows the newest Hebrew verse lesson from dailydoseofscripture.com
 * and falls back to the curated list in `dailyVerses.ts` when it cannot. The
 * fetch, timeout, cache and title handling are `@tools/shared/daily-dose`,
 * shared with greek.tools; what is Hebrew is here.
 *
 * Three facts about the Hebrew feed, all checked against it in Oct 2026:
 *
 * - **Hebrew is category 192.** Looked up with
 *   `/wp-json/wp/v2/categories?slug=hebrew`. Look it up again rather than
 *   guessing if it moves — Greek's old ID turned out to be Aramaic on this host.
 * - **Titles number verses the way the Hebrew Bible does**, which is what the
 *   corpus does too. The feed runs Psalm 18 from 18:1 to 18:51 and has Psalm
 *   9:21 and Jonah 2:11, none of which exist in English numbering, and all 2,522
 *   of its verse titles resolve in the Westminster Leningrad Codex. So a lesson
 *   reference goes to the corpus unchanged — the trap `dailyVerses.ts` exists to
 *   catch does not apply. It also means a lesson carries no `english`: the feed
 *   says nothing about English numbering, and inferring it would be guessing.
 * - **Most of the category is not a verse lesson.** Of 3,526 posts, about a
 *   thousand are grammar lessons ("4c – Inseparable Prepositions"), Q&A
 *   ("Q&A – Psalm 23:1"), corrections and notices. The shared title pattern is
 *   anchored, and the book-name lookup rejects the rest.
 */

import {
  createDailyDoseSource,
  type DailyDoseOutcome,
  dailyDoseApiUrl,
  parseLessonTitle,
} from '@tools/shared/daily-dose';
import type { DailyVerseRef } from './dailyVerses';
import type { HebrewBookMeta } from './morphhb';

export type { DailyDoseFailure } from '@tools/shared/daily-dose';

/** The "Hebrew" category on dailydoseofscripture.com. */
export const HEBREW_CATEGORY_ID = 192;

/**
 * Book names the feed uses that are not a `books.json` name.
 *
 * Only names seen in the feed belong here, each worth one entry: "Psalm" is
 * how a single psalm is cited, and the feed's 561 psalm lessons all use it;
 * "Gen" appears on twelve early Genesis lessons. A typo the feed made once
 * ("1 King") is not worth an entry — the day falls back to the curated list.
 */
export const TITLE_ALIASES: Readonly<Record<string, string>> = { Psalm: 'PSA', Gen: 'GEN' };

type BookNames = Pick<HebrewBookMeta, 'code' | 'name'>[];

/**
 * Every name a title may use, mapped to its book code.
 *
 * Built from `books.json` — the corpus's own index, which the page fetches
 * anyway for the Hebrew book name — so the 39 names are not kept a second time.
 */
export function bookNameIndex(books: BookNames): Record<string, string> {
  return { ...Object.fromEntries(books.map((b) => [b.name, b.code])), ...TITLE_ALIASES };
}

/**
 * The name a reference is shown under. A single psalm is "Psalm", the same
 * rule `dailyVerses.ts` follows, so a lesson and a curated verse read alike.
 */
export function displayBookName(code: string, books: BookNames): string | undefined {
  if (code === 'PSA') return 'Psalm';
  return books.find((b) => b.code === code)?.name;
}

/**
 * Parse a lesson title into the same shape as a curated verse. The reference
 * is shown under the app's own book name, never the title's spelling, so "Gen
 * 1:1" reads "Genesis 1:1".
 */
export function parseDailyDoseRef(title: string, books: BookNames): DailyVerseRef | null {
  const ref = parseLessonTitle(title, bookNameIndex(books));
  if (!ref) return null;
  const { book, chapter, verse } = ref;
  const name = displayBookName(book, books) ?? ref.bookName;
  return { book, chapter, verse, displayRef: `${name} ${chapter}:${verse}` };
}

/** The posts query `fetchDailyDoseVerse` sends. */
export const DAILY_DOSE_API_URL = dailyDoseApiUrl(HEBREW_CATEGORY_ID);

/**
 * Fetch the latest Hebrew verse lesson. Never throws: every failure comes back
 * as `{ ok: false, reason }` for the page to fall back on and report.
 *
 * Takes the book index because the titles are matched against it. With an
 * empty one — `books.json` failed to load — only `TITLE_ALIASES` can match,
 * which on most days means a `no_verse` fallback. That is the right answer: a
 * page that cannot load the corpus index is not going to load the verse either.
 */
export function fetchDailyDoseVerse(books: BookNames): Promise<DailyDoseOutcome<DailyVerseRef>> {
  return createDailyDoseSource({
    categoryId: HEBREW_CATEGORY_ID,
    toVerse: (title) => parseDailyDoseRef(title, books),
    // Distinct from greek.tools' `daily-dose-` so the two can never read each
    // other's lesson, even though sessionStorage is per origin today.
    cacheKeyPrefix: 'hebrew-daily-dose-',
  }).fetchLesson();
}
