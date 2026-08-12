/**
 * Hebrew keyboard input utilities.
 *
 * Implements an SBL-style phonetic mapping: English keys produce Biblical Hebrew
 * characters. Used by HebrewKeyboard and (eventually) ParadigmQuiz cell inputs.
 *
 * Architecture mirrors greek-input.ts, with these Hebrew-specific additions:
 *   - Nikud (vowel points) are Unicode combining marks typed after the consonant
 *   - Final letter forms (כ→ך etc.) applied as a display transform
 *   - Hateph vowels (:a, :e, :A) handled via a two-step sequence at the component level
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** U+05BC — dagesh (dot inside a consonant, also used for mapiq in ה) */
export const DAGESH = 'ּ';

/** U+05B0 — sheva (the half-vowel marker) */
export const SHEVA = 'ְ';

// ---------------------------------------------------------------------------
// Key mappings
// ---------------------------------------------------------------------------

/**
 * SBL-style mapping from ASCII key to Hebrew consonant (Unicode code point).
 *
 * Key design decisions:
 *   - Vowel letters (a, e, i, o, u, A, E, O, U) are reserved for nikud — no consonant uses them
 *   - Alef (') and ayin (`) use non-alpha keys to keep phonetically natural
 *   - Shin and sin both use the base shin letter (U+05E9) with their respective dots baked in
 *   - Lowercase t = tet (guttural ט); uppercase T = tav (ת)
 *   - Lowercase s = samek (ס); uppercase S = shin with shin dot (שׁ); $ = shin with sin dot (שׂ)
 */
export const CONSONANT_MAP: Record<string, string> = {
  "'": 'א',             // א alef
  b:   'ב',             // ב bet
  g:   'ג',             // ג gimel
  d:   'ד',             // ד dalet
  h:   'ה',             // ה he
  w:   'ו',             // ו vav
  v:   'ו',             // ו vav (alternate)
  z:   'ז',             // ז zayin
  c:   'ח',             // ח het
  t:   'ט',             // ט tet
  y:   'י',             // י yod
  k:   'כ',             // כ kaf
  l:   'ל',             // ל lamed
  m:   'מ',             // מ mem
  n:   'נ',             // נ nun
  s:   'ס',             // ס samek
  '`': 'ע',             // ע ayin
  p:   'פ',             // פ pe
  x:   'צ',             // צ tsade
  q:   'ק',             // ק qof
  r:   'ר',             // ר resh
  S:   'שׁ',       // שׁ shin (shin letter + shin dot U+05C1)
  '#': 'שׁ',       // שׁ shin (alternate key)
  '$': 'שׂ',       // שׂ sin  (shin letter + sin dot U+05C2)
  T:   'ת',             // ת tav
};

/**
 * Nikud (vowel point) mapping — single combining marks that attach to the
 * preceding consonant. Type after the consonant to add the vowel.
 *
 * Hateph vowels (:a, :e, :A) are multi-key sequences handled at the component
 * level; they are NOT in this map.
 */
export const NIKUD_MAP: Record<string, string> = {
  a: 'ַ',  // פַ patah
  A: 'ָ',  // פָ qamets (gadol)
  e: 'ֶ',  // פֶ segol
  E: 'ֵ',  // פֵ tsere
  i: 'ִ',  // פִ hireq
  o: 'ֹ',  // פֹ holem (simple dot — does not include waw)
  u: 'ֻ',  // פֻ qibbuts
};

/**
 * Compound nikud — characters that require inserting a waw letter plus a mark.
 *
 * O = holem waw:  ו + holem dot (the vowel sound ō spelled with a waw)
 * U = shureq:     ו + dagesh   (the vowel sound ū spelled with a waw)
 *
 * These insert a full vav character so that the waw itself appears in the text.
 */
export const COMPOUND_NIKUD_MAP: Record<string, string> = {
  O: 'וֹ',  // וֹ holem waw
  U: 'וּ',  // וּ shureq
};

/**
 * Hateph (reduced) vowels — follow a sheva (`:`) to produce composite marks.
 * The component detects a pending sheva and replaces it with the hateph when
 * one of these keys is pressed immediately after.
 */
export const HATEPH_MAP: Record<string, string> = {
  a: 'ֲ',  // פֲ hateph patah
  e: 'ֱ',  // פֱ hateph segol
  A: 'ֳ',  // פֳ hateph qamets
};

// ---------------------------------------------------------------------------
// Final letter forms
// ---------------------------------------------------------------------------

/**
 * Hebrew letters that have distinct final forms when they appear at the end of
 * a word. Maps the standard (non-final) form to the final form.
 */
export const FINAL_FORM_MAP: Record<string, string> = {
  'כ': 'ך',  // כ → ך  kaf → final kaf
  'מ': 'ם',  // מ → ם  mem → final mem
  'נ': 'ן',  // נ → ן  nun → final nun
  'פ': 'ף',  // פ → ף  pe  → final pe
  'צ': 'ץ',  // צ → ץ  tsade → final tsade
};

/**
 * Nikud range used when scanning past combining marks to find the last
 * consonant before a word boundary.
 * Includes: nikud (U+05B0–U+05C7), shin/sin dots (U+05C1–U+05C2), dagesh (U+05BC).
 */
const COMBINING_MARK_RE = /[ְ-ׇ֑-֯]/;

/**
 * Convert word-final non-final forms to their final forms.
 * Applied before display; raw state stores non-final consonants throughout.
 *
 * A "word boundary" is: the consonant (possibly followed by combining marks)
 * is either at the end of the string or followed by whitespace.
 */
export function applyFinalForms(text: string): string {
  // Build result character by character using code points (handles surrogates
  // correctly, though Hebrew BMP characters don't need this — good practice).
  const codePoints = [...text];
  const result: string[] = [];

  for (let i = 0; i < codePoints.length; i++) {
    const ch = codePoints[i];
    const finalForm = FINAL_FORM_MAP[ch];

    if (finalForm) {
      // Look ahead past any combining marks to determine if this is word-final
      let j = i + 1;
      while (j < codePoints.length && COMBINING_MARK_RE.test(codePoints[j])) j++;
      const isWordFinal = j >= codePoints.length || /\s/.test(codePoints[j]);
      result.push(isWordFinal ? finalForm : ch);
    } else {
      result.push(ch);
    }
  }

  return result.join('');
}

// ---------------------------------------------------------------------------
// Answer comparison utilities
// ---------------------------------------------------------------------------

/**
 * Strip nikud (vowel points, U+05B0–U+05C7) and shin/sin dots from a Hebrew
 * string, leaving only consonants and cantillation. Used for lenient grading.
 */
export function stripNikud(s: string): string {
  return s.replace(/[ְ-ׇ]/g, '');
}

/**
 * Strip all diacritics — both nikud and cantillation marks (te'amim) — leaving
 * bare consonants. Used for maximally lenient comparison.
 */
export function stripAllDiacritics(s: string): string {
  return s.replace(/[֑-ׇ]/g, '');
}

/**
 * Strip cantillation marks (te'amim) while keeping the vowel points — the
 * complement of `stripNikud`.
 *
 * This is what the WLC text needs: beginners read pointed Hebrew without the
 * accents, and the lexicon prints a few headwords with a stray accent on them
 * (`אַבְדָ֑ן`) that has no business in a lexical form.
 *
 * The set is U+0591–U+05AF plus the strays outside that block: U+05BD meteg,
 * U+05BF rafe, U+05C0 paseq, U+05C3 sof pasuq, U+05C6 nun hafukha. Written as
 * escapes because a character class of bare combining marks is unreadable — and
 * unreviewable — in source. Maqqef (U+05BE) is punctuation that joins words, not
 * an accent, so it stays.
 */
const CANTILLATION = /[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C3\u05C6]/g;

export function stripCantillation(s: string): string {
  return s.replace(CANTILLATION, '');
}

export type AnswerResult = 'correct' | 'nikud-only' | 'wrong';

/**
 * Grade a user's input against a correct Hebrew paradigm cell answer.
 *
 *   'correct'    — exact Unicode match after NFC normalization
 *   'nikud-only' — consonants match but vowel pointing differs (like 'accent-only' in Greek)
 *   'wrong'      — consonant mismatch
 */
export function checkHebrewAnswer(userInput: string, correctAnswer: string): AnswerResult {
  const user = userInput.trim().normalize('NFC');
  const correct = correctAnswer.trim().normalize('NFC');

  if (user === correct) return 'correct';
  if (stripNikud(user) === stripNikud(correct)) return 'nikud-only';
  return 'wrong';
}

// ---------------------------------------------------------------------------
// Keyboard event handler
// ---------------------------------------------------------------------------

/**
 * Process a `keydown` event on a Hebrew input element.
 *
 * @param key          The `event.key` value.
 * @param ctrlOrMeta   Whether Ctrl or Meta (Cmd) is held — skip Hebrew mapping.
 * @returns An object describing what to do:
 *   - `preventDefault`: true if the event should be suppressed.
 *   - `append`: a string to append to raw state, or null if no action.
 *
 * Note: hateph vowel sequences (:a, :e, :A) are handled at the component level
 * because they require replacing the preceding sheva character. This function
 * returns SHEVA for `:` and the component applies the hateph substitution.
 */
export function processHebrewKey(
  key: string,
  ctrlOrMeta: boolean,
): { preventDefault: boolean; append: string | null } {
  if (ctrlOrMeta) return { preventDefault: false, append: null };

  const consonant = CONSONANT_MAP[key];
  if (consonant !== undefined) return { preventDefault: true, append: consonant };

  const nikud = NIKUD_MAP[key];
  if (nikud !== undefined) return { preventDefault: true, append: nikud };

  const compound = COMPOUND_NIKUD_MAP[key];
  if (compound !== undefined) return { preventDefault: true, append: compound };

  if (key === '.' || key === '*') return { preventDefault: true, append: DAGESH };

  // Sheva; hateph continuation is handled by the component
  if (key === ':') return { preventDefault: true, append: SHEVA };

  return { preventDefault: false, append: null };
}

/**
 * Process an `InputEvent.data` value from a `beforeinput` event.
 * Android soft keyboards fire `keydown` with `event.key === "Unidentified"`;
 * this provides the same mapping via the `data` property instead.
 */
export function processHebrewInput(data: string): {
  preventDefault: boolean;
  append: string | null;
} {
  return processHebrewKey(data, false);
}

/**
 * Translate a string character-by-character through the Hebrew key mapping.
 *
 * Used for two Android edge cases:
 *   1. IME word commit — a whole Latin word arrives in one `beforeinput` event
 *   2. onChange fallback — the IME commits a Latin word into the DOM value
 *
 * Characters with no mapping (already Hebrew, spaces, digits) pass through.
 */
export function translateHebrewInput(text: string): string {
  return [...text]
    .map((ch) => {
      const result = processHebrewKey(ch, false);
      return result.append ?? ch;
    })
    .join('');
}
