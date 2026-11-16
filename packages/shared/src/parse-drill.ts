// The parts of a parsing drill that do not depend on the language (#82).
//
// greek.tools' `/parse` asks for tense, voice, mood, person and number;
// hebrew.tools' asks for stem, conjugation, person, gender, number, state and
// root. What a field is, and how a form is graded, stay in each app. What is
// the same is how a session is scored once each answer has been graded field by
// field, and that lives here, with the React pieces in
// `components/ParseDrill.tsx`.
//
// One rule that is pedagogy rather than plumbing:
//
// - **A field that was not asked is absent, not correct.** An infinitive has no
//   person, so its result carries no `person` key. Accuracy for a field is
//   counted over the forms that asked it. greek.tools' passage parser folds
//   "not asked" into "right" in its own adapter (`r.person ?? true`) before it
//   gets here; that is unchanged.

/** One field of a parse, as the results screen names it. */
export interface ParseProperty<K extends string = string> {
  key: K;
  label: string;
}

/**
 * One graded form: the overall verdict, and beside it a boolean per field that
 * was asked, under the field's key. A key that is absent (or `undefined`) was
 * not asked of that form. Not an index signature, so an app's own result
 * interface (`{ tense: boolean; … }`) passes as one.
 */
export interface ParseFieldResults {
  allCorrect: boolean;
}

/** A result's flag for one field: `undefined` when the field was not asked. */
export function fieldFlag(result: ParseFieldResults, key: string): boolean | undefined {
  return (result as unknown as Record<string, boolean | undefined>)[key];
}

/** A session's answers, and how many forms it had. */
export interface SessionResults<R extends ParseFieldResults = ParseFieldResults> {
  results: R[];
  total: number;
}

export interface PropertyAccuracy {
  key: string;
  label: string;
  /** Forms that got this field right. */
  correct: number;
  /** Forms that asked this field. */
  asked: number;
  /** Whole percent of `asked`; 0 when nothing asked it. */
  pct: number;
}

/** Whole percent, 0 for an empty denominator. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** How well each field went, over the forms that asked it. */
export function propertyAccuracy(
  results: readonly ParseFieldResults[],
  properties: readonly ParseProperty[],
): PropertyAccuracy[] {
  return properties.map(({ key, label }) => {
    const asked = results.filter((r) => fieldFlag(r, key) !== undefined);
    const correct = asked.filter((r) => fieldFlag(r, key) === true).length;
    return { key, label, correct, asked: asked.length, pct: percent(correct, asked.length) };
  });
}

/** The colour a score is drawn in: green from 80%, amber from 60%, else red. */
export function scoreColor(pct: number): string {
  if (pct >= 80) return '#16a34a';
  if (pct >= 60) return '#d97706';
  return '#dc2626';
}

/** How many forms a session asks. Both apps offer the same three. */
export const SESSION_LENGTHS = [10, 20, 30] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

export function isSessionLength(value: unknown): value is SessionLength {
  return SESSION_LENGTHS.includes(value as SessionLength);
}

/** `list` with `value` added, or removed if it was there. Order is kept. */
export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}
