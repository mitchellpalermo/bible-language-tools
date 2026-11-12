// Deletion by tombstone, for any synced list of things with an id.
//
// A sync merge is a union, so a row missing from one side reads as "not seen
// yet", never "removed", and a plain delete comes back from the next device to
// push. Deleting therefore keeps the row with `deletedAt` set, and the merge
// treats that as the newest edit. Custom decks (#225) and focus passages (#226)
// share these rules, so they live here once: the rules are the thing that must
// not drift between two lists, and the symmetry of the merge is easy to break.
//
// The per-kind parts — what else a row holds, how it is parsed — stay with the
// kind (`custom-decks.ts`, `focus-passages.ts`).

/**
 * How long a tombstone is kept. Past this a device that was offline the whole
 * time and still holds the row can bring it back, which is cheaper than
 * keeping every deleted row forever.
 */
export const TOMBSTONE_TTL_DAYS = 180;

export interface Tombstonable {
  /** Never reused, so a tombstone cannot hide a new row. */
  id: string;
  /** ISO timestamp. */
  createdAt: string;
  /**
   * ISO timestamp of the last create, edit or delete, which is what the merge
   * compares. Absent on a row written before sync, where `createdAt` stands in.
   */
  updatedAt?: string;
  /** Set when the row was deleted. The row is then a tombstone, not an item. */
  deletedAt?: string;
}

export function isLive(item: Tombstonable): boolean {
  return item.deletedAt === undefined;
}

/** The moment this row was last changed. */
export function stampOf(item: Tombstonable): string {
  return item.updatedAt || item.createdAt;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isIso(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/** Positive when `a` is the later change. A total order, so the merge is symmetric. */
function compareChanges(a: Tombstonable, b: Tombstonable): number {
  const byTime = stampOf(a).localeCompare(stampOf(b));
  if (byTime !== 0) return byTime;
  // The same moment: a deletion beats an edit, so a stale device cannot undo it.
  const byDeletion = Number(!isLive(a)) - Number(!isLive(b));
  if (byDeletion !== 0) return byDeletion;
  // Still tied (two devices, one clock tick): any fixed order will do.
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

/** Tombstones older than the TTL are dropped. */
export function pruneTombstones<T extends Tombstonable>(items: T[], now: Date = new Date()): T[] {
  const cutoff = new Date(now.getTime() - TOMBSTONE_TTL_DAYS * 86_400_000).toISOString();
  return items.filter((d) => isLive(d) || (d.deletedAt as string) >= cutoff);
}

/**
 * Per id: the latest change wins, whole. An edit on one device and a rename on
 * another do not combine; the later one stands. A deletion is a change like any
 * other, so a row edited *after* it was deleted elsewhere comes back, and one
 * edited before does not.
 *
 * Symmetric — `compareChanges` is a total order — and the result is sorted by
 * creation, so both sides of a sync end up with the same list in the same
 * order. Tombstones past `TOMBSTONE_TTL_DAYS` are dropped.
 *
 * KNOWN LIMIT: the comparison is between two devices' clocks. A clock that is
 * badly wrong can make a stale edit win. The failure is one row holding an
 * older value, never a lost review, and the next edit corrects it.
 */
export function mergeTombstoned<T extends Tombstonable>(
  a: T[],
  b: T[],
  now: Date = new Date(),
): T[] {
  const byId = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const held = byId.get(item.id);
    if (!held || compareChanges(item, held) > 0) byId.set(item.id, item);
  }
  return pruneTombstones([...byId.values()], now).sort(
    (x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id),
  );
}
