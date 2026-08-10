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
  { char: 'י', name: 'yod', phonetic: 'y', group: 'consonant', note: 'The smallest letter; it hangs from the top line.' },
  {
    char: 'כ',
    name: 'kaf',
    phonetic: 'k',
    group: 'consonant',
    confusableWith: ['ב'],
    note: 'Rounded, with no foot projecting left. ב has one.',
  },
  { char: 'ל', name: 'lamed', phonetic: 'l', group: 'consonant', note: 'The only letter rising above the top line.' },
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
  { char: 'ק', name: 'qof', phonetic: 'q', group: 'consonant', note: 'Descends below the baseline.' },
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
  {
    char: 'שׁ',
    name: 'shin',
    phonetic: 'š',
    group: 'consonant',
    confusableWith: ['שׂ'],
    note: 'Three arms rising from one base, with the dot over the RIGHT arm.',
  },
  {
    char: 'שׂ',
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
  { char: 'ף', name: 'pe sofit', phonetic: 'p', group: 'final', note: 'Descends below the baseline.' },
  { char: 'ץ', name: 'tsade sofit', phonetic: 'ṣ', group: 'final', note: 'Descends below the baseline.' },
];

/**
 * Nikud, on a host consonant.
 *
 * Not yet surfaced in the UI — the vowel deck is issue #101. They live here now
 * because a vowel point rendered alone is a stray mark with nothing to attach
 * to, and `renderableText()` already knows to compose them onto `hostChar`.
 *
 * פ is the conventional host in teaching charts.
 */
const NIKUD: WritableGlyph[] = [
  { char: 'ַ', name: 'patah', phonetic: 'a', group: 'vowel' },
  { char: 'ָ', name: 'qamets', phonetic: 'ā', group: 'vowel' },
  { char: 'ֶ', name: 'segol', phonetic: 'e', group: 'vowel' },
  { char: 'ֵ', name: 'tsere', phonetic: 'ē', group: 'vowel' },
  { char: 'ִ', name: 'hireq', phonetic: 'i', group: 'vowel' },
  { char: 'ֹ', name: 'holem', phonetic: 'ō', group: 'vowel' },
  { char: 'ֻ', name: 'qibbuts', phonetic: 'u', group: 'vowel' },
  { char: 'ְ', name: 'sheva', phonetic: 'ə', group: 'vowel' },
  { char: 'ֲ', name: 'hateph patah', phonetic: 'ă', group: 'vowel' },
  { char: 'ֱ', name: 'hateph segol', phonetic: 'ĕ', group: 'vowel' },
  { char: 'ֳ', name: 'hateph qamets', phonetic: 'ŏ', group: 'vowel' },
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
