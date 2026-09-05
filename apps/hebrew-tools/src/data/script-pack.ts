// The Hebrew ScriptPack — everything language-specific about /write.
//
// The engine in @tools/shared/ink never mentions Hebrew. This file is what
// makes it write Hebrew, and greek.tools' equivalent is what will make it write
// Greek (issue #105). Keep language knowledge here, not in the engine.
//
// Names follow the conventions used in Garrett & DeRouchie, which is the
// textbook the vocabulary decks are built around. Transliteration is SBL
// general-purpose, matching `vocabulary.ts`.

import type { ScriptPack, WritableGlyph } from '@tools/shared/ink';

/**
 * The 22 consonants in alphabetical order.
 *
 * `note` is written for the confusable pairs only, where a beginner's error is
 * a discrimination failure rather than a memory failure. Describing the shape
 * of ל helps nobody; describing what separates ד from ר is the whole lesson.
 */
const CONSONANTS: WritableGlyph[] = [
  { char: 'א', name: 'alef', phonetic: 'ʾ', group: 'consonant' },
  {
    char: 'ב',
    name: 'bet',
    phonetic: 'b',
    group: 'consonant',
    confusableWith: ['כ'],
    note: 'The base extends left past the vertical. כ is rounded and has no such foot.',
  },
  { char: 'ג', name: 'gimel', phonetic: 'g', group: 'consonant' },
  {
    char: 'ד',
    name: 'dalet',
    phonetic: 'd',
    group: 'consonant',
    confusableWith: ['ר'],
    note: 'Square corner: the roof projects past the leg at the top right. ר is rounded.',
  },
  {
    char: 'ה',
    name: 'he',
    phonetic: 'h',
    group: 'consonant',
    confusableWith: ['ח', 'ת'],
    note: 'The left leg hangs detached — there is a gap below the roof. ח is closed.',
  },
  {
    char: 'ו',
    name: 'waw',
    phonetic: 'w',
    group: 'consonant',
    confusableWith: ['ז', 'ן'],
    note: 'A plain vertical with a small head to the right only. It sits on the baseline.',
  },
  {
    char: 'ז',
    name: 'zayin',
    phonetic: 'z',
    group: 'consonant',
    confusableWith: ['ו'],
    note: 'The head sits centered across the stem, not off to one side as in ו.',
  },
  {
    char: 'ח',
    name: 'het',
    phonetic: 'ḥ',
    group: 'consonant',
    confusableWith: ['ה', 'ת'],
    note: 'Closed across the top — no gap. That closure is the whole difference from ה.',
  },
  { char: 'ט', name: 'tet', phonetic: 'ṭ', group: 'consonant' },
  {
    char: 'י',
    name: 'yod',
    phonetic: 'y',
    group: 'consonant',
    note: 'The smallest letter; it hangs from the top line.',
  },
  {
    char: 'כ',
    name: 'kaf',
    phonetic: 'k',
    group: 'consonant',
    confusableWith: ['ב'],
    note: 'Rounded, with no foot projecting left. ב has one.',
  },
  {
    char: 'ל',
    name: 'lamed',
    phonetic: 'l',
    group: 'consonant',
    note: 'The only letter rising above the top line.',
  },
  { char: 'מ', name: 'mem', phonetic: 'm', group: 'consonant' },
  { char: 'נ', name: 'nun', phonetic: 'n', group: 'consonant' },
  {
    char: 'ס',
    name: 'samek',
    phonetic: 's',
    group: 'consonant',
    confusableWith: ['ם'],
    note: 'Fully closed and rounded. ם (final mem) is closed but square.',
  },
  {
    char: 'ע',
    name: 'ayin',
    phonetic: 'ʿ',
    group: 'consonant',
    confusableWith: ['צ'],
    note: 'Two arms meeting low on a long diagonal stem.',
  },
  { char: 'פ', name: 'pe', phonetic: 'p', group: 'consonant' },
  {
    char: 'צ',
    name: 'tsade',
    phonetic: 'ṣ',
    group: 'consonant',
    confusableWith: ['ע'],
    note: 'The arms join higher than in ע, and the left arm rises to the right.',
  },
  {
    char: 'ק',
    name: 'qof',
    phonetic: 'q',
    group: 'consonant',
    note: 'Descends below the baseline.',
  },
  {
    char: 'ר',
    name: 'resh',
    phonetic: 'r',
    group: 'consonant',
    confusableWith: ['ד'],
    note: 'Rounded shoulder with no projecting corner. ד has the square corner.',
  },
  // Shin and sin are one letter of the alphabet distinguished only by which
  // side the dot sits on, and placing that dot is the motor skill. They get a
  // card each; a BARE ש is neither of them and occurs nowhere in the text.
  //
  // `baseForm` is the bare ש, which is what makes the dot's side actually
  // count. It is under 1% of the letter's cells, so an area metric over the
  // whole glyph scores שׂ written for שׁ as very nearly correct; graded as a
  // mark in the letter's frame, the wrong arm misses outright.
  {
    char: 'שׁ',
    baseForm: 'ש',
    name: 'shin',
    phonetic: 'š',
    group: 'consonant',
    confusableWith: ['שׂ'],
    note: 'Three arms rising from one base, with the dot over the RIGHT arm.',
  },
  {
    char: 'שׂ',
    baseForm: 'ש',
    name: 'sin',
    phonetic: 'ś',
    group: 'consonant',
    confusableWith: ['שׁ'],
    note: 'The same three arms as שׁ — only the dot moves, to the LEFT arm.',
  },
  {
    char: 'ת',
    name: 'tav',
    phonetic: 't',
    group: 'consonant',
    confusableWith: ['ה', 'ח'],
    note: 'Closed like ח, but the left leg ends in a small foot turned left.',
  },
];

/**
 * The five final forms.
 *
 * Kept as their own group rather than folded in with the consonants: they are
 * taught after the alphabet, and three of the five descend below the baseline,
 * which is a distinct motor skill.
 */
const FINALS: WritableGlyph[] = [
  // Final kaf closes a syllable, so it carries a silent sheva essentially
  // everywhere it occurs — מֶלֶךְ, הָלַךְ, מָלַךְ. The two dots are part of what a
  // student writes, so they are part of what gets traced and graded.
  {
    char: 'ך',
    referenceForm: 'ךְ',
    name: 'kaf sofit',
    phonetic: 'k',
    group: 'final',
    note: 'Descends below the baseline, and takes a silent sheva — the two dots underneath.',
  },
  {
    char: 'ם',
    name: 'mem sofit',
    phonetic: 'm',
    group: 'final',
    confusableWith: ['ס'],
    note: 'Closed and square. ס is closed and round.',
  },
  {
    char: 'ן',
    name: 'nun sofit',
    phonetic: 'n',
    group: 'final',
    confusableWith: ['ו'],
    note: 'A vertical that descends below the baseline; ו stops on it.',
  },
  {
    char: 'ף',
    name: 'pe sofit',
    phonetic: 'p',
    group: 'final',
    note: 'Descends below the baseline.',
  },
  {
    char: 'ץ',
    name: 'tsade sofit',
    phonetic: 'ṣ',
    group: 'final',
    note: 'Descends below the baseline.',
  },
];

/**
 * Nikud, on a host consonant.
 *
 * Thirteen cards: nine full vowels, three hatephs, and the sheva. פ is the
 * conventional host in teaching charts, and `renderableText()` composes every
 * mark onto it — a vowel point rendered alone is a stray tick with nothing to
 * attach to.
 *
 * **Every note here is about placement, because placement is what is being
 * drilled.** Hireq, sheva and holem are the same handful of dots; what makes
 * them different vowels is that one sits below, one below in a stack, and one
 * above and to the left. Scoring reads this the same way the student does —
 * `baseText()` resolves to the bare פ, and the mark is graded as a mark, in the
 * composed glyph's frame. See `rasterizeComposite` in `@tools/shared/ink`.
 *
 * Two are vowel *letters* rather than points, and they are here rather than
 * with the consonants because that is where the textbook's vowel chart puts
 * them and because writing them is the same skill: a mark in a fixed position
 * relative to a consonant.
 *
 * **Qamets qatan is deliberately absent.** It is a distinct vowel and it has a
 * Unicode codepoint of its own (U+05C7), but the WLC writes it with the
 * ordinary qamets and it is drawn identically either way. A handwriting card
 * whose reference is pixel-for-pixel another card's is not a card — telling
 * the two apart is a syllable-structure lesson, not a motor one.
 */
const NIKUD: WritableGlyph[] = [
  {
    char: 'ַ',
    name: 'patah',
    phonetic: 'a',
    group: 'vowel',
    note: 'A horizontal stroke centred beneath the consonant.',
  },
  {
    char: 'ָ',
    name: 'qamets',
    phonetic: 'ā',
    group: 'vowel',
    note: 'A patah with a short tail dropping from the middle of it.',
  },
  {
    char: 'ֶ',
    name: 'segol',
    phonetic: 'e',
    group: 'vowel',
    note: 'Three dots beneath, in a triangle pointing down.',
  },
  {
    char: 'ֵ',
    name: 'tsere',
    phonetic: 'ē',
    group: 'vowel',
    note: 'Two dots beneath, side by side and level.',
  },
  {
    char: 'ִ',
    name: 'hireq',
    phonetic: 'i',
    group: 'vowel',
    note: 'A single dot directly beneath the consonant.',
  },
  {
    char: 'ֹ',
    name: 'holem',
    phonetic: 'ō',
    group: 'vowel',
    note: 'The one point written ABOVE — up and to the left, not centred over the letter.',
  },
  {
    char: 'ֻ',
    name: 'qibbuts',
    phonetic: 'u',
    group: 'vowel',
    note: 'Three dots beneath on a diagonal. A tsere is two dots level; this is three, sloping.',
  },
  // Vav + dagesh. Not a point at all — the vowel is a letter of its own,
  // written after the consonant it sounds with.
  {
    char: 'וּ',
    name: 'shureq',
    phonetic: 'û',
    group: 'vowel',
    note: 'A vav following the consonant, with a dot in the middle of its stem.',
  },
  // Vav + holem, in that order. The WLC's own encoding puts the point first;
  // written that way it lands on the preceding consonant instead of the vav.
  {
    char: 'וֹ',
    name: 'holem male',
    phonetic: 'ô',
    group: 'vowel',
    note: 'A vav following the consonant, with the holem dot above and left of it.',
  },
  {
    char: 'ְ',
    name: 'sheva',
    phonetic: 'ə',
    group: 'vowel',
    note: 'Two dots beneath, stacked vertically. A hireq is one dot; this is two.',
  },
  // The hatephs are single codepoints that render as a sheva beside their
  // vowel. Which side each sits on is the font's business, not the student's.
  {
    char: 'ֲ',
    name: 'hateph patah',
    phonetic: 'ă',
    group: 'vowel',
    note: 'A sheva and a patah together beneath the consonant.',
  },
  {
    char: 'ֱ',
    name: 'hateph segol',
    phonetic: 'ĕ',
    group: 'vowel',
    note: 'A sheva and a segol together beneath the consonant.',
  },
  {
    char: 'ֳ',
    name: 'hateph qamets',
    phonetic: 'ŏ',
    group: 'vowel',
    note: 'A sheva and a qamets together beneath the consonant.',
  },
];

export const hebrewScriptPack: ScriptPack = {
  id: 'hebrew',
  label: 'Biblical Hebrew',
  direction: 'rtl',
  // Already loaded by Layout.astro for all Hebrew text on the site.
  fontFamily: '"Noto Sans Hebrew", sans-serif',
  fontLoadSpec: '400 64px "Noto Sans Hebrew"',
  glyphs: [...CONSONANTS, ...FINALS],
  combining: { hostChar: 'פ', marks: NIKUD },
  // Nominal layout hints, not measured font metrics — they only position the
  // reference glyph today. Mask scoring (#100) rasterizes the glyph directly
  // and will need real measured values; replace these then rather than
  // trusting them.
  metrics: { emBox: 1000, baseline: 0, ascender: 700, descender: 200 },
};
