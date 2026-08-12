/**
 * The 39 books of the Hebrew Bible, in Tanakh order.
 *
 * `file` is the name morphhb uses in `wlc/`; `code` is the Paratext/USFM code the
 * app routes and filenames use (`?ref=GEN.1`, `public/data/morphhb/GEN.json`).
 *
 * The order is the Hebrew Bible's own — Torah, Nevi'im, Ketuvim — not the
 * Christian Old Testament's. A UI that wants the other order can re-sort from
 * `code`, but the `section` grouping is not recoverable from a re-sorted list,
 * so it is recorded here rather than inferred later.
 */
export const BOOKS = [
  { file: 'Gen', code: 'GEN', name: 'Genesis', hebrew: 'בְּרֵאשִׁית', section: 'torah' },
  { file: 'Exod', code: 'EXO', name: 'Exodus', hebrew: 'שְׁמוֹת', section: 'torah' },
  { file: 'Lev', code: 'LEV', name: 'Leviticus', hebrew: 'וַיִּקְרָא', section: 'torah' },
  { file: 'Num', code: 'NUM', name: 'Numbers', hebrew: 'בְּמִדְבַּר', section: 'torah' },
  { file: 'Deut', code: 'DEU', name: 'Deuteronomy', hebrew: 'דְּבָרִים', section: 'torah' },

  { file: 'Josh', code: 'JOS', name: 'Joshua', hebrew: 'יְהוֹשֻׁעַ', section: 'neviim' },
  { file: 'Judg', code: 'JDG', name: 'Judges', hebrew: 'שׁוֹפְטִים', section: 'neviim' },
  { file: '1Sam', code: '1SA', name: '1 Samuel', hebrew: 'שְׁמוּאֵל א', section: 'neviim' },
  { file: '2Sam', code: '2SA', name: '2 Samuel', hebrew: 'שְׁמוּאֵל ב', section: 'neviim' },
  { file: '1Kgs', code: '1KI', name: '1 Kings', hebrew: 'מְלָכִים א', section: 'neviim' },
  { file: '2Kgs', code: '2KI', name: '2 Kings', hebrew: 'מְלָכִים ב', section: 'neviim' },
  { file: 'Isa', code: 'ISA', name: 'Isaiah', hebrew: 'יְשַׁעְיָהוּ', section: 'neviim' },
  { file: 'Jer', code: 'JER', name: 'Jeremiah', hebrew: 'יִרְמְיָהוּ', section: 'neviim' },
  { file: 'Ezek', code: 'EZK', name: 'Ezekiel', hebrew: 'יְחֶזְקֵאל', section: 'neviim' },
  { file: 'Hos', code: 'HOS', name: 'Hosea', hebrew: 'הוֹשֵׁעַ', section: 'neviim' },
  { file: 'Joel', code: 'JOL', name: 'Joel', hebrew: 'יוֹאֵל', section: 'neviim' },
  { file: 'Amos', code: 'AMO', name: 'Amos', hebrew: 'עָמוֹס', section: 'neviim' },
  { file: 'Obad', code: 'OBA', name: 'Obadiah', hebrew: 'עֹבַדְיָה', section: 'neviim' },
  { file: 'Jonah', code: 'JON', name: 'Jonah', hebrew: 'יוֹנָה', section: 'neviim' },
  { file: 'Mic', code: 'MIC', name: 'Micah', hebrew: 'מִיכָה', section: 'neviim' },
  { file: 'Nah', code: 'NAH', name: 'Nahum', hebrew: 'נַחוּם', section: 'neviim' },
  { file: 'Hab', code: 'HAB', name: 'Habakkuk', hebrew: 'חֲבַקּוּק', section: 'neviim' },
  { file: 'Zeph', code: 'ZEP', name: 'Zephaniah', hebrew: 'צְפַנְיָה', section: 'neviim' },
  { file: 'Hag', code: 'HAG', name: 'Haggai', hebrew: 'חַגַּי', section: 'neviim' },
  { file: 'Zech', code: 'ZEC', name: 'Zechariah', hebrew: 'זְכַרְיָה', section: 'neviim' },
  { file: 'Mal', code: 'MAL', name: 'Malachi', hebrew: 'מַלְאָכִי', section: 'neviim' },

  { file: 'Ps', code: 'PSA', name: 'Psalms', hebrew: 'תְּהִלִּים', section: 'ketuvim' },
  { file: 'Prov', code: 'PRO', name: 'Proverbs', hebrew: 'מִשְׁלֵי', section: 'ketuvim' },
  { file: 'Job', code: 'JOB', name: 'Job', hebrew: 'אִיּוֹב', section: 'ketuvim' },
  { file: 'Song', code: 'SNG', name: 'Song of Songs', hebrew: 'שִׁיר הַשִּׁירִים', section: 'ketuvim' },
  { file: 'Ruth', code: 'RUT', name: 'Ruth', hebrew: 'רוּת', section: 'ketuvim' },
  { file: 'Lam', code: 'LAM', name: 'Lamentations', hebrew: 'אֵיכָה', section: 'ketuvim' },
  { file: 'Eccl', code: 'ECC', name: 'Ecclesiastes', hebrew: 'קֹהֶלֶת', section: 'ketuvim' },
  { file: 'Esth', code: 'EST', name: 'Esther', hebrew: 'אֶסְתֵּר', section: 'ketuvim' },
  { file: 'Dan', code: 'DAN', name: 'Daniel', hebrew: 'דָּנִיֵּאל', section: 'ketuvim' },
  { file: 'Ezra', code: 'EZR', name: 'Ezra', hebrew: 'עֶזְרָא', section: 'ketuvim' },
  { file: 'Neh', code: 'NEH', name: 'Nehemiah', hebrew: 'נְחֶמְיָה', section: 'ketuvim' },
  { file: '1Chr', code: '1CH', name: '1 Chronicles', hebrew: 'דִּבְרֵי הַיָּמִים א', section: 'ketuvim' },
  { file: '2Chr', code: '2CH', name: '2 Chronicles', hebrew: 'דִּבְרֵי הַיָּמִים ב', section: 'ketuvim' },
];
