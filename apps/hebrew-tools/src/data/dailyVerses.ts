/**
 * The curated verse list behind `/daily` (issue #76).
 *
 * One verse a day, cycling deterministically through the list below. Chosen for
 * three things at once, in roughly this priority: high-frequency vocabulary a
 * first-year student has actually met, morphology worth stopping on, and being
 * a passage worth knowing by heart.
 *
 * ## References are the Masoretic Text's, not an English Bible's
 *
 * **This is the trap in this file, and it is silent.** The corpus is the
 * Westminster Leningrad Codex and it numbers verses the way a printed BHS does,
 * which is not always the way an English Bible does. A reference typed off an
 * English page does not fail — it resolves, and shows the student a *different
 * verse*, which nothing downstream can detect.
 *
 * Two mechanisms produce the divergence, and both are represented here:
 *
 * - **A psalm's superscription can be a verse of its own.** לַמְנַצֵּחַ מִזְמוֹר לְדָוִד
 *   is Psalm 19:1 in Hebrew, so "the heavens declare" is 19:2 here and 19:1
 *   there. Psalm 51 carries a two-verse superscription and runs two ahead.
 *   Most psalms print the superscription *inside* verse 1 and do not shift at
 *   all — Psalms 16, 23, 27, 90, 145 among them — so the offset has to be
 *   checked per psalm and never assumed from the presence of a heading.
 * - **Chapters are divided differently.** Joel has four chapters in Hebrew and
 *   three in English; Malachi has three and four. English Jonah 1:17 is Hebrew
 *   Jonah 2:1, and English Isaiah 9:6 is Hebrew Isaiah 9:5.
 *
 * `displayRef` is therefore the **Hebrew** reference — what the app shows, and
 * what a printed Tanakh shows. Where an English Bible numbers it differently,
 * `english` records that, so the page can say so rather than leaving a student
 * to conclude the app is broken when Isaiah 9:5 is not where their study Bible
 * put it. Every entry here was resolved against the built corpus by
 * `scripts/check-daily-verses.mjs`; run `pnpm check:verses` after editing.
 */

import { createDailyStreak, dayIndex } from '@tools/shared/daily';

export type { DailyStreakData } from '@tools/shared/daily';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyVerseRef {
  /** Paratext/USFM book code, as `public/data/morphhb/` names its files. */
  book: string;
  /** Chapter, in Masoretic numbering. */
  chapter: number;
  /** Verse, in Masoretic numbering. */
  verse: number;
  /** The Hebrew Bible's own reference — `Isaiah 9:5`. */
  displayRef: string;
  /**
   * The same verse as an English Bible numbers it, present **only** where the
   * two disagree. Absent means they agree; it is never a duplicate of
   * `displayRef`, and `check-daily-verses.mjs` fails if it ever becomes one.
   */
  english?: string;
}

// ─── The list ─────────────────────────────────────────────────────────────────

/**
 * 85 verses, spread across all three divisions of the Tanakh — Torah, Nevi'im
 * and Ketuvim — so the cycle is not a tour of Genesis and the Psalms.
 *
 * Verses run to about twenty words. A daily verse is meant to be finished
 * standing up, and Joshua 24:15 at thirty-four words is a reading session.
 */
export const DAILY_VERSES: readonly DailyVerseRef[] = [
  // ── Torah ──────────────────────────────────────────────────────────────────
  { book: 'GEN', chapter: 1, verse: 1, displayRef: 'Genesis 1:1' },
  { book: 'GEN', chapter: 1, verse: 3, displayRef: 'Genesis 1:3' },
  { book: 'GEN', chapter: 1, verse: 27, displayRef: 'Genesis 1:27' },
  { book: 'GEN', chapter: 2, verse: 7, displayRef: 'Genesis 2:7' },
  { book: 'GEN', chapter: 12, verse: 2, displayRef: 'Genesis 12:2' },
  { book: 'GEN', chapter: 15, verse: 6, displayRef: 'Genesis 15:6' },
  { book: 'GEN', chapter: 22, verse: 14, displayRef: 'Genesis 22:14' },
  { book: 'GEN', chapter: 28, verse: 15, displayRef: 'Genesis 28:15' },
  { book: 'GEN', chapter: 50, verse: 20, displayRef: 'Genesis 50:20' },
  { book: 'EXO', chapter: 3, verse: 14, displayRef: 'Exodus 3:14' },
  { book: 'EXO', chapter: 14, verse: 14, displayRef: 'Exodus 14:14' },
  { book: 'EXO', chapter: 15, verse: 2, displayRef: 'Exodus 15:2' },
  { book: 'EXO', chapter: 20, verse: 2, displayRef: 'Exodus 20:2' },
  { book: 'EXO', chapter: 20, verse: 3, displayRef: 'Exodus 20:3' },
  { book: 'EXO', chapter: 20, verse: 8, displayRef: 'Exodus 20:8' },
  { book: 'EXO', chapter: 34, verse: 6, displayRef: 'Exodus 34:6' },
  { book: 'LEV', chapter: 19, verse: 2, displayRef: 'Leviticus 19:2' },
  { book: 'LEV', chapter: 19, verse: 18, displayRef: 'Leviticus 19:18' },
  { book: 'NUM', chapter: 6, verse: 24, displayRef: 'Numbers 6:24' },
  { book: 'NUM', chapter: 6, verse: 25, displayRef: 'Numbers 6:25' },
  { book: 'NUM', chapter: 6, verse: 26, displayRef: 'Numbers 6:26' },
  { book: 'DEU', chapter: 6, verse: 4, displayRef: 'Deuteronomy 6:4' },
  { book: 'DEU', chapter: 6, verse: 5, displayRef: 'Deuteronomy 6:5' },
  { book: 'DEU', chapter: 30, verse: 19, displayRef: 'Deuteronomy 30:19' },
  { book: 'DEU', chapter: 31, verse: 6, displayRef: 'Deuteronomy 31:6' },

  // ── Nevi'im ────────────────────────────────────────────────────────────────
  { book: 'JOS', chapter: 1, verse: 9, displayRef: 'Joshua 1:9' },
  { book: '1SA', chapter: 2, verse: 2, displayRef: '1 Samuel 2:2' },
  { book: '1KI', chapter: 19, verse: 12, displayRef: '1 Kings 19:12' },
  { book: '2KI', chapter: 6, verse: 16, displayRef: '2 Kings 6:16' },
  { book: 'ISA', chapter: 6, verse: 3, displayRef: 'Isaiah 6:3' },
  { book: 'ISA', chapter: 6, verse: 8, displayRef: 'Isaiah 6:8' },
  // English numbers this 9:6 — the chapter break falls a verse later in Hebrew.
  { book: 'ISA', chapter: 9, verse: 5, displayRef: 'Isaiah 9:5', english: 'Isaiah 9:6' },
  { book: 'ISA', chapter: 40, verse: 8, displayRef: 'Isaiah 40:8' },
  { book: 'ISA', chapter: 40, verse: 31, displayRef: 'Isaiah 40:31' },
  { book: 'ISA', chapter: 41, verse: 10, displayRef: 'Isaiah 41:10' },
  { book: 'ISA', chapter: 53, verse: 5, displayRef: 'Isaiah 53:5' },
  { book: 'ISA', chapter: 55, verse: 11, displayRef: 'Isaiah 55:11' },
  { book: 'JER', chapter: 1, verse: 5, displayRef: 'Jeremiah 1:5' },
  { book: 'JER', chapter: 17, verse: 7, displayRef: 'Jeremiah 17:7' },
  { book: 'JER', chapter: 29, verse: 11, displayRef: 'Jeremiah 29:11' },
  { book: 'EZK', chapter: 36, verse: 26, displayRef: 'Ezekiel 36:26' },
  { book: 'HOS', chapter: 6, verse: 6, displayRef: 'Hosea 6:6' },
  { book: 'HOS', chapter: 11, verse: 1, displayRef: 'Hosea 11:1' },
  // Hebrew Joel has four chapters; English folds this into chapter 2.
  { book: 'JOL', chapter: 3, verse: 1, displayRef: 'Joel 3:1', english: 'Joel 2:28' },
  { book: 'AMO', chapter: 5, verse: 24, displayRef: 'Amos 5:24' },
  // The great fish opens chapter 2 in Hebrew and closes chapter 1 in English.
  { book: 'JON', chapter: 2, verse: 1, displayRef: 'Jonah 2:1', english: 'Jonah 1:17' },
  { book: 'MIC', chapter: 6, verse: 8, displayRef: 'Micah 6:8' },
  { book: 'NAH', chapter: 1, verse: 7, displayRef: 'Nahum 1:7' },
  { book: 'HAB', chapter: 2, verse: 4, displayRef: 'Habakkuk 2:4' },
  { book: 'ZEP', chapter: 3, verse: 17, displayRef: 'Zephaniah 3:17' },
  { book: 'ZEC', chapter: 4, verse: 6, displayRef: 'Zechariah 4:6' },
  // Hebrew Malachi has three chapters; English splits the last into 3 and 4.
  { book: 'MAL', chapter: 3, verse: 20, displayRef: 'Malachi 3:20', english: 'Malachi 4:2' },

  // ── Ketuvim ────────────────────────────────────────────────────────────────
  { book: 'PSA', chapter: 1, verse: 1, displayRef: 'Psalm 1:1' },
  { book: 'PSA', chapter: 1, verse: 2, displayRef: 'Psalm 1:2' },
  // Psalms 8, 19, 34 and 46 carry a one-verse superscription; 51 carries two.
  { book: 'PSA', chapter: 8, verse: 2, displayRef: 'Psalm 8:2', english: 'Psalm 8:1' },
  { book: 'PSA', chapter: 16, verse: 11, displayRef: 'Psalm 16:11' },
  { book: 'PSA', chapter: 19, verse: 2, displayRef: 'Psalm 19:2', english: 'Psalm 19:1' },
  { book: 'PSA', chapter: 19, verse: 15, displayRef: 'Psalm 19:15', english: 'Psalm 19:14' },
  { book: 'PSA', chapter: 23, verse: 1, displayRef: 'Psalm 23:1' },
  { book: 'PSA', chapter: 23, verse: 4, displayRef: 'Psalm 23:4' },
  { book: 'PSA', chapter: 27, verse: 1, displayRef: 'Psalm 27:1' },
  { book: 'PSA', chapter: 34, verse: 9, displayRef: 'Psalm 34:9', english: 'Psalm 34:8' },
  { book: 'PSA', chapter: 46, verse: 11, displayRef: 'Psalm 46:11', english: 'Psalm 46:10' },
  { book: 'PSA', chapter: 51, verse: 12, displayRef: 'Psalm 51:12', english: 'Psalm 51:10' },
  { book: 'PSA', chapter: 90, verse: 12, displayRef: 'Psalm 90:12' },
  { book: 'PSA', chapter: 100, verse: 3, displayRef: 'Psalm 100:3' },
  { book: 'PSA', chapter: 118, verse: 24, displayRef: 'Psalm 118:24' },
  { book: 'PSA', chapter: 119, verse: 105, displayRef: 'Psalm 119:105' },
  { book: 'PSA', chapter: 121, verse: 2, displayRef: 'Psalm 121:2' },
  { book: 'PSA', chapter: 145, verse: 8, displayRef: 'Psalm 145:8' },
  { book: 'PSA', chapter: 150, verse: 6, displayRef: 'Psalm 150:6' },
  { book: 'PRO', chapter: 1, verse: 7, displayRef: 'Proverbs 1:7' },
  { book: 'PRO', chapter: 3, verse: 5, displayRef: 'Proverbs 3:5' },
  { book: 'PRO', chapter: 3, verse: 6, displayRef: 'Proverbs 3:6' },
  { book: 'PRO', chapter: 31, verse: 30, displayRef: 'Proverbs 31:30' },
  { book: 'JOB', chapter: 1, verse: 21, displayRef: 'Job 1:21' },
  { book: 'JOB', chapter: 19, verse: 25, displayRef: 'Job 19:25' },
  { book: 'SNG', chapter: 8, verse: 6, displayRef: 'Song of Songs 8:6' },
  { book: 'RUT', chapter: 1, verse: 16, displayRef: 'Ruth 1:16' },
  { book: 'LAM', chapter: 3, verse: 22, displayRef: 'Lamentations 3:22' },
  { book: 'LAM', chapter: 3, verse: 23, displayRef: 'Lamentations 3:23' },
  { book: 'ECC', chapter: 3, verse: 1, displayRef: 'Ecclesiastes 3:1' },
  { book: 'ECC', chapter: 12, verse: 13, displayRef: 'Ecclesiastes 12:13' },
  { book: 'DAN', chapter: 12, verse: 3, displayRef: 'Daniel 12:3' },
  { book: '1CH', chapter: 16, verse: 34, displayRef: '1 Chronicles 16:34' },
] as const;

// ─── Day selection ────────────────────────────────────────────────────────────

/** Today's index into `DAILY_VERSES`. Rolls over at the reader's own midnight. */
export function getTodayIndex(now?: Date): number {
  return dayIndex(DAILY_VERSES.length, now);
}

/** Today's verse. The same for every call on the same local calendar day. */
export function getTodayVerse(now?: Date): DailyVerseRef {
  return DAILY_VERSES[getTodayIndex(now)];
}

// ─── Streak ───────────────────────────────────────────────────────────────────

/**
 * Its own key, and deliberately not the flashcards streak in
 * `hebrew-tools-stats-v1`. Reading a verse is not reviewing a deck, and rolling
 * them together would let either one carry the other. greek.tools keeps
 * `greek-tools-daily-v1` for the same reason on its own side of the wall.
 */
export const DAILY_STREAK_KEY = 'hebrew-tools-daily-v1';

export const { loadStreakData, markReadToday } = createDailyStreak(DAILY_STREAK_KEY);
