// Hand-curated starter vocabulary — NOT generated.
//
// Unlike greek-tools' vocabulary.ts (generated from MorphGNT + Dodson), there is
// no OSHB build pipeline yet (tracked separately — see ROADMAP.md "OSHB Data
// Pipeline"). This is a small, high-confidence set of the most standard
// first-year Biblical Hebrew vocabulary (the kind taught in Pratico & Van Pelt,
// Kelley, or Futato chapters 1-10): core function words, the most frequent
// strong-verb Qal perfect 3ms forms, and a handful of very common nouns and
// adjectives.
//
// Frequency numbers are APPROXIMATE — rounded ballpark figures from standard
// published Biblical Hebrew frequency lists, not exact counts. Once the OSHB
// data pipeline exists, this file should be regenerated (or at least its
// frequency column corrected) from real per-lemma counts computed off the
// Westminster Leningrad Codex.
//
// `root` is only populated where the triliteral root is unambiguous and
// standardly taught (mostly verbs). Many nouns in Biblical Hebrew (bən, yād,
// šēm, ʿayin, rōʾš...) have no verbal root that's pedagogically useful to cite,
// so it's left undefined rather than guessed.

export interface HebrewVocabWord {
  hebrew: string; // fully pointed form (BHS standard)
  root?: string; // triliteral root, when unambiguous
  transliteration: string; // SBL general-purpose transliteration
  gloss: string;
  frequency: number; // approximate — see file header
  partOfSpeech: string;
  binyan?: string; // for verbs: Qal, Niphal, Piel, etc.
}

export const vocabulary: HebrewVocabWord[] = [
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
  { hebrew: 'אֱלֹהִים', transliteration: 'ʾĕlōhîm', gloss: 'God, gods', frequency: 2600, partOfSpeech: 'noun' },
  { hebrew: 'יְהוָה', transliteration: 'YHWH', gloss: 'LORD (the divine name / tetragrammaton)', frequency: 6800, partOfSpeech: 'noun' },
  { hebrew: 'בֵּן', transliteration: 'bēn', gloss: 'son', frequency: 4900, partOfSpeech: 'noun' },
  { hebrew: 'בַּת', transliteration: 'bat', gloss: 'daughter', frequency: 590, partOfSpeech: 'noun' },
  { hebrew: 'בַּיִת', root: 'בית', transliteration: 'bayit', gloss: 'house', frequency: 2000, partOfSpeech: 'noun' },
  { hebrew: 'מֶלֶךְ', root: 'מלך', transliteration: 'melek', gloss: 'king', frequency: 2600, partOfSpeech: 'noun' },
  { hebrew: 'אֶרֶץ', root: 'ארץ', transliteration: 'ʾereṣ', gloss: 'land, earth', frequency: 2500, partOfSpeech: 'noun' },
  { hebrew: 'יוֹם', transliteration: 'yôm', gloss: 'day', frequency: 2300, partOfSpeech: 'noun' },
  { hebrew: 'אִישׁ', transliteration: 'ʾîš', gloss: 'man, husband', frequency: 2160, partOfSpeech: 'noun' },
  { hebrew: 'אִשָּׁה', transliteration: 'ʾiššâ', gloss: 'woman, wife', frequency: 780, partOfSpeech: 'noun' },
  { hebrew: 'עִיר', transliteration: 'ʿîr', gloss: 'city', frequency: 1090, partOfSpeech: 'noun' },
  { hebrew: 'פָּנִים', root: 'פנה', transliteration: 'pānîm', gloss: 'face, presence', frequency: 2100, partOfSpeech: 'noun' },
  { hebrew: 'יָד', transliteration: 'yād', gloss: 'hand', frequency: 1600, partOfSpeech: 'noun' },
  { hebrew: 'עַם', root: 'עמם', transliteration: 'ʿam', gloss: 'people, nation', frequency: 1850, partOfSpeech: 'noun' },
  { hebrew: 'שָׁמַיִם', transliteration: 'šāmayim', gloss: 'heaven, sky', frequency: 420, partOfSpeech: 'noun' },
  { hebrew: 'דָּבָר', root: 'דבר', transliteration: 'dābār', gloss: 'word, thing, matter', frequency: 1400, partOfSpeech: 'noun' },
  { hebrew: 'עֶבֶד', root: 'עבד', transliteration: 'ʿebed', gloss: 'servant, slave', frequency: 800, partOfSpeech: 'noun' },
  { hebrew: 'שֵׁם', transliteration: 'šēm', gloss: 'name', frequency: 860, partOfSpeech: 'noun' },
  { hebrew: 'עַיִן', transliteration: 'ʿayin', gloss: 'eye, spring', frequency: 870, partOfSpeech: 'noun' },
  { hebrew: 'רֹאשׁ', transliteration: 'rōʾš', gloss: 'head, top, chief', frequency: 600, partOfSpeech: 'noun' },
  { hebrew: 'נֶפֶשׁ', transliteration: 'nepeš', gloss: 'soul, life, person, self', frequency: 750, partOfSpeech: 'noun' },
  { hebrew: 'קוֹל', transliteration: 'qôl', gloss: 'voice, sound', frequency: 500, partOfSpeech: 'noun' },
  { hebrew: 'לֵב', transliteration: 'lēb', gloss: 'heart, mind', frequency: 600, partOfSpeech: 'noun' },

  // Adjectives
  { hebrew: 'גָּדוֹל', root: 'גדל', transliteration: 'gādôl', gloss: 'great, big', frequency: 525, partOfSpeech: 'adjective' },
  { hebrew: 'טוֹב', root: 'טוב', transliteration: 'ṭôb', gloss: 'good', frequency: 530, partOfSpeech: 'adjective' },
  { hebrew: 'קָטֹן', root: 'קטן', transliteration: 'qāṭōn', gloss: 'small, young', frequency: 100, partOfSpeech: 'adjective' },
  { hebrew: 'רַע', root: 'רעע', transliteration: 'raʿ', gloss: 'evil, bad', frequency: 310, partOfSpeech: 'adjective' },

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
  { hebrew: 'קָרָא', root: 'קרא', transliteration: 'qārāʾ', gloss: 'he called, read, proclaimed', frequency: 730, partOfSpeech: 'verb', binyan: 'Qal' },
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
