// Merge rules shared by both apps' cross-device sync. Pure functions.
//
// Every rule here must be symmetric: merge(a, b) and merge(b, a) pick the same
// winners. Both sides of a sync run the same merge, so an asymmetric rule would
// let two devices ping-pong different answers. Cards resolve on "most recent
// review wins"; the lifetime stats counters take the max. Never lose a review —
// including a failed one.

import type { SRSCard, StudyStats } from './srs';

/**
 * Per word key: the card reviewed most recently wins.
 *
 * This used to be "the higher repetition wins", which silently discarded every
 * failed review. nextSRS resets `repetition` to 0 on a lapse (quality < 3), so
 * a lapsed card could never beat an earlier state of itself: fail a mature card
 * on one device, sync, and it came back with its old interval, its old ease
 * factor and its full repetition count. The reset, the ease penalty and the
 * reschedule were all thrown away.
 *
 * That was unreachable from the client, too — each app's putProgress runs this
 * same merge server-side, so there was no path by which a lapse could reach the
 * database. A word you kept failing kept coming back as mature and would not
 * resurface for months.
 *
 * `lastReviewed` is the only field that says when a decision was made, so it is
 * the comparator. A card that has never been reviewed carries '', which sorts
 * below every real date — a freshly-created card cannot displace real progress.
 *
 * KNOWN LIMIT: `lastReviewed` is a calendar date, not a timestamp. Two devices
 * that review the same card on the same day are genuinely indistinguishable
 * here, and fall back to the old repetition/dueDate rule. Storing a timestamp
 * would resolve it, but changes the card shape and every stored card with it;
 * the same-day case is rare and self-correcting on the next review.
 *
 * Still symmetric — the ordering is total, so merge(a, b) and merge(b, a) pick
 * the same winner.
 */
export function mergeSRSStores(
  a: Record<string, SRSCard>,
  b: Record<string, SRSCard>,
): Record<string, SRSCard> {
  const merged: Record<string, SRSCard> = { ...a };
  for (const [key, card] of Object.entries(b)) {
    const existing = merged[key];
    if (!existing) {
      merged[key] = card;
      continue;
    }
    if (cardWins(card, existing)) merged[key] = card;
  }
  return merged;
}

/** Does `card` beat `existing`? Recency first, then the legacy tiebreaks. */
function cardWins(card: SRSCard, existing: SRSCard): boolean {
  if (card.lastReviewed !== existing.lastReviewed) {
    return card.lastReviewed > existing.lastReviewed;
  }
  if (card.repetition !== existing.repetition) return card.repetition > existing.repetition;
  return card.dueDate > existing.dueDate;
}

/**
 * The streak and the date it was last earned move together, decided by the
 * later anchor date — never by the streak number alone. Two decayed streaks
 * both read 0, and the old `b.streak > a.streak ? b : a` fell through to `a`
 * (always the local device) on that tie, so signing in on a fresh browser
 * merged the server's real anchor away and restarted the streak from scratch.
 * Empty string sorts before any real date, so a known anchor always wins.
 */
function pickStreak(a: StudyStats, b: StudyStats): StudyStats {
  if (a.lastStreakDate !== b.lastStreakDate) {
    return b.lastStreakDate > a.lastStreakDate ? b : a;
  }
  return b.streak > a.streak ? b : a;
}

/**
 * Today's card counter travels with the day it belongs to, decided by the later
 * lastStudyDate. Choosing by totalReviewed instead let a stale count from an
 * older session ride in as if it were today's.
 */
function pickDaily(a: StudyStats, b: StudyStats): StudyStats {
  if (a.lastStudyDate !== b.lastStudyDate) {
    return b.lastStudyDate > a.lastStudyDate ? b : a;
  }
  return b.cardsStudiedToday > a.cardsStudiedToday ? b : a;
}

/** Lifetime counters take the max of both stores; paired fields stay paired. */
export function mergeStudyStats(a: StudyStats, b: StudyStats): StudyStats {
  const streakier = pickStreak(a, b);
  const daily = pickDaily(a, b);
  return {
    streak: streakier.streak,
    lastStreakDate: streakier.lastStreakDate,
    cardsStudiedToday: daily.cardsStudiedToday,
    lastStudyDate: daily.lastStudyDate,
    totalReviewed: Math.max(a.totalReviewed, b.totalReviewed),
    totalCorrect: Math.max(a.totalCorrect, b.totalCorrect),
  };
}
