// The gloss as a prompt: what can be shown when the Hebrew is the answer.
//
// Used by /write's word mode and by the flashcards' English → Hebrew
// direction (#74). It lives apart from `writing-words.ts` so the flashcards do
// not pull the ink engine in for one function.

/** Any character in the Hebrew block, including its points. */
const HEBREW = /[֐-׿יִ-ﭏ]/;

/**
 * A parenthetical aside at the end of a gloss.
 *
 * Garrett & DeRouchie annotate a fair number of entries inline — חָפֵץ reads
 * "desire, enjoy, want (the qatal 3ms is חָפֵץ but other forms are normal…)".
 * That note is useful on a flashcard back and fatal as a writing prompt,
 * because it prints the answer.
 */
const ASIDE = /\s*\([^()]*\)\s*$/;

/**
 * The gloss, reduced to something that can be asked without giving the word away.
 *
 * Returns null when it cannot be. A writing prompt is a different contract from
 * a flashcard back: the flashcard shows the Hebrew *and* the gloss together, so
 * a note quoting the form costs nothing, while here the student is being asked
 * to produce exactly that form.
 *
 * Trimming the aside recovers most of them. Where Hebrew survives the trim the
 * word is dropped rather than shown with the answer blanked out — a gloss with
 * a hole in it is a worse prompt than one fewer word, and the vocabulary is not
 * short of words.
 */
export function glossPrompt(gloss: string | undefined): string | null {
  if (!gloss) return null;
  const trimmed = (HEBREW.test(gloss) ? gloss.replace(ASIDE, '') : gloss).trim();
  if (trimmed.length === 0 || HEBREW.test(trimmed)) return null;
  return trimmed;
}
