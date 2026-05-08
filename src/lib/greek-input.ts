/**
 * Shared Greek keyboard input utilities.
 *
 * Used by GreekKeyboard (standalone input tool) and ParadigmQuiz (cell inputs).
 * Implements a Beta Code–style mapping: English keys produce Greek characters.
 */

// ---------------------------------------------------------------------------
// Key mappings
// ---------------------------------------------------------------------------

/** Beta Code–style mapping from ASCII key to Greek letter. */
export const GREEK_MAP: Record<string, string> = {
  a: 'α',
  b: 'β',
  g: 'γ',
  d: 'δ',
  e: 'ε',
  z: 'ζ',
  h: 'η',
  q: 'θ',
  i: 'ι',
  k: 'κ',
  l: 'λ',
  m: 'μ',
  n: 'ν',
  c: 'ξ',
  o: 'ο',
  p: 'π',
  r: 'ρ',
  s: 'σ',
  w: 'ω',
  t: 'τ',
  u: 'υ',
  f: 'φ',
  x: 'χ',
  y: 'ψ',
  // Uppercase
  A: 'Α',
  B: 'Β',
  G: 'Γ',
  D: 'Δ',
  E: 'Ε',
  Z: 'Ζ',
  H: 'Η',
  Q: 'Θ',
  I: 'Ι',
  K: 'Κ',
  L: 'Λ',
  M: 'Μ',
  N: 'Ν',
  C: 'Ξ',
  O: 'Ο',
  P: 'Π',
  R: 'Ρ',
  S: 'Σ',
  W: 'Ω',
  T: 'Τ',
  U: 'Υ',
  F: 'Φ',
  X: 'Χ',
  Y: 'Ψ',
};

/** Mapping from ASCII symbol key to Greek combining diacritical character. */
export const DIACRITIC_MAP: Record<string, string> = {
  ')': '\u0313', // smooth breathing  ̓
  '(': '\u0314', // rough breathing   ̔
  '/': '\u0301', // acute accent      ́
  '\\': '\u0300', // grave accent      ̀
  '=': '\u0342', // circumflex        ͂
  '|': '\u0345', // iota subscript    ͅ
};

// ---------------------------------------------------------------------------
// Text transforms
// ---------------------------------------------------------------------------

/**
 * Convert word-final σ to the final-sigma variant ς.
 * Applied before display; the raw state may still contain σ.
 */
export function applyFinalSigma(text: string): string {
  return text.replace(/σ(?=[\s.,;·!?\-—""''"\n\r]|$)/g, 'ς');
}

// ---------------------------------------------------------------------------
// Answer comparison
// ---------------------------------------------------------------------------

/**
 * Normalize an answer string for comparison:
 * - Strip the optional movable-nu notation `(ν)` and trim.
 * - Apply Unicode NFC normalization.
 */
export function normalizeAnswer(s: string): string {
  return s.replace(/\(ν\)/g, '').trim().normalize('NFC');
}

/**
 * Strip all combining diacritical marks (breathings, accents, iota subscript)
 * so we can compare base consonants/vowels independently from their accents.
 */
export function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

export type AnswerResult = 'correct' | 'accent-only' | 'wrong';

/**
 * Generate all acceptable normalized forms for a correct answer,
 * handling moveable nu (ν) notation.
 *
 * For "λύουσι(ν)" → ["λύουσι", "λύουσιν"]
 * For "λύω" (no moveable nu) → ["λύω"]
 */
export function getAcceptableVariants(correctAnswer: string): string[] {
  const withoutNu = correctAnswer.replace(/\(ν\)/g, '').trim().normalize('NFC');
  const variants = [withoutNu];
  if (correctAnswer.includes('(ν)')) {
    const withNu = correctAnswer.replace(/\(ν\)/g, 'ν').trim().normalize('NFC');
    variants.push(withNu);
  }
  return variants;
}

/**
 * Normalize user input for comparison:
 * - Treat typed `(ν)` as `ν`
 * - Strip stray parentheses
 * - Apply final sigma conversion
 * - Trim and NFC normalize
 */
export function normalizeUserInput(userInput: string): string {
  return applyFinalSigma(userInput.replace(/\(ν\)/g, 'ν').replace(/[()]/g, '').trim()).normalize(
    'NFC',
  );
}

/**
 * Grade a user's input against the correct answer for a paradigm cell.
 *
 * - 'correct'      — exact match (after normalizing movable nu and NFC)
 * - 'accent-only'  — consonants/vowels match but accentuation is wrong
 * - 'wrong'        — substantively different form
 *
 * Final sigma is applied to the user input before comparison.
 * Moveable nu is always tolerated: forms with `(ν)` accept both the
 * short form and the ν-included form at every comparison level.
 */
export function checkAnswer(userInput: string, correctAnswer: string): AnswerResult {
  const user = normalizeUserInput(userInput);
  const variants = getAcceptableVariants(correctAnswer);

  if (variants.some((v) => user === v)) return 'correct';

  const userStripped = stripDiacritics(user);
  if (variants.some((v) => userStripped === stripDiacritics(v))) return 'accent-only';

  return 'wrong';
}

// ---------------------------------------------------------------------------
// Keyboard event handler
// ---------------------------------------------------------------------------

/**
 * Process a `keydown` event on a Greek input element.
 *
 * @param key          The `event.key` value.
 * @param ctrlOrMeta   Whether Ctrl or Meta (Cmd) is held — skip Greek mapping.
 * @returns An object describing what to do:
 *   - `preventDefault`: true if the event should be suppressed.
 *   - `append`: a string to append to raw state, or null if no action.
 */
export function processGreekKey(
  key: string,
  ctrlOrMeta: boolean,
): { preventDefault: boolean; append: string | null } {
  if (ctrlOrMeta) return { preventDefault: false, append: null };

  const diacritic = DIACRITIC_MAP[key];
  if (diacritic) return { preventDefault: true, append: diacritic };

  const greek = GREEK_MAP[key];
  if (greek) return { preventDefault: true, append: greek };

  if (key === ':') return { preventDefault: true, append: '·' };
  if (key === '?') return { preventDefault: true, append: ';' };

  return { preventDefault: false, append: null };
}

/**
 * Process an `InputEvent.data` value from a `beforeinput` event.
 *
 * Android soft keyboards fire `keydown` with `event.key === "Unidentified"`,
 * making `processGreekKey` a no-op. The `beforeinput` event's `data` property
 * contains the actual character on all platforms, including Android.
 *
 * @param data  The `InputEvent.data` string (a single character).
 * @returns The same shape as `processGreekKey`.
 */
export function processGreekInput(data: string): {
  preventDefault: boolean;
  append: string | null;
} {
  return processGreekKey(data, false);
}

/**
 * Translate a string character by character through the Beta Code mapping.
 *
 * Each character is looked up in `GREEK_MAP`, `DIACRITIC_MAP`, and the
 * special-punctuation rules. Characters that have no mapping (spaces, Greek
 * letters already in Unicode, digits, …) are passed through unchanged.
 *
 * This handles two Android-specific edge cases:
 *
 * 1. **IME word commit** — some Android keyboards buffer a whole word during
 *    composition and fire a single `beforeinput` event with `data="logos"`.
 *    `processGreekInput` only handles single characters, so "logos" falls
 *    through and lands in the `onChange` fallback as raw Latin text.
 *
 * 2. **onChange fallback** — even when `beforeinput.preventDefault()` is
 *    called for each letter, pressing space causes the IME to commit the
 *    buffered Latin word into the DOM, triggering `onChange` with the raw
 *    Latin value.  Running the new value through `translateGreekInput` before
 *    storing it ensures the Greek state is preserved.
 *
 * @param text  Any string — single char, whole word, or full textarea value.
 * @returns     The string with every translatable character mapped to Greek.
 */
export function translateGreekInput(text: string): string {
  return [...text]
    .map((ch) => {
      const result = processGreekKey(ch, false);
      return result.append ?? ch;
    })
    .join('');
}
