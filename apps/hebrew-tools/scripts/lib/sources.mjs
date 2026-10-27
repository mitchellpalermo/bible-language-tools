/**
 * Where the pipeline's upstream data comes from. One copy, so the build and
 * `check-bdb-pins.mjs` cannot disagree about which lexicon they read.
 *
 * The corpus tracks `master`, matching how greek-tools consumes MorphGNT: the
 * WLC is a living critical edition and we want its corrections.
 *
 * The lexicon is pinned to a commit, matching how greek-tools consumes Dodson.
 * It is reference data whose only job is to be stable — an upstream edit that
 * silently changed 9,000 headwords would be invisible in a diff of generated
 * output that is not committed.
 *
 * TBESH is pinned for the same reason, and because a pin's recorded `tbesh`
 * is only meaningful against a fixed text. It is never part of the build.
 */
export const WLC_BASE = 'https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc';

export const LEXICON_BASE =
  'https://raw.githubusercontent.com/openscriptures/HebrewLexicon/21c9add13bc727d3a951361778e97e3ff7afd1ce';

export const TBESH_URL =
  'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/48b7cfbda441adb6445ea565b4ed23dd98dfdf2e/' +
  'Lexicons/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt';
