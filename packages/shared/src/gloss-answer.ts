/**
 * Marking a typed English gloss against a vocabulary entry's gloss.
 *
 * Both apps' flashcards ask for a gloss in their "type" answer mode, and a
 * gloss is English whichever language the card is in, so the marking is one
 * rule. It began in greek-tools' `Flashcards.tsx` and moved here unchanged
 * when hebrew.tools gained typed answers (#74).
 *
 * It is lenient on purpose. A gloss lists several senses ("word, thing") and
 * the student types one; a slip of one letter is a typo, not a miss. The mark
 * never answers the card either way (see "Drill modes answer Missed / Got it"
 * in the root CLAUDE.md), so leniency here costs nothing.
 */

/** Edit distance between two strings: insertions, deletions, substitutions. */
export function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i - 1], dp[i]);
      prev = tmp;
    }
  }
  return dp[a.length];
}

export interface GlossAnswerOptions {
  /** What divides a gloss into senses. Defaults to a comma or a slash. */
  separators?: RegExp;
  /**
   * Other wordings of one sense that also count, for a vocabulary whose
   * glosses carry more than the bare word: a parse note, a subject pronoun.
   * The sense as written always counts; these are in addition to it.
   */
  variants?: (sense: string) => string[];
}

const DEFAULT_SEPARATORS = /[,/]/;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[()]/g, '').trim();
}

/**
 * Whether `input` names one of the senses of `gloss`.
 *
 * A sense matches when it is typed exactly, when at least four letters of its
 * start are typed, or when the answer is one edit away from a sense longer
 * than three letters. Case and parentheses are ignored. An empty answer never
 * matches.
 */
export function checkGlossAnswer(
  input: string,
  gloss: string,
  options: GlossAnswerOptions = {},
): boolean {
  const answer = normalize(input);
  if (!answer) return false;
  const senses = gloss.split(options.separators ?? DEFAULT_SEPARATORS);
  const candidates = senses
    .flatMap((sense) => [sense, ...(options.variants?.(sense) ?? [])])
    .map(normalize)
    .filter(Boolean);
  return candidates.some(
    (sense) =>
      sense === answer ||
      (answer.length >= 4 && sense.startsWith(answer)) ||
      (sense.length > 3 && levenshtein(sense, answer) <= 1),
  );
}
