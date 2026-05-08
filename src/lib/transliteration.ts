/**
 * SBL (Society of Biblical Literature) Greek transliteration.
 * Converts polytonic Greek ↔ romanized SBL transliteration.
 *
 * SBL scheme highlights:
 *   η → ē, ω → ō, υ → y
 *   θ → th, φ → ph, χ → ch, ψ → ps
 *   γγ → ng, γκ → nk, γξ → nx, γχ → nch
 *   rough breathing → h (prefixed to vowel)
 *   iota subscript: ᾳ → ai, ῃ → ēi, ῳ → ōi
 */

// ---------------------------------------------------------------------------
// Greek → Transliteration
// ---------------------------------------------------------------------------

/**
 * Full map: precomposed Greek character → SBL roman string.
 * Longer sequences (γγ etc.) are handled separately before this lookup.
 */
const GREEK_TO_TRANSLIT: Record<string, string> = {
  // === Basic Greek letters ===
  α: 'a',
  β: 'b',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'ē',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'ph',
  χ: 'ch',
  ψ: 'ps',
  ω: 'ō',
  Α: 'A',
  Β: 'B',
  Γ: 'G',
  Δ: 'D',
  Ε: 'E',
  Ζ: 'Z',
  Η: 'Ē',
  Θ: 'Th',
  Ι: 'I',
  Κ: 'K',
  Λ: 'L',
  Μ: 'M',
  Ν: 'N',
  Ξ: 'X',
  Ο: 'O',
  Π: 'P',
  Ρ: 'R',
  Σ: 'S',
  Τ: 'T',
  Υ: 'Y',
  Φ: 'Ph',
  Χ: 'Ch',
  Ψ: 'Ps',
  Ω: 'Ō',

  // === Alpha ===
  ἀ: 'a',
  ἁ: 'ha',
  ἂ: 'a',
  ἃ: 'ha',
  ἄ: 'a',
  ἅ: 'ha',
  ἆ: 'a',
  ἇ: 'ha',
  Ἀ: 'A',
  Ἁ: 'Ha',
  Ἂ: 'A',
  Ἃ: 'Ha',
  Ἄ: 'A',
  Ἅ: 'Ha',
  Ἆ: 'A',
  Ἇ: 'Ha',
  ὰ: 'a',
  ά: 'a',
  ᾰ: 'a',
  ᾱ: 'a',
  // Alpha + iota subscript
  ᾀ: 'ai',
  ᾁ: 'hai',
  ᾂ: 'ai',
  ᾃ: 'hai',
  ᾄ: 'ai',
  ᾅ: 'hai',
  ᾆ: 'ai',
  ᾇ: 'hai',
  ᾈ: 'Ai',
  ᾉ: 'Hai',
  ᾊ: 'Ai',
  ᾋ: 'Hai',
  ᾌ: 'Ai',
  ᾍ: 'Hai',
  ᾎ: 'Ai',
  ᾏ: 'Hai',
  ᾲ: 'ai',
  ᾳ: 'ai',
  ᾴ: 'ai',
  ᾶ: 'a',
  ᾷ: 'ai',

  // === Epsilon ===
  ἐ: 'e',
  ἑ: 'he',
  ἒ: 'e',
  ἓ: 'he',
  ἔ: 'e',
  ἕ: 'he',
  Ἐ: 'E',
  Ἑ: 'He',
  Ἒ: 'E',
  Ἓ: 'He',
  Ἔ: 'E',
  Ἕ: 'He',
  ὲ: 'e',
  έ: 'e',

  // === Eta ===
  ἠ: 'ē',
  ἡ: 'hē',
  ἢ: 'ē',
  ἣ: 'hē',
  ἤ: 'ē',
  ἥ: 'hē',
  ἦ: 'ē',
  ἧ: 'hē',
  Ἠ: 'Ē',
  Ἡ: 'Hē',
  Ἢ: 'Ē',
  Ἣ: 'Hē',
  Ἤ: 'Ē',
  Ἥ: 'Hē',
  Ἦ: 'Ē',
  Ἧ: 'Hē',
  ὴ: 'ē',
  ή: 'ē',
  // Eta + iota subscript
  ᾐ: 'ēi',
  ᾑ: 'hēi',
  ᾒ: 'ēi',
  ᾓ: 'hēi',
  ᾔ: 'ēi',
  ᾕ: 'hēi',
  ᾖ: 'ēi',
  ᾗ: 'hēi',
  ᾘ: 'Ēi',
  ᾙ: 'Hēi',
  ᾚ: 'Ēi',
  ᾛ: 'Hēi',
  ᾜ: 'Ēi',
  ᾝ: 'Hēi',
  ᾞ: 'Ēi',
  ᾟ: 'Hēi',
  ῂ: 'ēi',
  ῃ: 'ēi',
  ῄ: 'ēi',
  ῆ: 'ē',
  ῇ: 'ēi',

  // === Iota ===
  ἰ: 'i',
  ἱ: 'hi',
  ἲ: 'i',
  ἳ: 'hi',
  ἴ: 'i',
  ἵ: 'hi',
  ἶ: 'i',
  ἷ: 'hi',
  Ἰ: 'I',
  Ἱ: 'Hi',
  Ἲ: 'I',
  Ἳ: 'Hi',
  Ἴ: 'I',
  Ἵ: 'Hi',
  Ἶ: 'I',
  Ἷ: 'Hi',
  ὶ: 'i',
  ί: 'i',
  ῐ: 'i',
  ῑ: 'i',
  ΐ: 'i',
  ῖ: 'i',
  ῗ: 'i',

  // === Omicron ===
  ὀ: 'o',
  ὁ: 'ho',
  ὂ: 'o',
  ὃ: 'ho',
  ὄ: 'o',
  ὅ: 'ho',
  Ὀ: 'O',
  Ὁ: 'Ho',
  Ὂ: 'O',
  Ὃ: 'Ho',
  Ὄ: 'O',
  Ὅ: 'Ho',
  ὸ: 'o',
  ό: 'o',

  // === Upsilon ===
  ὐ: 'y',
  ὑ: 'hy',
  ὒ: 'y',
  ὓ: 'hy',
  ὔ: 'y',
  ὕ: 'hy',
  ὖ: 'y',
  ὗ: 'hy',
  Ὑ: 'Hy',
  Ὓ: 'Hy',
  Ὕ: 'Hy',
  Ὗ: 'Hy',
  ὺ: 'y',
  ύ: 'y',
  ῠ: 'y',
  ῡ: 'y',
  ΰ: 'y',
  ῦ: 'y',
  ῧ: 'y',

  // === Omega ===
  ὠ: 'ō',
  ὡ: 'hō',
  ὢ: 'ō',
  ὣ: 'hō',
  ὤ: 'ō',
  ὥ: 'hō',
  ὦ: 'ō',
  ὧ: 'hō',
  Ὠ: 'Ō',
  Ὡ: 'Hō',
  Ὢ: 'Ō',
  Ὣ: 'Hō',
  Ὤ: 'Ō',
  Ὥ: 'Hō',
  Ὦ: 'Ō',
  Ὧ: 'Hō',
  ὼ: 'ō',
  ώ: 'ō',
  // Omega + iota subscript
  ᾠ: 'ōi',
  ᾡ: 'hōi',
  ᾢ: 'ōi',
  ᾣ: 'hōi',
  ᾤ: 'ōi',
  ᾥ: 'hōi',
  ᾦ: 'ōi',
  ᾧ: 'hōi',
  ᾨ: 'Ōi',
  ᾩ: 'Hōi',
  ᾪ: 'Ōi',
  ᾫ: 'Hōi',
  ᾬ: 'Ōi',
  ᾭ: 'Hōi',
  ᾮ: 'Ōi',
  ᾯ: 'Hōi',
  ῲ: 'ōi',
  ῳ: 'ōi',
  ῴ: 'ōi',
  ῶ: 'ō',
  ῷ: 'ōi',

  // === Rho ===
  ῥ: 'rh',
  Ῥ: 'Rh',
};

/** Gamma-nasal digraphs (γ before γ κ ξ χ → n + following consonant). */
const GAMMA_NASALS: Array<[string, string]> = [
  ['γγ', 'ng'],
  ['γκ', 'nk'],
  ['γξ', 'nx'],
  ['γχ', 'nch'],
  ['Γγ', 'Ng'],
  ['Γκ', 'Nk'],
  ['Γξ', 'Nx'],
  ['Γχ', 'Nch'],
];

export function greekToTranslit(greek: string): string {
  const chars = [...greek]; // spread preserves surrogate pairs / multi-byte chars
  let result = '';
  let i = 0;

  while (i < chars.length) {
    // Check gamma nasals (two-char sequences)
    if (chars[i] === 'γ' || chars[i] === 'Γ') {
      const pair = chars[i] + (chars[i + 1] ?? '');
      const nasal = GAMMA_NASALS.find(([g]) => g === pair);
      if (nasal) {
        result += nasal[1];
        i += 2;
        continue;
      }
    }

    const mapped = GREEK_TO_TRANSLIT[chars[i]];
    result += mapped !== undefined ? mapped : chars[i];
    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Transliteration → Greek (approximate — no accent marks produced)
// ---------------------------------------------------------------------------

/**
 * Ordered pairs: match the longest sequence first to avoid ambiguity.
 * e.g. "nch" must be tried before "n" so γχ is produced, not νχ.
 */
const TRANSLIT_TO_GREEK: Array<[string, string]> = [
  // Lowercase — longest sequences first
  ['nch', 'γχ'],
  ['hēi', 'ἡι'],
  ['hōi', 'ὡι'],
  ['ēi', 'ῃ'],
  ['ōi', 'ῳ'],
  ['nk', 'γκ'],
  ['nx', 'γξ'],
  ['ng', 'γγ'],
  ['th', 'θ'],
  ['ph', 'φ'],
  ['ch', 'χ'],
  ['ps', 'ψ'],
  ['rh', 'ῥ'],
  // h+vowel = rough breathing (output precomposed form)
  ['hē', 'ἡ'],
  ['hō', 'ὡ'],
  ['ha', 'ἁ'],
  ['he', 'ἑ'],
  ['hi', 'ἱ'],
  ['ho', 'ὁ'],
  ['hy', 'ὑ'],
  // Macron vowels
  ['ē', 'η'],
  ['ō', 'ω'],
  // Single chars
  ['a', 'α'],
  ['b', 'β'],
  ['g', 'γ'],
  ['d', 'δ'],
  ['e', 'ε'],
  ['z', 'ζ'],
  ['i', 'ι'],
  ['k', 'κ'],
  ['l', 'λ'],
  ['m', 'μ'],
  ['n', 'ν'],
  ['x', 'ξ'],
  ['o', 'ο'],
  ['p', 'π'],
  ['r', 'ρ'],
  ['s', 'σ'],
  ['t', 'τ'],
  ['y', 'υ'],

  // Uppercase — longest sequences first
  ['Nch', 'Γχ'],
  ['Hēi', 'Ἡι'],
  ['Hōi', 'Ὡι'],
  ['Ēi', 'Ηι'],
  ['Ōi', 'Ωι'],
  ['Nk', 'Γκ'],
  ['Nx', 'Γξ'],
  ['Ng', 'Γγ'],
  ['Th', 'Θ'],
  ['Ph', 'Φ'],
  ['Ch', 'Χ'],
  ['Ps', 'Ψ'],
  ['Rh', 'Ῥ'],
  ['Hē', 'Ἡ'],
  ['Hō', 'Ὡ'],
  ['Ha', 'Ἁ'],
  ['He', 'Ἑ'],
  ['Hi', 'Ἱ'],
  ['Ho', 'Ὁ'],
  ['Hy', 'Ὑ'],
  ['Ē', 'Η'],
  ['Ō', 'Ω'],
  ['A', 'Α'],
  ['B', 'Β'],
  ['G', 'Γ'],
  ['D', 'Δ'],
  ['E', 'Ε'],
  ['Z', 'Ζ'],
  ['I', 'Ι'],
  ['K', 'Κ'],
  ['L', 'Λ'],
  ['M', 'Μ'],
  ['N', 'Ν'],
  ['X', 'Ξ'],
  ['O', 'Ο'],
  ['P', 'Π'],
  ['R', 'Ρ'],
  ['S', 'Σ'],
  ['T', 'Τ'],
  ['Y', 'Υ'],
];

function applyFinalSigma(text: string): string {
  return text.replace(/σ(?=[\s.,;·!?\-—""''"\n\r]|$)/g, 'ς');
}

export function translitToGreek(translit: string): string {
  let result = '';
  let i = 0;

  while (i < translit.length) {
    let matched = false;

    for (const [latin, greek] of TRANSLIT_TO_GREEK) {
      if (translit.startsWith(latin, i)) {
        result += greek;
        i += latin.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += translit[i];
      i++;
    }
  }

  return applyFinalSigma(result);
}
