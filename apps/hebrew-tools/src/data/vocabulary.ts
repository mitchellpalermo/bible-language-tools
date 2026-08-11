// Hebrew vocabulary — the curated starter set, merged with the textbook import.
//
// Two sources feed this file:
//
//   1. `CURATED` below — a small, hand-written, high-confidence set of standard
//      first-year vocabulary, plus Garrett & DeRouchie chapter 1 (which the
//      course's vocabulary handout does not cover). These entries carry
//      transliterations and approximate frequencies.
//   2. `GARRETT_VOCABULARY` — generated from the course handout, chapters 2–31.
//      No transliterations and no frequencies; see that file's header.
//
// `mergeVocabulary` folds the second into the first. The two overlap heavily —
// most of the curated set is also Garrett vocabulary — and the merge is what
// keeps that overlap a single entry, and therefore a single SRS card.
//
// Frequency numbers on curated entries are APPROXIMATE — rounded ballpark
// figures from standard published Biblical Hebrew frequency lists, not exact
// counts. Once the OSHB data pipeline exists (issue #75), this file's frequency
// column should be regenerated from real per-lemma counts computed off the
// Westminster Leningrad Codex.
//
// `root` is only populated where the triliteral root is unambiguous and
// standardly taught (mostly verbs). Many nouns in Biblical Hebrew (bən, yād,
// šēm, ʿayin, rōʾš...) have no verbal root that's pedagogically useful to cite,
// so it's left undefined rather than guessed.

import { GARRETT_VOCABULARY } from './vocabulary-garrett';
import { cardKey, gd, type HebrewVocabWord } from './vocabulary-types';

export { cardKey, gd };
export type { HebrewGender, HebrewVocabWord, VerbStemGloss } from './vocabulary-types';

/** Optional fields an imported entry may contribute to a curated one. */
const MERGEABLE_FIELDS = [
  'root',
  'gender',
  'binyan',
  'construct',
  'plural',
  'alternates',
  'stems',
  'note',
] as const;

/**
 * Fold textbook entries into the curated list, keyed by `cardKey`.
 *
 * Matching is on the exact Hebrew string, deliberately — not on the root. Five
 * curated nouns (מֶלֶךְ, דָּבָר, עֶבֶד, דַּעַת, שֹׁפֵט) share a root with a
 * Garrett verb entry, and collapsing a noun into its cognate verb would be
 * wrong in both directions.
 *
 * On a match the curated entry wins for anything it already states: its gloss
 * and transliteration are hand-checked, and its frequency is the only one there
 * is. The import contributes the chapter tags, plus any field the curated entry
 * left undefined.
 */
export function mergeVocabulary(
  curated: HebrewVocabWord[],
  imported: HebrewVocabWord[],
): HebrewVocabWord[] {
  const merged = curated.map((word) => ({ ...word }));
  const byKey = new Map(merged.map((word) => [cardKey(word), word]));

  for (const word of imported) {
    const existing = byKey.get(cardKey(word));
    if (!existing) {
      const copy = { ...word };
      merged.push(copy);
      byKey.set(cardKey(copy), copy);
      continue;
    }

    existing.chapters = [...(existing.chapters ?? []), ...(word.chapters ?? [])].filter(
      (ref, i, all) =>
        all.findIndex(
          (other) =>
            other.textbook === ref.textbook &&
            other.chapter === ref.chapter &&
            other.category === ref.category,
        ) === i,
    );

    for (const field of MERGEABLE_FIELDS) {
      if (existing[field] === undefined && word[field] !== undefined) {
        // Each field is assigned to its own key, so the union type is safe here
        // even though TypeScript cannot correlate the two indexed accesses.
        (existing as Record<string, unknown>)[field] = word[field];
      }
    }
  }

  return merged;
}

const CURATED: HebrewVocabWord[] = [
  // Core particles, conjunctions, prepositions
  { hebrew: 'וְ', transliteration: 'wə', gloss: 'and', frequency: 50000, partOfSpeech: 'conjunction' },
  { hebrew: 'הַ', transliteration: 'ha', gloss: 'the (definite article)', frequency: 30000, partOfSpeech: 'particle' },
  { hebrew: 'בְּ', transliteration: 'bə', gloss: 'in, with, by', frequency: 15000, partOfSpeech: 'preposition' },
  { hebrew: 'לְ', transliteration: 'lə', gloss: 'to, for', frequency: 20000, partOfSpeech: 'preposition' },
  { hebrew: 'כְּ', transliteration: 'kə', gloss: 'like, as', frequency: 3000, partOfSpeech: 'preposition' },
  { hebrew: 'אֶת', transliteration: 'ʾet', gloss: '(marks a definite direct object; untranslated)', frequency: 11000, partOfSpeech: 'particle' },
  { hebrew: 'אֲשֶׁר', transliteration: 'ʾăšer', gloss: 'who, which, that (relative)', frequency: 5500, partOfSpeech: 'particle' },
  { hebrew: 'עַל', transliteration: 'ʿal', gloss: 'on, upon, over, against', frequency: 5700, partOfSpeech: 'preposition' },
  { hebrew: 'אֶל', transliteration: 'ʾel', gloss: 'to, toward, into', frequency: 5500, partOfSpeech: 'preposition' },
  { hebrew: 'מִן', transliteration: 'min', gloss: 'from, out of, than', frequency: 7500, partOfSpeech: 'preposition' },
  { hebrew: 'לֹא', transliteration: 'lōʾ', gloss: 'not, no', frequency: 5000, partOfSpeech: 'particle' },
  { hebrew: 'כֹּל', root: 'כלל', transliteration: 'kōl', gloss: 'all, every, whole', frequency: 5400, partOfSpeech: 'noun' },
  { hebrew: 'כִּי', transliteration: 'kî', gloss: 'that, because, for, when', frequency: 4400, partOfSpeech: 'conjunction' },
  { hebrew: 'עִם', transliteration: 'ʿim', gloss: 'with', frequency: 1040, partOfSpeech: 'preposition' },
  { hebrew: 'עַד', transliteration: 'ʿad', gloss: 'until, as far as', frequency: 1260, partOfSpeech: 'preposition' },
  { hebrew: 'גַּם', transliteration: 'gam', gloss: 'also, even, moreover', frequency: 770, partOfSpeech: 'adverb' },
  { hebrew: 'עַתָּה', transliteration: 'ʿattâ', gloss: 'now', frequency: 430, partOfSpeech: 'adverb' },
  { hebrew: 'מְאֹד', transliteration: 'məʾōd', gloss: 'very, exceedingly', frequency: 300, partOfSpeech: 'adverb' },
  { hebrew: 'שָׁם', transliteration: 'šām', gloss: 'there', frequency: 800, partOfSpeech: 'adverb' },

  // Common nouns
  { hebrew: 'אֱלֹהִים', transliteration: 'ʾĕlōhîm', gloss: 'God, gods', frequency: 2600, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'יְהוָה', transliteration: 'YHWH', gloss: 'LORD (the divine name / tetragrammaton)', frequency: 6800, partOfSpeech: 'noun' },
  { hebrew: 'בֵּן', transliteration: 'bēn', gloss: 'son', frequency: 4900, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'בַּת', transliteration: 'bat', gloss: 'daughter', frequency: 590, partOfSpeech: 'noun', gender: 'f' },
  { hebrew: 'בַּיִת', root: 'בית', transliteration: 'bayit', gloss: 'house', frequency: 2000, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'מֶלֶךְ', root: 'מלך', transliteration: 'melek', gloss: 'king', frequency: 2600, partOfSpeech: 'noun', gender: 'm', chapters: [gd(1, 'core')] },
  { hebrew: 'אֶרֶץ', root: 'ארץ', transliteration: 'ʾereṣ', gloss: 'earth, land', frequency: 2500, partOfSpeech: 'noun', gender: 'f', chapters: [gd(1, 'core')] },
  { hebrew: 'יוֹם', transliteration: 'yôm', gloss: 'day', frequency: 2300, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'אִישׁ', transliteration: 'ʾîš', gloss: 'man, husband', frequency: 2160, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'אִשָּׁה', transliteration: 'ʾiššâ', gloss: 'woman, wife', frequency: 780, partOfSpeech: 'noun', gender: 'f' },
  { hebrew: 'עִיר', transliteration: 'ʿîr', gloss: 'city', frequency: 1090, partOfSpeech: 'noun', gender: 'f' },
  { hebrew: 'פָּנִים', root: 'פנה', transliteration: 'pānîm', gloss: 'face, presence', frequency: 2100, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'יָד', transliteration: 'yād', gloss: 'hand', frequency: 1600, partOfSpeech: 'noun', gender: 'f' },
  { hebrew: 'עַם', root: 'עמם', transliteration: 'ʿam', gloss: 'people, nation', frequency: 1850, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'שָׁמַיִם', transliteration: 'šāmayim', gloss: 'heaven, sky', frequency: 420, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'דָּבָר', root: 'דבר', transliteration: 'dābār', gloss: 'word, thing', frequency: 1400, partOfSpeech: 'noun', gender: 'm', chapters: [gd(1, 'core')] },
  { hebrew: 'עֶבֶד', root: 'עבד', transliteration: 'ʿebed', gloss: 'servant, slave', frequency: 800, partOfSpeech: 'noun', gender: 'm', chapters: [gd(1, 'core')] },
  { hebrew: 'שֵׁם', transliteration: 'šēm', gloss: 'name', frequency: 860, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'עַיִן', transliteration: 'ʿayin', gloss: 'eye, spring', frequency: 870, partOfSpeech: 'noun', gender: 'f' },
  { hebrew: 'רֹאשׁ', transliteration: 'rōʾš', gloss: 'head, top, chief', frequency: 600, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'נֶפֶשׁ', transliteration: 'nepeš', gloss: 'soul, life, person, self', frequency: 750, partOfSpeech: 'noun', gender: 'f' },
  { hebrew: 'קוֹל', transliteration: 'qôl', gloss: 'voice, sound', frequency: 500, partOfSpeech: 'noun', gender: 'm' },
  { hebrew: 'לֵב', transliteration: 'lēb', gloss: 'heart, mind', frequency: 600, partOfSpeech: 'noun', gender: 'm' },

  // Garrett & DeRouchie chapter 1 — the rest of the chapter's list. The four
  // words above already tagged gd(1) (מֶלֶךְ, אֶרֶץ, דָּבָר, עֶבֶד) are also on it.
  // Chapter 1 is hand-written because the course's vocabulary handout starts at
  // chapter 2; every later chapter comes from `vocabulary-garrett.ts`.
  { hebrew: 'אָדָם', transliteration: 'ʾādām', gloss: 'human, Adam', frequency: 550, partOfSpeech: 'noun', gender: 'm', chapters: [gd(1, 'core')] },
  { hebrew: 'אֵשׁ', transliteration: 'ʾēš', gloss: 'fire', frequency: 380, partOfSpeech: 'noun', gender: 'f', chapters: [gd(1, 'core')] },
  { hebrew: 'דַּעַת', root: 'ידע', transliteration: 'daʿat', gloss: 'knowledge', frequency: 90, partOfSpeech: 'noun', gender: 'f', chapters: [gd(1, 'core')] },
  { hebrew: 'חָצֵר', transliteration: 'ḥāṣēr', gloss: 'village, courtyard', frequency: 190, partOfSpeech: 'noun', gender: 'fm', chapters: [gd(1, 'core')] },
  { hebrew: 'צֹאן', transliteration: 'ṣōʾn', gloss: 'flock (of sheep or goats)', frequency: 275, partOfSpeech: 'noun', gender: 'f', chapters: [gd(1, 'core')] },
  { hebrew: 'שַׂר', transliteration: 'śar', gloss: 'ruler, leader, prince', frequency: 420, partOfSpeech: 'noun', gender: 'm', chapters: [gd(1, 'core')] },
  { hebrew: 'שֹׁפֵט', root: 'שפט', transliteration: 'šōpēṭ', gloss: 'judge, leader', frequency: 60, partOfSpeech: 'noun', gender: 'm', chapters: [gd(1, 'core')] },

  // Adjectives
  { hebrew: 'גָּדוֹל', root: 'גדל', transliteration: 'gādôl', gloss: 'great, big', frequency: 525, partOfSpeech: 'adjective' },
  { hebrew: 'טוֹב', root: 'טוב', transliteration: 'ṭôb', gloss: 'good', frequency: 530, partOfSpeech: 'adjective' },
  { hebrew: 'קָטֹן', root: 'קטן', transliteration: 'qāṭōn', gloss: 'small, young', frequency: 100, partOfSpeech: 'adjective' },
  { hebrew: 'רַע', root: 'רעע', transliteration: 'raʿ', gloss: 'evil, bad', frequency: 310, partOfSpeech: 'adjective' },
  { hebrew: 'זָקֵן', root: 'זקן', transliteration: 'zāqēn', gloss: 'old (adjective); elder, old man (noun)', frequency: 180, partOfSpeech: 'adjective', gender: 'm', chapters: [gd(1, 'core')] },

  // High-frequency Qal perfect 3ms verbs
  { hebrew: 'אָמַר', root: 'אמר', transliteration: 'ʾāmar', gloss: 'he said', frequency: 5300, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'הָיָה', root: 'היה', transliteration: 'hāyâ', gloss: 'he was, became', frequency: 3560, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'עָשָׂה', root: 'עשה', transliteration: 'ʿāśâ', gloss: 'he did, made', frequency: 2600, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'נָתַן', root: 'נתן', transliteration: 'nātan', gloss: 'he gave', frequency: 2000, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'בָּא', root: 'בוא', transliteration: 'bāʾ', gloss: 'he came, went in', frequency: 2570, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'הָלַךְ', root: 'הלך', transliteration: 'hālak', gloss: 'he walked, went', frequency: 1550, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'רָאָה', root: 'ראה', transliteration: 'rāʾâ', gloss: 'he saw', frequency: 1300, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'שָׁמַע', root: 'שמע', transliteration: 'šāmaʿ', gloss: 'he heard, listened, obeyed', frequency: 1160, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'יָדַע', root: 'ידע', transliteration: 'yādaʿ', gloss: 'he knew', frequency: 950, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'יָצָא', root: 'יצא', transliteration: 'yāṣāʾ', gloss: 'he went out', frequency: 1070, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'קָרָא', sense: 'I', root: 'קרא', transliteration: 'qārāʾ', gloss: 'he called, read, proclaimed', frequency: 730, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'עָלָה', root: 'עלה', transliteration: 'ʿālâ', gloss: 'he went up', frequency: 890, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'יָשַׁב', root: 'ישב', transliteration: 'yāšab', gloss: 'he sat, dwelt, remained', frequency: 1080, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'שָׁב', root: 'שוב', transliteration: 'šāb', gloss: 'he returned, turned back', frequency: 1075, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'מָצָא', root: 'מצא', transliteration: 'māṣāʾ', gloss: 'he found', frequency: 450, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'שָׁלַח', root: 'שלח', transliteration: 'šālaḥ', gloss: 'he sent', frequency: 840, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'עָבַר', root: 'עבר', transliteration: 'ʿābar', gloss: 'he passed over, through', frequency: 550, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'שָׁמַר', root: 'שמר', transliteration: 'šāmar', gloss: 'he kept, watched, guarded', frequency: 470, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'קָם', root: 'קום', transliteration: 'qām', gloss: 'he arose, stood up', frequency: 630, partOfSpeech: 'verb', binyan: 'Qal' },
  { hebrew: 'מָלַךְ', root: 'מלך', transliteration: 'mālak', gloss: 'he reigned, became king', frequency: 350, partOfSpeech: 'verb', binyan: 'Qal' },
];

export const vocabulary: HebrewVocabWord[] = mergeVocabulary(CURATED, GARRETT_VOCABULARY);
