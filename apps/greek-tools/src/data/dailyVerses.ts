// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyVerseRef {
  book: string; // MorphGNT book code (e.g. 'JHN')
  chapter: number;
  verse: number;
  displayRef: string; // Human-readable reference (e.g. 'John 3:16')
}

// ─── Curated verse list ───────────────────────────────────────────────────────
// Pedagogically valuable passages spread across the NT.
// Cycles deterministically — one per day for all users.

export const DAILY_VERSES: readonly DailyVerseRef[] = [
  // John
  { book: 'JHN', chapter: 1, verse: 1, displayRef: 'John 1:1' },
  { book: 'JHN', chapter: 1, verse: 14, displayRef: 'John 1:14' },
  { book: 'JHN', chapter: 1, verse: 29, displayRef: 'John 1:29' },
  { book: 'JHN', chapter: 3, verse: 16, displayRef: 'John 3:16' },
  { book: 'JHN', chapter: 4, verse: 24, displayRef: 'John 4:24' },
  { book: 'JHN', chapter: 8, verse: 12, displayRef: 'John 8:12' },
  { book: 'JHN', chapter: 10, verse: 10, displayRef: 'John 10:10' },
  { book: 'JHN', chapter: 11, verse: 25, displayRef: 'John 11:25' },
  { book: 'JHN', chapter: 11, verse: 35, displayRef: 'John 11:35' },
  { book: 'JHN', chapter: 14, verse: 6, displayRef: 'John 14:6' },
  { book: 'JHN', chapter: 15, verse: 5, displayRef: 'John 15:5' },
  { book: 'JHN', chapter: 20, verse: 31, displayRef: 'John 20:31' },
  // Matthew
  { book: 'MAT', chapter: 5, verse: 3, displayRef: 'Matthew 5:3' },
  { book: 'MAT', chapter: 6, verse: 9, displayRef: 'Matthew 6:9' },
  { book: 'MAT', chapter: 11, verse: 28, displayRef: 'Matthew 11:28' },
  { book: 'MAT', chapter: 22, verse: 37, displayRef: 'Matthew 22:37' },
  { book: 'MAT', chapter: 28, verse: 19, displayRef: 'Matthew 28:19' },
  // Mark
  { book: 'MRK', chapter: 1, verse: 1, displayRef: 'Mark 1:1' },
  { book: 'MRK', chapter: 10, verse: 45, displayRef: 'Mark 10:45' },
  // Luke
  { book: 'LUK', chapter: 1, verse: 37, displayRef: 'Luke 1:37' },
  { book: 'LUK', chapter: 2, verse: 11, displayRef: 'Luke 2:11' },
  { book: 'LUK', chapter: 19, verse: 10, displayRef: 'Luke 19:10' },
  // Acts
  { book: 'ACT', chapter: 1, verse: 8, displayRef: 'Acts 1:8' },
  { book: 'ACT', chapter: 4, verse: 12, displayRef: 'Acts 4:12' },
  // Romans
  { book: 'ROM', chapter: 1, verse: 16, displayRef: 'Romans 1:16' },
  { book: 'ROM', chapter: 1, verse: 17, displayRef: 'Romans 1:17' },
  { book: 'ROM', chapter: 3, verse: 23, displayRef: 'Romans 3:23' },
  { book: 'ROM', chapter: 5, verse: 8, displayRef: 'Romans 5:8' },
  { book: 'ROM', chapter: 6, verse: 23, displayRef: 'Romans 6:23' },
  { book: 'ROM', chapter: 8, verse: 1, displayRef: 'Romans 8:1' },
  { book: 'ROM', chapter: 8, verse: 28, displayRef: 'Romans 8:28' },
  { book: 'ROM', chapter: 8, verse: 38, displayRef: 'Romans 8:38' },
  { book: 'ROM', chapter: 12, verse: 1, displayRef: 'Romans 12:1' },
  { book: 'ROM', chapter: 12, verse: 2, displayRef: 'Romans 12:2' },
  // 1 Corinthians
  { book: '1CO', chapter: 13, verse: 13, displayRef: '1 Corinthians 13:13' },
  { book: '1CO', chapter: 15, verse: 3, displayRef: '1 Corinthians 15:3' },
  { book: '1CO', chapter: 15, verse: 55, displayRef: '1 Corinthians 15:55' },
  // 2 Corinthians
  { book: '2CO', chapter: 5, verse: 17, displayRef: '2 Corinthians 5:17' },
  { book: '2CO', chapter: 5, verse: 21, displayRef: '2 Corinthians 5:21' },
  // Galatians
  { book: 'GAL', chapter: 2, verse: 20, displayRef: 'Galatians 2:20' },
  { book: 'GAL', chapter: 5, verse: 22, displayRef: 'Galatians 5:22' },
  // Ephesians
  { book: 'EPH', chapter: 2, verse: 8, displayRef: 'Ephesians 2:8' },
  { book: 'EPH', chapter: 2, verse: 10, displayRef: 'Ephesians 2:10' },
  // Philippians
  { book: 'PHP', chapter: 4, verse: 4, displayRef: 'Philippians 4:4' },
  { book: 'PHP', chapter: 4, verse: 7, displayRef: 'Philippians 4:7' },
  { book: 'PHP', chapter: 4, verse: 13, displayRef: 'Philippians 4:13' },
  // Colossians
  { book: 'COL', chapter: 1, verse: 15, displayRef: 'Colossians 1:15' },
  { book: 'COL', chapter: 3, verse: 16, displayRef: 'Colossians 3:16' },
  // 1 Thessalonians
  { book: '1TH', chapter: 5, verse: 16, displayRef: '1 Thessalonians 5:16' },
  { book: '1TH', chapter: 5, verse: 17, displayRef: '1 Thessalonians 5:17' },
  { book: '1TH', chapter: 5, verse: 18, displayRef: '1 Thessalonians 5:18' },
  // 2 Timothy
  { book: '2TI', chapter: 3, verse: 16, displayRef: '2 Timothy 3:16' },
  // Hebrews
  { book: 'HEB', chapter: 4, verse: 12, displayRef: 'Hebrews 4:12' },
  { book: 'HEB', chapter: 11, verse: 1, displayRef: 'Hebrews 11:1' },
  { book: 'HEB', chapter: 13, verse: 8, displayRef: 'Hebrews 13:8' },
  // James
  { book: 'JAS', chapter: 1, verse: 22, displayRef: 'James 1:22' },
  // 1 Peter
  { book: '1PE', chapter: 5, verse: 7, displayRef: '1 Peter 5:7' },
  // 1 John
  { book: '1JN', chapter: 1, verse: 9, displayRef: '1 John 1:9' },
  { book: '1JN', chapter: 4, verse: 8, displayRef: '1 John 4:8' },
  { book: '1JN', chapter: 4, verse: 19, displayRef: '1 John 4:19' },
  // Revelation
  { book: 'REV', chapter: 1, verse: 8, displayRef: 'Revelation 1:8' },
  { book: 'REV', chapter: 21, verse: 4, displayRef: 'Revelation 21:4' },
  { book: 'REV', chapter: 22, verse: 20, displayRef: 'Revelation 22:20' },
] as const;

// ─── Day selection ────────────────────────────────────────────────────────────

/**
 * Returns the index into DAILY_VERSES for a given date.
 * Uses local midnight so the verse changes at local midnight for every user.
 */
export function getTodayIndex(now = new Date()): number {
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const epochDays = Math.floor(localMidnight.getTime() / (1000 * 60 * 60 * 24));
  return ((epochDays % DAILY_VERSES.length) + DAILY_VERSES.length) % DAILY_VERSES.length;
}

/** Returns today's verse ref. Same result for every call on the same calendar day. */
export function getTodayVerse(now?: Date): DailyVerseRef {
  return DAILY_VERSES[getTodayIndex(now)];
}

// ─── Streak persistence ───────────────────────────────────────────────────────

const STREAK_KEY = 'greek-tools-daily-v1';

export interface DailyStreakData {
  streak: number;
  lastReadDate: string; // YYYY-MM-DD local date
}

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadStreakData(): DailyStreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { streak: 0, lastReadDate: '' };
    return JSON.parse(raw) as DailyStreakData;
  } catch {
    return { streak: 0, lastReadDate: '' };
  }
}

/**
 * Mark today as read and return updated streak data.
 * Calling this multiple times on the same calendar day is idempotent.
 */
export function markReadToday(now = new Date()): DailyStreakData {
  const today = localDateStr(now);

  const yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  const yesterday = localDateStr(yd);

  const prev = loadStreakData();
  if (prev.lastReadDate === today) return prev; // already counted today

  const newStreak = prev.lastReadDate === yesterday ? prev.streak + 1 : 1;
  const updated: DailyStreakData = { streak: newStreak, lastReadDate: today };

  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }

  return updated;
}
