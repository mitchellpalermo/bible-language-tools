import { describe, expect, it, vi } from 'vitest';

import {
  bdbStemNames,
  buildGlossIndex,
  buildLemmaIndex,
  createLemmaStats,
  GLOSS_LIMITS,
  headLemma,
  headLemmaIndex,
  headMorph,
  normalizeLemmaKey,
  nounGender,
  parseAugIndex,
  parseBdb,
  parseBdbEntry,
  parseBook,
  parseLexicalIndex,
  parseStrongGlosses,
  parseVerse,
  posOf,
  resolveGender,
  resolveRoot,
  splitMorph,
  stripCantillation,
  strongOf,
} from './oshb.mjs';

describe('stripCantillation', () => {
  it('removes accents but keeps consonants and nikud', () => {
    // בְּרֵאשִׁית with a tipcha, as the WLC writes it
    expect(stripCantillation('בְּרֵאשִׁ֖ית')).toBe('בְּרֵאשִׁית');
  });

  it('removes the stray accents that appear in lexicon headwords', () => {
    // LexicalIndex prints אַבְדָ֑ן with an etnahta on the headword
    expect(stripCantillation('אַבְדָ֑ן')).toBe('אַבְדָן');
  });

  it('leaves an unaccented form alone', () => {
    expect(stripCantillation('שָׁלוֹם')).toBe('שָׁלוֹם');
  });
});

describe('normalizeLemmaKey', () => {
  it('closes up the space in an augmented Strong number', () => {
    expect(normalizeLemmaKey('1121 a')).toBe('1121a');
  });

  it('drops the compound-name marker', () => {
    expect(normalizeLemmaKey('1035+')).toBe('1035');
  });

  it('leaves a plain number and a prefix letter alone', () => {
    expect(normalizeLemmaKey('430')).toBe('430');
    expect(normalizeLemmaKey('l')).toBe('l');
  });
});

describe('headLemma', () => {
  it('picks the numeric segment out of a prefixed stack', () => {
    expect(headLemma('c/1961')).toBe('1961');
    expect(headLemma('b/7704 b')).toBe('7704b');
    expect(headLemma('c/d/376')).toBe('376');
  });

  it('falls back to the last lettered segment when there is no numeric one', () => {
    // לוֹ — a preposition carrying a pronominal suffix; the preposition is the word
    expect(headLemma('l')).toBe('l');
    expect(headLemma('c/l')).toBe('l');
  });

  it('returns empty for an absent lemma', () => {
    expect(headLemma('')).toBe('');
  });

  it('reports the head position, so callers can tell prefixes apart', () => {
    expect(headLemmaIndex(['c', '1961'])).toBe(1);
    expect(headLemmaIndex(['c', 'l'])).toBe(1);
    expect(headLemmaIndex([])).toBe(-1);
  });
});

describe('splitMorph', () => {
  it('reads the language marker and drops it from the codes', () => {
    expect(splitMorph('HC/Vqw3ms')).toEqual({ language: 'heb', codes: ['C', 'Vqw3ms'] });
    expect(splitMorph('ANcmsd/Td')).toEqual({ language: 'arc', codes: ['Ncmsd', 'Td'] });
  });
});

describe('headMorph', () => {
  it('skips prefixes and lands on the stem', () => {
    expect(headMorph('HC/Vqw3ms')).toBe('Vqw3ms');
    expect(headMorph('HTd/Vqrmpa')).toBe('Vqrmpa');
    expect(headMorph('HRd/Ncbsa')).toBe('Ncbsa');
  });

  it('skips pronominal and other suffixes', () => {
    expect(headMorph('HC/Ncfsc/Sp3ms')).toBe('Ncfsc');
    expect(headMorph('HNcmpc/Sp3ms')).toBe('Ncmpc');
    expect(headMorph('HVqc/Sn')).toBe('Vqc');
  });

  it('treats a bare preposition with a suffix as the preposition', () => {
    expect(headMorph('HR/Sp3ms')).toBe('R');
    expect(headMorph('HC/R/Sp3ms')).toBe('R');
  });

  it('skips the postpositive Aramaic article', () => {
    // מַלְכָּא — the article follows the noun in Aramaic, so a "last non-suffix"
    // rule would call this an article rather than a noun
    expect(headMorph('ANcmsd/Td')).toBe('Ncmsd');
    expect(headMorph('AC/R/Ncmsd/Td')).toBe('Ncmsd');
  });

  it('returns the article when the word is only an article', () => {
    expect(headMorph('HTd')).toBe('Td');
  });

  it('returns empty for an absent morph', () => {
    expect(headMorph('')).toBe('');
  });
});

describe('posOf', () => {
  it('keeps two characters for the categories that subdivide', () => {
    expect(posOf('Ncmsa')).toBe('Nc');
    expect(posOf('Np')).toBe('Np');
    expect(posOf('Vqw3ms')).toBe('Vq');
    expect(posOf('Aamsa')).toBe('Aa');
    expect(posOf('Pp3ms')).toBe('Pp');
    expect(posOf('To')).toBe('To');
  });

  it('keeps one for the categories that do not', () => {
    expect(posOf('R')).toBe('R');
    expect(posOf('C')).toBe('C');
    expect(posOf('D')).toBe('D');
  });

  it('returns empty for an absent code', () => {
    expect(posOf('')).toBe('');
  });
});

describe('nounGender', () => {
  it('reads gender off a common-noun code', () => {
    expect(nounGender('Ncmsa')).toBe('m');
    expect(nounGender('Ncfpc')).toBe('f');
  });

  it('maps OSHB "both" and "common" onto fm', () => {
    expect(nounGender('Ncbsa')).toBe('fm');
    expect(nounGender('Nccsa')).toBe('fm');
  });

  it('is silent for codes that carry no lexical gender', () => {
    // proper nouns are coded without gender; adjectives agree rather than declare
    expect(nounGender('Np')).toBeUndefined();
    expect(nounGender('Aamsa')).toBeUndefined();
    expect(nounGender('Vqp3ms')).toBeUndefined();
    expect(nounGender('Nc')).toBeUndefined();
  });

  it('is silent rather than wrong about a gender code it does not know', () => {
    expect(nounGender('Ncxsa')).toBeUndefined();
  });
});

describe('resolveGender', () => {
  it('returns the single attested gender', () => {
    expect(resolveGender(['m', 'm', 'm'])).toBe('m');
    expect(resolveGender(['f'])).toBe('f');
  });

  it('returns fm for a word attested both ways', () => {
    expect(resolveGender(['m', 'f'])).toBe('fm');
    expect(resolveGender(['fm'])).toBe('fm');
    expect(resolveGender(['m', 'fm'])).toBe('fm');
  });

  it('returns undefined when nothing witnessed a gender', () => {
    expect(resolveGender([])).toBeUndefined();
  });
});

// ─── Verse parsing ───────────────────────────────────────────────────────────

describe('parseVerse', () => {
  it('reads text, head lemma, pos and the full morph string', () => {
    const words = parseVerse('<w lemma="c/1961" n="1.1.1" morph="HC/Vqw3ms" id="08xeN">וַ/יְהִ֗י</w>');
    expect(words).toEqual([{ text: 'וַ/יְהִ֗י', lemma: '1961', pos: 'Vq', parsing: 'HC/Vqw3ms' }]);
  });

  it('keeps the morpheme boundaries in the text', () => {
    const [word] = parseVerse('<w lemma="c/802" morph="HC/Ncfsc/Sp3ms">וְ/אִשְׁתּ֖/וֹ</w>');
    expect(word.text).toBe('וְ/אִשְׁתּ֖/וֹ');
  });

  it('unwraps markup nested inside a word', () => {
    // Deuteronomy 6:4 writes the ayin of שְׁמַע oversized
    const [word] = parseVerse('<w lemma="8085" morph="HVqv2ms">שְׁמַ֖<seg type="x-large">ע</seg></w>');
    expect(word.text).toBe('שְׁמַ֖ע');
  });

  it('hangs maqqef, paseq and sof pasuq on the word they follow', () => {
    const words = parseVerse(
      '<w lemma="8147" morph="HAcmdc">שְׁנֵֽי</w><seg type="x-maqqef">־</seg>' +
        '<w lemma="1121 a" morph="HNcmpc/Sp3ms">בָנָ֣י/ו</w><seg type="x-sof-pasuq">׃</seg>',
    );
    expect(words.map((w) => w.after)).toEqual(['־', '׃']);
  });

  it('ignores scribal section markers', () => {
    const words = parseVerse('<w lemma="430" morph="HNcmpa">אֱלֹהִים</w><seg type="x-samekh">ס</seg>');
    expect(words).toHaveLength(1);
    expect(words[0].after).toBeUndefined();
  });

  it('never treats a qere reading as a running-text word', () => {
    // The <w> inside a variant note is what is *read*, not what is written.
    // Scanning for <w> without excluding notes adds phantom words to the corpus.
    const words = parseVerse(
      '<w type="x-ketiv" lemma="3866" morph="HNp">לודיים</w>' +
        '<note type="variant"><catchWord>לודיים</catchWord>' +
        '<rdg type="x-qere"><w lemma="3866" morph="HNp">לוּדִ֧ים</w></rdg></note>',
    );
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({
      text: 'לודיים',
      ketiv: true,
      qere: 'לוּדִ֧ים',
    });
  });

  it('leaves qere unset when the note has none — written but not read', () => {
    const [word] = parseVerse(
      '<w type="x-ketiv" lemma="4994" morph="HTe">נא</w>' +
        '<note type="variant"><catchWord>נא</catchWord><rdg type="x-qere"/></note>',
    );
    expect(word.ketiv).toBe(true);
    expect(word.qere).toBeUndefined();
  });

  it('joins a multi-word qere into one reading', () => {
    const [word] = parseVerse(
      '<w type="x-ketiv" lemma="7890" morph="HNcmpc/Sp3mp">שיני/הם</w>' +
        '<note type="variant"><rdg type="x-qere">' +
        '<w lemma="4325" morph="HNcmpc">מימֵ֥י</w>' +
        '<w lemma="7272" morph="HNcfdc/Sp3mp">רַגְלֵי/הֶ֖ם</w></rdg></note>',
    );
    expect(word.qere).toBe('מימֵ֥י רַגְלֵי/הֶ֖ם');
  });

  it('inserts a qere that has no ketiv as its own word', () => {
    // 2 Kings 19:31 — צְבָאוֹת is read after יהוה but not written
    const words = parseVerse(
      '<w lemma="3068" morph="HNp">יְהוָ֥ה</w>' +
        '<note type="variant"><rdg type="x-qere">' +
        '<w lemma="6635 b" morph="HNcbpa">צְבָא֖וֹת</w></rdg></note>',
    );
    expect(words).toHaveLength(2);
    expect(words[1]).toMatchObject({ text: 'צְבָא֖וֹת', lemma: '6635b', qereOnly: true });
  });

  it('ignores notes that are not variants', () => {
    const words = parseVerse(
      '<w lemma="430" morph="HNcmpa">אֱלֹהִים</w>' +
        '<note type="exegesis">WLC has this word divided as <rdg>הָ/רֹאֶ֖ה</rdg>.</note>',
    );
    expect(words).toHaveLength(1);
  });
});

describe('parseBook', () => {
  const xml = `
    <osis><osisText><header><work osisWork="OSHB"/></header>
    <div type="book" osisID="Ruth">
      <chapter osisID="Ruth.1">
        <verse osisID="Ruth.1.1">
          <w lemma="c/1961" morph="HC/Vqw3ms">וַ/יְהִ֗י</w>
          <w lemma="b/3117" morph="HR/Ncmpc">בִּ/ימֵי֙</w><seg type="x-sof-pasuq">׃</seg>
        </verse>
        <verse osisID="Ruth.1.2">
          <w lemma="c/8034" morph="HC/Ncmsc">וְ/שֵׁ֣ם</w>
        </verse>
      </chapter>
      <chapter osisID="Ruth.2">
        <verse osisID="Ruth.2.1">
          <w lemma="l/5281" morph="HR/Np">לְ/נָעֳמִ֔י</w>
        </verse>
      </chapter>
    </div></osisText></osis>`;

  it('keys words by chapter and verse', () => {
    const book = parseBook(xml);
    expect(Object.keys(book)).toEqual(['1', '2']);
    expect(Object.keys(book['1'])).toEqual(['1', '2']);
    expect(book['1']['1']).toHaveLength(2);
    expect(book['2']['1'][0].lemma).toBe('5281');
  });

  it('ignores the header, which also contains <w> elements', () => {
    const book = parseBook(xml);
    const words = Object.values(book).flatMap((ch) => Object.values(ch).flat());
    expect(words).toHaveLength(4);
  });

  it('reports every lemma morpheme to the callback, prefixes included', () => {
    const onMorpheme = vi.fn();
    parseBook(xml, onMorpheme);
    const reported = onMorpheme.mock.calls.map(([key]) => key);
    expect(reported).toEqual(['c', '1961', 'b', '3117', 'c', '8034', 'l', '5281']);
  });

  it('marks only the head morpheme with its morph code', () => {
    const onMorpheme = vi.fn();
    parseVerse('<w lemma="c/802" morph="HC/Ncfsc/Sp3ms">וְ/אִשְׁתּ֖/וֹ</w>', onMorpheme);
    expect(onMorpheme.mock.calls).toEqual([
      ['c', undefined],
      ['802', 'Ncfsc'],
    ]);
  });

  it('counts a compound proper name once, not once per half', () => {
    // מִבֵּית לֶחֶם — both words are Strong's 1035; the `+` marks the first half
    const onMorpheme = vi.fn();
    parseVerse(
      '<w lemma="m/1035+" morph="HR/Np">מִ/בֵּ֧ית</w><w lemma="1035" morph="HNp">לֶ֣חֶם</w>',
      onMorpheme,
    );
    expect(onMorpheme.mock.calls.map(([key]) => key)).toEqual(['m', '1035']);
  });
});

// ─── Statistics and the lemma index ──────────────────────────────────────────

describe('createLemmaStats', () => {
  it('tallies occurrences and collects gender witnesses from heads only', () => {
    const { stats, record } = createLemmaStats();
    record('776', 'Ncbsa');
    record('776', 'Ncfsa');
    record('d', undefined);
    record('d', undefined);
    record('d', undefined);

    expect(stats.get('776').count).toBe(2);
    expect([...stats.get('776').genders]).toEqual(['fm', 'f']);
    expect(stats.get('d').count).toBe(3);
    expect(stats.get('d').genders.size).toBe(0);
  });

  it('ignores an empty key', () => {
    const { stats, record } = createLemmaStats();
    record('', 'Ncmsa');
    expect(stats.size).toBe(0);
  });
});

describe('the lexicon', () => {
  const augXml = `<index>
    <w aug="1">aac</w>
    <w aug="6">aaf</w>
    <w aug="9">aah</w>
  </index>`;

  const liXml = `<index>
    <part xml:lang="heb">
      <entry id="aac">
        <w xlit="ʾāb">אָב</w> <pos>N</pos> <def>father</def>
        <xref bdb="a.ae.ab" strong="1" twot="4a"/>
        <etym type="sub">aao</etym>
      </entry>
      <entry id="aaf">
        <w xlit="ʾābad">אָבַד</w> <pos>V</pos> <def>perish</def>
        <etym root="אבד" type="main">aag, aah</etym>
      </entry>
      <entry id="aah">
        <w xlit="ʾăbēdâ">אֲבֵדָ֑ה</w> <pos>N</pos>
        <etym type="sub">aaf</etym>
      </entry>
    </part>
  </index>`;

  it('maps augmented Strong numbers onto lexical index ids', () => {
    const aug = parseAugIndex(augXml);
    expect(aug.get('6')).toBe('aaf');
    expect(aug.size).toBe(3);
  });

  it('reads the headword, transliteration and part of speech', () => {
    const li = parseLexicalIndex(liXml);
    expect(li.get('aaf')).toMatchObject({ hebrew: 'אָבַד', xlit: 'ʾābad', pos: 'V' });
  });

  it('strips cantillation from lexicon headwords', () => {
    const li = parseLexicalIndex(liXml);
    expect(li.get('aah').hebrew).toBe('אֲבֵדָה');
  });

  it('resolves a derived entry’s root through its parent', () => {
    const li = parseLexicalIndex(liXml);
    expect(resolveRoot(li, 'aaf')).toBe('אבד');
    expect(resolveRoot(li, 'aah')).toBe('אבד');
  });

  it('gives up rather than looping when the chain leads nowhere', () => {
    const li = parseLexicalIndex(liXml);
    // aac points at aao, which this fixture does not define
    expect(resolveRoot(li, 'aac')).toBeUndefined();
    expect(resolveRoot(li, 'nope')).toBeUndefined();
  });

  describe('buildLemmaIndex', () => {
    const aug = parseAugIndex(augXml);
    const li = parseLexicalIndex(liXml);

    it('joins counts against the lexicon', () => {
      const { stats, record } = createLemmaStats();
      record('1', 'Ncmsa');
      record('1', 'Ncmsa');
      record('6', 'Vqp3ms');

      const { lemmas } = buildLemmaIndex(stats, aug, li);
      expect(lemmas['1']).toEqual({
        count: 2,
        hebrew: 'אָב',
        xlit: 'ʾāb',
        pos: 'N',
        gender: 'm',
      });
      expect(lemmas['6']).toEqual({
        count: 1,
        hebrew: 'אָבַד',
        xlit: 'ʾābad',
        pos: 'V',
        root: 'אבד',
      });
    });

    it('keeps the count for a lemma the lexicon cannot resolve, and reports it', () => {
      const { stats, record } = createLemmaStats();
      record('7451', 'Aamsa');
      record('7451', 'Aamsa');
      record('9999', 'Np');

      const { lemmas, unresolved } = buildLemmaIndex(stats, aug, li);
      expect(lemmas['7451']).toEqual({ count: 2 });
      // reported most-frequent first, and never guessed at: OSHB writes a few
      // homograph lemmas without their disambiguating letter
      expect(unresolved).toEqual([
        { lemma: '7451', count: 2 },
        { lemma: '9999', count: 1 },
      ]);
    });

    describe('glosses', () => {
      const glosses = new Map([
        ['1', 'father'],
        ['6', 'perish'],
      ]);

      it('joins a gloss on by the number the lemma key carries', () => {
        const { stats, record } = createLemmaStats();
        record('1', 'Ncmsa');
        record('6', 'Vqp3ms');

        const { lemmas } = buildLemmaIndex(stats, aug, li, glosses);
        expect(lemmas['1'].gloss).toBe('father');
        expect(lemmas['6'].gloss).toBe('perish');
      });

      // BDB splits a lexeme's senses where Strong's does not, so both halves
      // resolve to one entry and share its gloss. Frequency deliberately
      // behaves the other way: counts sum across sense splits, never across
      // homographs.
      it('gives both halves of a sense split the same gloss', () => {
        const { stats, record } = createLemmaStats();
        record('1a', 'Ncmsa');
        record('1b', 'Ncmsa');

        const { lemmas } = buildLemmaIndex(stats, aug, li, glosses);
        expect(lemmas['1a'].gloss).toBe('father');
        expect(lemmas['1b'].gloss).toBe('father');
      });

      it('reports what it could not gloss, most frequent first', () => {
        const { stats, record } = createLemmaStats();
        record('l', 'R');
        record('l', 'R');
        record('c', 'C');
        record('1', 'Ncmsa');

        const { lemmas, glossless } = buildLemmaIndex(stats, aug, li, glosses);
        expect(lemmas.l.gloss).toBeUndefined();
        expect(glossless).toEqual([
          { lemma: 'l', count: 2 },
          { lemma: 'c', count: 1 },
        ]);
      });

      it('carries no gloss at all when none is supplied', () => {
        const { stats, record } = createLemmaStats();
        record('1', 'Ncmsa');

        const { lemmas, glossless } = buildLemmaIndex(stats, aug, li);
        expect(lemmas['1'].gloss).toBeUndefined();
        expect(glossless).toEqual([{ lemma: '1', count: 1 }]);
      });
    });

    // The lexicon's own `<xref strong>` agrees with the key's digits for 9,240
    // of the 9,241 lemmas carrying both. The one disagreement is upstream news,
    // so it is reported rather than silently resolved either way.
    it('reports a lemma whose key and lexicon name different Strong’s numbers', () => {
      const conflicting = parseLexicalIndex(`<index><part>
        <entry id="aac">
          <w xlit="ʾāb">אָב</w> <pos>N</pos>
          <xref bdb="a.ae.ab" strong="2004"/>
        </entry>
      </part></index>`);
      const { stats, record } = createLemmaStats();
      record('1', 'Ncmsa');

      const { strongConflicts } = buildLemmaIndex(stats, aug, conflicting);
      expect(strongConflicts).toEqual([{ lemma: '1', lexicon: '2004' }]);
    });

    it('has nothing to report when the two agree', () => {
      const { stats, record } = createLemmaStats();
      record('1', 'Ncmsa');

      const { strongConflicts } = buildLemmaIndex(stats, aug, li);
      expect(strongConflicts).toEqual([]);
    });
  });
});

// ─── Strong's glosses ────────────────────────────────────────────────────────

describe('strongOf', () => {
  it('reads the number a lemma key carries', () => {
    expect(strongOf('1121a')).toBe('1121');
    expect(strongOf('853')).toBe('853');
    expect(strongOf('5892b')).toBe('5892');
  });

  // The inseparable prefixes are letter codes with no Strong's entry behind
  // them. They are glossed on the app side; see `src/lib/gloss.ts`.
  it('gives an inseparable prefix no number', () => {
    expect(strongOf('l')).toBeUndefined();
    expect(strongOf('c')).toBeUndefined();
  });
});

describe('parseStrongGlosses', () => {
  const xml = `<lexicon>
    <entry id="H1">
      <w pos="n-m" xlit="ʼâb">אָב</w>
      <source>a primitive word;</source>
      <meaning><def>father</def>, in a literal and immediate, or figurative and remote application</meaning>
      <usage>chief, (fore-) father(-less), × patrimony, principal. Compare names in 'Abi-'.</usage>
    </entry>
    <entry id="H2">
      <w pos="n-m" xlit="ʼab">אַב</w>
      <source>(Aramaic) corresponding to <w src="H1">1</w></source>
      <usage>father.</usage>
    </entry>
    <entry id="H6">
      <w pos="v" xlit="ʼâbad">אָבַד</w>
      <meaning>properly, to <def>wander</def> away, i.e. <def>lose</def> oneself; by implication to <def>perish</def> (causative, <def>destroy</def>)</meaning>
      <usage>break, destroy(-uction), not escape, fail.</usage>
    </entry>
    <entry id="H47">
      <w pos="a" xlit="ʼabbîyr">אַבִּיר</w>
      <usage>angel, bull, chiefest, mighty (one), stout(-hearted), strong (one), valiant.</usage>
    </entry>
    <entry id="H3390">
      <w pos="n-pr-loc" xlit="Yᵉrûwshâlêm">יְרוּשָׁלֵם</w>
      <source>(Aramaic) corresponding to <w src="H3389">3389</w></source>
    </entry>
    <entry id="H3389">
      <w pos="n-pr-loc" xlit="Yᵉrûwshâlaim">יְרוּשָׁלִַם</w>
      <meaning><def>Jerusalem</def>, the capital city of Palestine</meaning>
    </entry>
    <entry id="H9998">
      <w pos="n-m" xlit="nothing">נ</w>
      <source>of uncertain derivation</source>
    </entry>
  </lexicon>`;

  const glosses = parseStrongGlosses(xml);

  // `<usage>` is the KJV's translation words with all the apparatus attached.
  // Strong's marks the definitional words inside `<meaning>`, and lifting
  // exactly those out is the difference between "father" and
  // "chief, (fore-) father(-less), × patrimony, principal."
  it('takes the definition markers, not the KJV usage line', () => {
    expect(glosses.get('1')).toBe('father');
    expect(glosses.get('6')).toBe('wander, lose, perish, destroy');
  });

  it('falls back to usage for an entry with no meaning', () => {
    expect(glosses.get('2')).toBe('father');
  });

  it('trims a usage line down to something a popup can hold', () => {
    expect(glosses.get('47')).toBe('angel, bull, chiefest, mighty (one)');
  });

  // "(Aramaic) corresponding to H3389" is the whole entry for Aramaic
  // Jerusalem, a word a student reading Daniel will hover.
  it('follows a counterpart reference when the entry defines nothing itself', () => {
    expect(glosses.get('3390')).toBe('Jerusalem');
  });

  it('leaves an entry with nothing to say out entirely', () => {
    expect(glosses.has('9998')).toBe(false);
  });

  it('strips the cross-reference apparatus out of a usage line', () => {
    const stray = parseStrongGlosses(
      `<lexicon><entry id="H5"><usage>× stone, + wall. Compare 68.</usage></entry></lexicon>`,
    );
    expect(stray.get('5')).toBe('stone, wall');
  });

  it('does not repeat a word Strong’s defines twice', () => {
    const repeated = parseStrongGlosses(
      `<lexicon><entry id="H7"><meaning>to <def>go</def>, i.e. <def>go</def> out</meaning></entry></lexicon>`,
    );
    expect(repeated.get('7')).toBe('go');
  });
});

describe('parseStrongGlosses, degrading', () => {
  it('falls through to usage when a meaning marks no definitions', () => {
    const glosses = parseStrongGlosses(
      `<lexicon><entry id="H9">
        <meaning>see the note at the end of this article</meaning>
        <usage>bow, arrow.</usage>
      </entry></lexicon>`,
    );
    expect(glosses.get('9')).toBe('bow, arrow');
  });

  it('yields nothing rather than an empty string when a usage line is all apparatus', () => {
    const glosses = parseStrongGlosses(
      `<lexicon><entry id="H10"><usage>× + . Compare 11.</usage></entry></lexicon>`,
    );
    expect(glosses.has('10')).toBe(false);
  });

  it('leaves a counterpart unglossed when the entry it points at has none either', () => {
    const glosses = parseStrongGlosses(
      `<lexicon>
        <entry id="H11"><source>(Aramaic) corresponding to <w src="H12">12</w></source></entry>
        <entry id="H12"><source>of uncertain derivation</source></entry>
      </lexicon>`,
    );
    expect(glosses.has('11')).toBe(false);
  });
});

// ─── BDB ─────────────────────────────────────────────────────────────────────

// Excerpts of the pinned BrownDriverBriggs.xml, cut down but with the markup
// that matters left exactly as BDB writes it.
const BDB = {
  gam: `<w>גַּם</w> 768 <pos>adv</pos>. denoting <em>addition</em>, <def>also</def>, <def>moreover</def>, <def>yea</def>
    <status p="168">base</status>`,
  melakha: `<w>מְלָאכָה</w> 167 <pos>n.f</pos>. <def>occupation</def>, <def>work</def>
    <sense n="1"><def>occupation</def>, <def>business</def></sense>
    <sense n="3"><def>work</def> as something done or made</sense>`,
  qanah: `<w>קָנָה</w> 84 <pos>vb</pos>. <def>get</def>, <def>acquire</def>
    <sense><stem>Qal</stem> 81
      <sense n="1"><def>get</def>, <def>acquire</def> (all poet.)</sense>
      <sense n="2">elsewhere <def>buy</def></sense>
    </sense>
    <sense><stem>Niph</stem>. <def>be bought</def></sense>
    <sense><stem>Hiph</stem>. <def>caused</def> (one) <def>to purchase me</def>, i.e. <def>made me a bondman</def></sense>`,
  et: `<w>אֵת</w> the <def>mark of the accusative</def>, prefixed as a rule only to nouns that are <em>definite</em>`,
  chazaq: `<w>חָזַק</w> 291 <pos>vb</pos>. <def>be</def> or <def>grow firm</def>, <def>strong</def>, <def>strengthen</def>
    <sense><stem>Qal</stem>
      <sense n="I">intrans. <def>be</def> or <def>grow strong</def></sense>
      <sense n="II">transit. only <def>strengthened him not</def></sense>
    </sense>
    <sense><stem>Hiph</stem>.
      <sense n="1">
        <sense n="a"><def>make strong</def>, <def>strengthen</def></sense>
        <sense n="b"><def>make firm</def>, the kingdom</sense>
      </sense>
      <sense n="6">esp. <def>take</def> or <def>keep hold</def> of, <def>seize</def>, <def>grasp</def></sense>
    </sense>`,
  al: `<w>עַל</w>, <w>עָ֑ל</w>
    <sense n="I"><pos>subst</pos>. <def>height</def></sense>
    <sense n="II">As <pos>prep</pos>. <def>upon</def>, and hence <def>on the ground of</def>, <def>over</def>, <def>against</def></sense>`,
  halakh: `<w>הָלַךְ</w> 1554 <pos>vb</pos>. <def>go</def>, <def>come</def>, <def>walk</def>
    <sense><stem>Qal</stem>
      <sense n="I"><sense n="1">of things</sense><sense n="2">of men</sense></sense>
      <sense n="II"><sense n="1"><def>pass away</def>, <def>die</def></sense></sense>
    </sense>
    <sense><stem>Hiph</stem><sense n="1"><def>lead</def>, <def>bring</def></sense></sense>`,
  tsavah: `[<w>צָוָה</w>] 485 <pos>vb</pos>. <stem>Pi</stem>. <def>lay charge</def> (upon), <def>give charge</def> (to), <def>charge</def>`,
  nakhah: `<w>נָכָה</w> <pos>vb</pos>. <def>smite</def>
    <sense><stem>Niph</stem>. <def>and he shall be smitten</def>, <def>and die</def></sense>
    <sense><stem>Hiph</stem>. <sense n="1"><def>Smite</def>, <def>strike</def></sense><sense n="2"><def>smite</def></sense></sense>`,
  yisrael: `<w>יִשְׂרָאֵל</w> 2507 <pos>n.pr.m</pos>. et <pos>gent</pos>. <def>Israel</def> (<def>Ēl persisteth</def>, <def>persevereth</def>)
    <sense n="1"><pos>n.pr.m</pos>. second name of Jacob</sense>`,
  shaul: `<w>שָׁאוּל</w> <pos>n.pr.m</pos>. (= <def>asked</def>)
    <sense n="1">397 1st king of Isr.</sense>`,
  asher: `<w>אֲשֶׁר</w> <pos>part. of relation</pos> A <em>sign of relation</em>, bringing the clause into relation`,
};

describe('bdbStemNames', () => {
  it('maps BDB’s abbreviations onto the names the popup renders', () => {
    expect(bdbStemNames('Hiph')).toEqual(['Hiphil']);
    expect(bdbStemNames('Hithp')).toEqual(['Hithpael']);
    expect(bdbStemNames('Pe')).toEqual(['Peal']);
  });

  it('reads past a trailing period, a sense number and editorial brackets', () => {
    expect(bdbStemNames('Niph.')).toEqual(['Niphal']);
    expect(bdbStemNames('Qal 1')).toEqual(['Qal']);
    expect(bdbStemNames('Pi. 2')).toEqual(['Piel']);
    expect(bdbStemNames('[Qal]')).toEqual(['Qal']);
  });

  it('files one label under both stems where OSHB cuts the forms finer', () => {
    expect(bdbStemNames('Pō‛l')).toEqual(['Polel', 'Poel']);
    expect(bdbStemNames('Hithpa')).toEqual(['Hithpaal', 'Ithpaal']);
  });

  it('knows a mis-tagged noun sense is not a stem', () => {
    expect(bdbStemNames('n.[m.]')).toBeNull();
  });

  it('fails loudly on a label it does not know, rather than dropping the stem', () => {
    expect(() => bdbStemNames('Zzz')).toThrow(/not mapped/);
  });
});

describe('parseBdbEntry', () => {
  it('takes the head’s defs as the gloss — BDB’s first sense where Strong’s missed', () => {
    expect(parseBdbEntry(BDB.gam).gloss).toEqual(['also', 'moreover', 'yea']);
    expect(parseBdbEntry(BDB.melakha).gloss).toEqual(['occupation', 'work']);
    expect(parseBdbEntry(BDB.qanah).gloss).toEqual(['get', 'acquire']);
    expect(parseBdbEntry(BDB.et).gloss).toEqual(['mark of the accusative']);
  });

  it('joins defs that BDB tagged as pieces of one phrase', () => {
    // "<def>be</def> or <def>grow firm</def>" — a first-def rule reads "be"
    expect(parseBdbEntry(BDB.chazaq).gloss).toEqual(['be or grow firm', 'strong', 'strengthen']);
  });

  it('falls back to the first sense that has a def when the head has none', () => {
    expect(parseBdbEntry(BDB.al).gloss).toEqual(['height']);
  });

  it('drops a def inside parentheses, which is etymology rather than a gloss', () => {
    expect(parseBdbEntry(BDB.yisrael).gloss).toEqual(['Israel']);
    expect(parseBdbEntry(BDB.shaul).gloss).toEqual([]);
  });

  it('yields nothing for an entry that describes rather than glosses', () => {
    expect(parseBdbEntry(BDB.asher).gloss).toEqual([]);
  });

  it('files each stem’s senses under the popup’s stem names, in BDB’s order', () => {
    const { stems } = parseBdbEntry(BDB.chazaq);
    expect(stems.Hiphil).toEqual([
      ['make strong', 'strengthen'],
      ['make firm'],
      ['take or keep hold', 'seize', 'grasp'],
    ]);
    expect(stems.Qal).toEqual([['be or grow strong']]);
  });

  it('drops a stem sense that translates a cited phrase, and the whole of its sense', () => {
    const qanah = parseBdbEntry(BDB.qanah).stems;
    // "caused (one) to purchase me" — not "caused" left behind
    expect(qanah.Hiphil).toBeUndefined();
    expect(qanah.Niphal).toEqual([['be bought']]);
    // "and he shall be smitten, and die" — not "and die" left behind
    expect(parseBdbEntry(BDB.nakhah).stems.Niphal).toBeUndefined();
  });

  it('lowercases a capitalized sense opener and drops a repeated sense', () => {
    expect(parseBdbEntry(BDB.nakhah).stems.Hiphil).toEqual([['smite', 'strike']]);
  });

  it('stands the head in for a Qal whose first sense is bare', () => {
    // The file is abridged: Qal I carries no defs, and the first def under Qal
    // is sense II's "pass away, die".
    const { stems } = parseBdbEntry(BDB.halakh);
    expect(stems.Qal[0]).toEqual(['go', 'come', 'walk']);
    expect(stems.Qal[1]).toEqual(['pass away', 'die']);
    expect(stems.Hiphil).toEqual([['lead', 'bring']]);
  });

  it('reads a single-stem verb that names its stem in the head', () => {
    const { gloss, stems } = parseBdbEntry(BDB.tsavah);
    expect(gloss).toEqual(['lay charge', 'give charge', 'charge']);
    expect(stems).toEqual({ Piel: [['lay charge', 'give charge', 'charge']] });
  });

  it('keeps every def it saw, for checking pins against', () => {
    expect(parseBdbEntry(BDB.al).defs).toEqual(
      new Set(['height', 'upon', 'on the ground of', 'over', 'against']),
    );
  });

  it('decodes entities and skips a noun sense tagged as a stem', () => {
    const entry = parseBdbEntry(
      `<w>x</w> <def>sin &amp; guilt</def><sense><stem>n.[m.]</stem> <def>a thing</def></sense>`,
    );
    expect(entry.gloss).toEqual(['sin & guilt']);
    expect(entry.stems).toEqual({});
  });

  it('ignores defs after the last sense, which comment on the whole entry', () => {
    const entry = parseBdbEntry(
      `<w>x</w><sense n="1">a <em>b</em></sense> cf. <def>trailing note</def>`,
    );
    expect(entry.gloss).toEqual([]);
    expect(entry.defs.has('trailing note')).toBe(true);
  });
});

describe('parseBdb', () => {
  it('keys every entry by its id', () => {
    const bdb = parseBdb(
      `<lexicon><part id="c" xml:lang="heb"><section id="c.ck">
        <entry id="c.ck.ab">${BDB.gam}</entry>
        <entry id="s.cb.aa" type="root" mod="I">${BDB.qanah}</entry>
      </section></part></lexicon>`,
    );
    expect([...bdb.keys()]).toEqual(['c.ck.ab', 's.cb.aa']);
    expect(bdb.get('s.cb.aa').gloss).toEqual(['get', 'acquire']);
  });
});

describe('buildGlossIndex', () => {
  const aug = parseAugIndex(`<index>
    <w aug="1571">clf</w>
    <w aug="5921a">jkq</w>
    <w aug="5921b">jkr</w>
    <w aug="2388">dsn</w>
    <w aug="3478">fmf</w>
    <w aug="7586">mfm</w>
    <w aug="834a">bjs</w>
    <w aug="c">zzz</w>
  </index>`);
  const li = parseLexicalIndex(`<index>
    <entry id="clf"><w>גַּם</w><xref bdb="c.ck.ab" strong="1571"/></entry>
    <entry id="jkq"><w>עַל</w><xref bdb="p.cs.ar" strong="5921"/></entry>
    <entry id="jkr"><w>עַל</w><xref bdb="p.cs.zz" strong="5921"/></entry>
    <entry id="dsn"><w>חָזַק</w><xref bdb="h.bs.aa" strong="2388"/></entry>
    <entry id="fmf"><w>יִשְׂרָאֵל</w><xref bdb="u.ce.ab" strong="3478"/></entry>
    <entry id="mfm"><w>שָׁאוּל</w><xref bdb="v.ag.ac" strong="7586"/></entry>
    <entry id="bjs"><w>אֲשֶׁר</w><xref bdb="a.gk.aa" strong="834"/></entry>
    <entry id="zzz"><w>וְ</w><xref bdb="w.aa.aa"/></entry>
  </index>`);
  const bdb = new Map([
    ['c.ck.ab', parseBdbEntry(BDB.gam)],
    ['p.cs.ar', parseBdbEntry(BDB.al)],
    // The other עַל — what a lookup by bare Strong's number can land on.
    ['p.cs.zz', parseBdbEntry('<w>עַל</w> <def>forasmuch as</def>')],
    ['h.bs.aa', parseBdbEntry(BDB.chazaq)],
    ['u.ce.ab', parseBdbEntry(BDB.yisrael)],
    ['v.ag.ac', parseBdbEntry(BDB.shaul)],
    ['a.gk.aa', parseBdbEntry(BDB.asher)],
    ['w.aa.aa', parseBdbEntry('<w>וְ</w> <def>so</def>, <def>then</def>')],
  ]);
  const lemmas = {
    1571: { count: 769, pos: 'D', gloss: 'assemblage, also' },
    '5921a': { count: 5764, pos: 'R' },
    2388: { count: 290, pos: 'V' },
    3478: { count: 2506, pos: 'Np', xlit: 'yiśrāʾēl' },
    7586: { count: 406, pos: 'Np', xlit: 'šāʾûl', gloss: 'Shaul' },
    '834a': { count: 4954, pos: 'T', gloss: 'who, which, what, that, when' },
    9999: { count: 1, pos: 'N' },
    c: { count: 50992, pos: 'C' },
  };

  it('glosses through the exact augmented key, never the bare Strong’s number', () => {
    const { glosses } = buildGlossIndex(lemmas, aug, li, bdb);
    expect(glosses['5921a'].g).toEqual(['height']);
    expect(glosses['1571'].g).toEqual(['also', 'moreover', 'yea']);
  });

  it('carries a verb’s stem senses, trimmed to the limits', () => {
    const { glosses } = buildGlossIndex(lemmas, aug, li, bdb);
    expect(glosses['2388'].s.Hiphil).toHaveLength(3);
    for (const senses of Object.values(glosses['2388'].s)) {
      expect(senses.length).toBeLessThanOrEqual(GLOSS_LIMITS.senses);
      for (const items of senses) expect(items.length).toBeLessThanOrEqual(GLOSS_LIMITS.senseItems);
    }
    expect(glosses['2388'].s.Hiphil[2]).toEqual(['take or keep hold', 'seize']);
    expect(glosses['1571'].s).toBeUndefined();
  });

  it('gives a name BDB’s English, then the transliteration — never Strong’s', () => {
    const { glosses } = buildGlossIndex(lemmas, aug, li, bdb);
    expect(glosses['3478'].g).toEqual(['Israel']);
    expect(glosses['7586'].g).toEqual(['šāʾûl']);
  });

  it('falls back to Strong’s, trimmed, where BDB describes rather than glosses', () => {
    const { glosses, sources } = buildGlossIndex(lemmas, aug, li, bdb);
    expect(glosses['834a'].g).toEqual(['who', 'which', 'what']);
    expect(sources.strong.map((s) => s.lemma)).toEqual(['834a']);
  });

  it('leaves the inseparable prefixes to gloss.ts', () => {
    const { glosses } = buildGlossIndex(lemmas, aug, li, bdb);
    expect(glosses.c).toBeUndefined();
  });

  it('reports a lemma with no BDB entry, and writes nothing for one with no gloss at all', () => {
    const { glosses, noEntry, sources } = buildGlossIndex(lemmas, aug, li, bdb);
    expect(noEntry).toEqual([{ lemma: '9999', count: 1 }]);
    expect(sources.none).toEqual([{ lemma: '9999', count: 1 }]);
    expect(glosses['9999']).toBeUndefined();
  });

  it('sorts each report by frequency', () => {
    const { sources } = buildGlossIndex(lemmas, aug, li, bdb);
    expect(sources.bdb.map((s) => s.lemma)).toEqual(['5921a', '3478', '1571', '2388']);
  });

  describe('pins', () => {
    it('replaces the head with defs the entry carries', () => {
      const pins = { '5921a': { gloss: ['upon', 'over', 'against'] } };
      const { glosses, sources } = buildGlossIndex(lemmas, aug, li, bdb, pins);
      expect(glosses['5921a'].g).toEqual(['upon', 'over', 'against']);
      expect(sources.pin.map((s) => s.lemma)).toEqual(['5921a']);
    });

    it('puts a pinned stem sense first and keeps the entry’s others after it', () => {
      const pins = { 2388: { stems: { Hiphil: ['seize'] } } };
      const { glosses, sources } = buildGlossIndex(lemmas, aug, li, bdb, pins);
      expect(glosses['2388'].s.Hiphil[0]).toEqual(['seize']);
      expect(glosses['2388'].s.Hiphil[1]).toEqual(['make strong', 'strengthen']);
      // A stem-only pin leaves the head as BDB wrote it.
      expect(sources.pin).toEqual([]);
    });

    it('fails the build on a pinned def the entry does not carry', () => {
      const pins = { '5921a': { gloss: ['upon', 'atop'] } };
      expect(() => buildGlossIndex(lemmas, aug, li, bdb, pins)).toThrow(/5921a.*atop/);
      const stems = { 2388: { stems: { Qal: ['be mighty'] } } };
      expect(() => buildGlossIndex(lemmas, aug, li, bdb, stems)).toThrow(/be mighty/);
    });

    it('fails on a pin for a lemma that reaches no entry', () => {
      expect(() => buildGlossIndex(lemmas, aug, li, bdb, { 9999: { gloss: ['x'] } })).toThrow(
        /9999/,
      );
    });
  });
});

describe('the parseLexicalIndex BDB link', () => {
  it('reads the BDB id off the cross-reference', () => {
    const li = parseLexicalIndex(
      `<index><entry id="aac"><w>אָב</w><xref bdb="a.ae.ab" strong="1"/></entry></index>`,
    );
    expect(li.get('aac').bdb).toBe('a.ae.ab');
  });
});
