// Focus passages: a verse range a student has chosen to study deeply, saved by
// name. Language-agnostic.
//
// A focus passage is a *selection*, like a custom deck (`custom-decks.ts`): it
// names a stretch of text and owns no progress. The words in it are reviewed
// under the same SRS cards as everywhere else, so what a passage shows about
// vocabulary is read from the store, never kept beside it.
//
// This is the storage factory, the shape, the sync merge and the arithmetic over
// a range, for both apps (#226 on hebrew.tools). greek.tools has its own
// `data/focusPassages.ts` and merge; `focusPassages.test.ts` there pins that its
// rows parse and merge under these rules, so adopting this module later changes
// nothing a student can see and gives greek tombstones (see "Focus passages" in
// the repo CLAUDE.md).
//
// Nothing here reads a corpus. A book arrives as `{ [chapter]: { [verse]: T[] } }`
// — the shape both apps' per-book JSON already has — and `T` is whatever a word
// is there, which is why `versesInRange` is generic over it.
//
// DELETION IS A TOMBSTONE, by the rules in `tombstones.ts` and for the same
// reason as decks: the sync merge is a union and a plain delete comes back.

import { isIso, isLive, isRecord, mergeTombstoned, type Tombstonable } from './tombstones';

export { isLive, stampOf } from './tombstones';

/** Bounds that only stop a hostile request body; no student reaches them. */
export const MAX_PASSAGES = 200;
export const MAX_PASSAGE_LABEL = 100;
export const MAX_PASSAGE_ID_LENGTH = 100;
/** Psalm 119 has 176 verses and Psalms 150 chapters; nothing comes near this. */
export const MAX_REFERENCE_NUMBER = 999;

const BOOK_CODE = /^[0-9A-Za-z]{2,10}$/;

/** A stretch of text: first verse to last, which may run across chapters. */
export interface PassageRange {
  /** The corpus's own book code: `GEN`, `1SA`, `REV`. */
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

export interface FocusPassage extends PassageRange, Tombstonable {
  /** Never reused, so a tombstone cannot hide a new passage. */
  id: string;
  /** What the student called it. Trimmed, at most `MAX_PASSAGE_LABEL`; absent means "use the reference". */
  label?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

const RANGE_FIELDS = ['startChapter', 'startVerse', 'endChapter', 'endVerse'] as const;

function isReferenceNumber(value: unknown): value is number {
  return (
    Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_REFERENCE_NUMBER
  );
}

/** Why this range cannot be saved, or null when it can: the end must not come before the start. */
export function rangeError(range: PassageRange): string | null {
  if (!BOOK_CODE.test(range.book)) return 'Choose a book.';
  if (!RANGE_FIELDS.every((f) => isReferenceNumber(range[f]))) {
    return 'Chapters and verses must be whole numbers.';
  }
  const before =
    range.endChapter < range.startChapter ||
    (range.endChapter === range.startChapter && range.endVerse < range.startVerse);
  return before ? 'The passage ends before it starts.' : null;
}

/**
 * One passage from untrusted input (storage, or a request body) or null when
 * it is not one. A tombstone keeps its range, so the row stays a valid passage,
 * and drops its label; a blank label is no label.
 */
export function parsePassage(raw: unknown): FocusPassage | null {
  if (!isRecord(raw)) return null;
  const { id, label, book, createdAt, updatedAt, deletedAt } = raw;
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_PASSAGE_ID_LENGTH) return null;
  if (label !== undefined && label !== null) {
    if (typeof label !== 'string' || label.length > MAX_PASSAGE_LABEL) return null;
  }
  if (typeof book !== 'string') return null;
  if (!isIso(createdAt)) return null;
  if (updatedAt !== undefined && !isIso(updatedAt)) return null;
  if (deletedAt !== undefined && !isIso(deletedAt)) return null;

  const range = {
    book,
    startChapter: raw.startChapter,
    startVerse: raw.startVerse,
    endChapter: raw.endChapter,
    endVerse: raw.endVerse,
  } as PassageRange;
  if (rangeError(range) !== null) return null;

  const trimmed = typeof label === 'string' ? label.trim() : '';
  const passage: FocusPassage = { id, ...range, createdAt };
  if (trimmed && deletedAt === undefined) passage.label = trimmed;
  if (updatedAt !== undefined) passage.updatedAt = updatedAt;
  if (deletedAt !== undefined) passage.deletedAt = deletedAt;
  return passage;
}

/** Every passage in `raw` that is one, in order. For reading storage, which a student can edit. */
export function parsePassages(raw: unknown): FocusPassage[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const passages: FocusPassage[] = [];
  for (const entry of raw) {
    const passage = parsePassage(entry);
    if (passage && !seen.has(passage.id)) {
      seen.add(passage.id);
      passages.push(passage);
    }
  }
  return passages;
}

/** All-or-nothing, for a request body: one bad passage rejects the list. Returns it parsed, or null. */
export function parsePassageList(raw: unknown): FocusPassage[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PASSAGES) return null;
  const passages: FocusPassage[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const passage = parsePassage(entry);
    if (!passage || seen.has(passage.id)) return null;
    seen.add(passage.id);
    passages.push(passage);
  }
  return passages;
}

/**
 * Per passage id: the latest change wins, whole. A rename on one device and a
 * rename on another do not combine. A passage edited *after* it was deleted
 * elsewhere comes back; one edited before does not. The rules, the symmetry and
 * the clock limit are `mergeTombstoned`'s, and are the same as decks'.
 */
export function mergeFocusPassages(
  a: FocusPassage[],
  b: FocusPassage[],
  now: Date = new Date(),
): FocusPassage[] {
  return mergeTombstoned(a, b, now);
}

// ─── Reading a range ─────────────────────────────────────────────────────────

/** `Genesis 1:1–3`, `Genesis 1:1–2:3` or `Genesis 1:1`. The dash is an en dash. */
export function formatPassageRef(bookName: string, range: PassageRange): string {
  const { startChapter: sc, startVerse: sv, endChapter: ec, endVerse: ev } = range;
  if (sc === ec && sv === ev) return `${bookName} ${sc}:${sv}`;
  if (sc === ec) return `${bookName} ${sc}:${sv}–${ev}`;
  return `${bookName} ${sc}:${sv}–${ec}:${ev}`;
}

/** What to call a passage: the student's name for it, else its reference. */
export function passageTitle(passage: FocusPassage, bookName: string): string {
  return passage.label ?? formatPassageRef(bookName, passage);
}

/** A book as both apps' corpus files have it: chapter, then verse, then whatever a verse holds. */
export type VerseBook<T> = Record<string, Record<string, T[]>>;

export interface PassageVerse<T> {
  chapter: number;
  verse: number;
  words: T[];
}

/**
 * The verses a range covers, in reading order. A verse the corpus does not have
 * is simply absent (a range can name a verse a different versification lacks);
 * nothing is invented to fill the gap.
 */
export function versesInRange<T>(book: VerseBook<T>, range: PassageRange): PassageVerse<T>[] {
  const out: PassageVerse<T>[] = [];
  const chapters = Object.keys(book)
    .map(Number)
    .filter((c) => c >= range.startChapter && c <= range.endChapter)
    .sort((a, b) => a - b);
  for (const chapter of chapters) {
    const verses = book[String(chapter)];
    const numbers = Object.keys(verses)
      .map(Number)
      .filter(
        (v) =>
          (chapter !== range.startChapter || v >= range.startVerse) &&
          (chapter !== range.endChapter || v <= range.endVerse),
      )
      .sort((a, b) => a - b);
    for (const verse of numbers) out.push({ chapter, verse, words: verses[String(verse)] });
  }
  return out;
}

/** The last verse number in each chapter of a book, so a picker never offers a verse that is not there. */
export function verseCounts<T>(book: VerseBook<T>): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const [chapter, verses] of Object.entries(book)) {
    counts[Number(chapter)] = Math.max(0, ...Object.keys(verses).map(Number));
  }
  return counts;
}

// ─── How well the words are known ────────────────────────────────────────────

/** 0 new or unseen, 1 learning, 2 familiar, 3 mature. By the card's interval in days. */
export type MaturityLevel = 0 | 1 | 2 | 3;

export function maturityLevel(interval: number): MaturityLevel {
  if (interval <= 0) return 0;
  if (interval <= 5) return 1;
  if (interval <= 20) return 2;
  return 3;
}

export interface MaturityBreakdown {
  mature: number;
  familiar: number;
  learning: number;
  unseen: number;
}

/**
 * Where a passage's words stand, from the SRS store. A word with no card, or a
 * card never passed, is unseen. Read from the store and never kept beside it:
 * a passage owns no progress (see the top of this file).
 */
export function maturityBreakdown(
  keys: readonly string[],
  store: Record<string, { interval: number }>,
): MaturityBreakdown {
  const result: MaturityBreakdown = { mature: 0, familiar: 0, learning: 0, unseen: 0 };
  for (const key of keys) {
    const card = store[key];
    const level = card ? maturityLevel(card.interval) : 0;
    if (level === 3) result.mature++;
    else if (level === 2) result.familiar++;
    else if (level === 1) result.learning++;
    else result.unseen++;
  }
  return result;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export interface FocusPassageStore {
  /** Every passage including tombstones: what sync reads and merges. */
  loadAll(): FocusPassage[];
  /** The live passages, oldest first: what the UI shows. */
  load(): FocusPassage[];
  /** The live passage with this id, or null: unknown, or deleted since the link was made. */
  get(id: string): FocusPassage | null;
  /** Replace what is stored. Throws when storage cannot be written. */
  saveAll(passages: FocusPassage[]): void;
  /** Throws when storage cannot be written, or the range is not one. */
  create(range: PassageRange, label?: string): FocusPassage;
  /** Rename. An empty label clears it. Returns the live passages. */
  rename(id: string, label: string): FocusPassage[];
  /** Tombstones the passage. Returns the live passages. */
  remove(id: string): FocusPassage[];
}

/**
 * Passage storage bound to one key, as every other store in this package is:
 * both apps run the feature, and neither may read the other's passages.
 *
 * `clock` and `newId` are injectable so a test does not depend on the time or
 * on `crypto`.
 */
export function createFocusPassageStore(
  storageKey: string,
  clock: () => Date = () => new Date(),
  newId: () => string = () => crypto.randomUUID(),
): FocusPassageStore {
  function loadAll(): FocusPassage[] {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? parsePassages(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  function saveAll(passages: FocusPassage[]): void {
    localStorage.setItem(storageKey, JSON.stringify(passages));
  }

  const live = (passages: FocusPassage[]) => passages.filter(isLive);

  function change(id: string, apply: (passage: FocusPassage, stamp: string) => FocusPassage) {
    const stamp = clock().toISOString();
    const passages = loadAll().map((p) => (p.id === id && isLive(p) ? apply(p, stamp) : p));
    saveAll(passages);
    return live(passages);
  }

  return {
    loadAll,
    load: () => live(loadAll()),
    get: (id) => live(loadAll()).find((p) => p.id === id) ?? null,
    saveAll,
    create(range, label) {
      const problem = rangeError(range);
      if (problem) throw new Error(problem);
      const stamp = clock().toISOString();
      const passage: FocusPassage = {
        id: newId(),
        book: range.book,
        startChapter: range.startChapter,
        startVerse: range.startVerse,
        endChapter: range.endChapter,
        endVerse: range.endVerse,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const name = label?.trim().slice(0, MAX_PASSAGE_LABEL);
      if (name) passage.label = name;
      saveAll([...loadAll(), passage]);
      return passage;
    },
    rename: (id, label) =>
      change(id, (passage, stamp) => {
        const { label: _previous, ...rest } = passage;
        const name = label.trim().slice(0, MAX_PASSAGE_LABEL);
        return { ...rest, ...(name ? { label: name } : {}), updatedAt: stamp };
      }),
    remove: (id) =>
      change(id, (passage, stamp) => {
        const { label: _previous, ...rest } = passage;
        return { ...rest, updatedAt: stamp, deletedAt: stamp };
      }),
  };
}
