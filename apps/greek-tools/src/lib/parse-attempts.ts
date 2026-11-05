// Parse history as attempts (#209).
//
// greek.tools has kept parse history as one `{ correct, total }` pair per
// focus passage (`greek-tools-focus-parse-v1`, synced in /api/progress). The
// shared attempt log (`@tools/shared/attempt-log`) is one entry per answer.
// A student's existing totals cannot be turned back into real answers, but they
// must read as attempts without loss, so each total is expanded into synthetic
// attempts.
//
// Rules:
// - Nothing is written. The aggregate store stays the synced source of truth;
//   this is a read-side view, so it cannot change what a returning student has.
// - Synthetic attempts have `at: 0` (time unknown) and stable ids
//   `legacy-parse-<passageId>-<n>`, so every read yields the same ones.
// - Answers already in the log are not counted twice: a passage's totals are
//   split into what the log holds and the remainder, which is synthesized.
//   If the log holds more than the totals (the totals came from a merge that
//   took another device's smaller figure), the remainder is zero, never negative.
// - Which of the remainder were correct is unknowable; correct ones come first.
//   The totals — the only thing the aggregate ever recorded — are exact.

import type { Attempt } from '@tools/shared/attempt-log';
import type { ParseHistory } from '../data/focusPassages';

const PARSE_CONCEPT_PREFIX = 'parse/passage/';

/** The concept id for answers parsed within one focus passage. Stable: do not rename. */
export function parseConcept(passageId: string): string {
  return `${PARSE_CONCEPT_PREFIX}${passageId}`;
}

/** The passage a parse concept belongs to, or null for any other concept. */
export function passageIdOfConcept(concept: string): string | null {
  return concept.startsWith(PARSE_CONCEPT_PREFIX)
    ? concept.slice(PARSE_CONCEPT_PREFIX.length)
    : null;
}

/**
 * Every parse answer a student has, as attempts: the logged ones, then
 * synthetic ones for whatever the aggregate totals hold beyond the log.
 */
export function parseHistoryAsAttempts(
  store: Record<string, ParseHistory>,
  log: readonly Attempt[],
): Attempt[] {
  const logged = log.filter((a) => passageIdOfConcept(a.concept) !== null);
  const out: Attempt[] = [...logged];

  for (const [passageId, entry] of Object.entries(store)) {
    const concept = parseConcept(passageId);
    const mine = logged.filter((a) => a.concept === concept);
    const loggedCorrect = mine.filter((a) => a.correct).length;
    const remainder = Math.max(0, entry.total - mine.length);
    const remainderCorrect = Math.min(remainder, Math.max(0, entry.correct - loggedCorrect));
    for (let i = 0; i < remainder; i++) {
      out.push({
        id: `legacy-parse-${passageId}-${i}`,
        concept,
        correct: i < remainderCorrect,
        at: 0,
      });
    }
  }
  return out;
}
