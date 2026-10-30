import { describe, expect, it } from 'vitest';
import { hasCorpus, isAttested } from '../test/corpus';
import {
  allSuffixParadigms,
  BARE_SUFFIXES,
  getSuffixParadigm,
  HEAVY_SUFFIXES,
  SUFFIX_PGNS,
  SUFFIX_RULES,
  suffixParadigmId,
} from './pronominal-suffixes';
import { answerForm } from './verb-paradigms';

const FORM_CHARS = /^[א-תְ-ּׁׂ]+$/;

/**
 * Regular forms the Bible does not happen to use: the feminine and plural-owner
 * cells of a noun are rarely addressed. A new entry is what a typo looks like.
 */
const UNATTESTED = new Set([
  'suffix-type1-dabar:2fs',
  'suffix-type1-dabar:3fs',
  'suffix-type1-dabar:2mp',
  'suffix-type1-dabar:2fp',
  'suffix-type1-dabar:3mp',
  'suffix-type1-dabar:3fp',
  'suffix-type2-dabarim:2fs',
  'suffix-type2-dabarim:1cp',
  'suffix-type2-dabarim:2fp',
  'suffix-type2-dabarim:3fp',
  'suffix-type1-hokmah:3fs',
  'suffix-type1-hokmah:1cp',
  'suffix-type1-hokmah:2fp',
  'suffix-type1-hokmah:3fp',
  'suffix-type1-hokmah:2fs',
  // The ladder's nouns (#186). סוּס is the textbook's model of a stem that never
  // changes, and the text barely suffixes it; עַמִּים is rarer with suffixes
  // than עַם. Both are kept because the stem test below checks every one of
  // these cells letter by letter against the bare suffixes, which the corpus
  // cannot do for a form it never saw.
  'suffix-type1-sus:2ms',
  'suffix-type1-sus:2fs',
  'suffix-type1-sus:3ms',
  'suffix-type1-sus:3fs',
  'suffix-type1-sus:1cp',
  'suffix-type1-sus:2mp',
  'suffix-type1-sus:2fp',
  'suffix-type1-sus:3mp',
  'suffix-type1-sus:3fp',
  'suffix-type2-susim:1cs',
  'suffix-type2-susim:2fs',
  'suffix-type2-susim:3fs',
  'suffix-type2-susim:1cp',
  'suffix-type2-susim:2fp',
  'suffix-type2-susim:3fp',
  'suffix-type1-melek:2fp',
  'suffix-type1-melek:3fp',
  'suffix-type2-melakim:1cs',
  'suffix-type2-melakim:2ms',
  'suffix-type2-melakim:2fs',
  'suffix-type2-melakim:3ms',
  'suffix-type2-melakim:2fp',
  'suffix-type2-melakim:3fp',
  'suffix-type1-am:2mp',
  'suffix-type1-am:2fp',
  'suffix-type1-am:3fp',
  'suffix-type2-ammim:1cs',
  'suffix-type2-ammim:2fs',
  'suffix-type2-ammim:1cp',
  'suffix-type2-ammim:2mp',
  'suffix-type2-ammim:2fp',
  'suffix-type2-ammim:3mp',
  'suffix-type2-ammim:3fp',
]);

/**
 * What each noun's suffixes attach to: the stem before a light suffix, and
 * before a heavy one (`HEAVY_SUFFIXES`), where a changeable vowel reduces.
 * Every form in the file must be exactly stem + bare suffix.
 */
const STEMS: Record<string, { light: string; heavy: string }> = {
  'suffix-type1-dabar': { light: 'דְּבָר', heavy: 'דְּבַר' },
  'suffix-type2-dabarim': { light: 'דְּבָר', heavy: 'דִּבְר' },
  'suffix-type1-hokmah': { light: 'חָכְמָת', heavy: 'חָכְמַת' },
  'suffix-type1-sus': { light: 'סוּס', heavy: 'סוּס' },
  'suffix-type2-susim': { light: 'סוּס', heavy: 'סוּס' },
  'suffix-type1-melek': { light: 'מַלְכּ', heavy: 'מַלְכּ' },
  'suffix-type2-melakim': { light: 'מְלָכ', heavy: 'מַלְכ' },
  'suffix-type1-am': { light: 'עַמּ', heavy: 'עַמּ' },
  'suffix-type2-ammim': { light: 'עַמּ', heavy: 'עַמּ' },
};

describe('noun suffix paradigms', () => {
  it('has unique ids built from set and noun, and a lookup', () => {
    expect(new Set(allSuffixParadigms.map((p) => p.id)).size).toBe(allSuffixParadigms.length);
    expect(getSuffixParadigm('suffix-type1-melek')?.lemma).toBe('מֶלֶךְ');
    expect(suffixParadigmId('type1', 'dabar')).toBe('suffix-type1-dabar');
    expect(getSuffixParadigm('suffix-type1-dabar')?.lemma).toBe('דָּבָר');
    expect(getSuffixParadigm('nope')).toBeUndefined();
  });

  it('gives every paradigm exactly the ten suffix persons', () => {
    for (const p of allSuffixParadigms) {
      expect(Object.keys(p.forms).sort(), p.id).toEqual([...SUFFIX_PGNS].sort());
    }
  });

  it('stores every form in NFC, letters and points only', () => {
    for (const p of allSuffixParadigms) {
      for (const [pgn, form] of Object.entries(p.forms)) {
        expect(form, `${p.id} ${pgn}`).toBe(form.normalize('NFC'));
        expect(form, `${p.id} ${pgn}`).toMatch(FORM_CHARS);
        expect(answerForm(form)).toBe(form);
      }
    }
  });

  it('rule: every Type 2 suffix contains a yod', () => {
    for (const [pgn, suffix] of Object.entries(BARE_SUFFIXES.type2)) {
      expect(suffix, pgn).toContain('י');
    }
    expect(SUFFIX_RULES.map((r) => r.id)).toContain('type2-yod');
  });

  it('stores the bare suffixes in NFC, each opening with a mark or a vav', () => {
    for (const set of ['type1', 'type2'] as const) {
      expect(Object.keys(BARE_SUFFIXES[set]).sort()).toEqual([...SUFFIX_PGNS].sort());
      for (const [pgn, suffix] of Object.entries(BARE_SUFFIXES[set])) {
        expect(suffix, `${set} ${pgn}`).toBe(suffix.normalize('NFC'));
        expect(suffix, `${set} ${pgn}`).toMatch(/^[ְ-ׇו]/);
      }
    }
  });

  it('builds every form as its stem plus the bare suffix, heavy suffixes on the reduced stem', () => {
    expect(Object.keys(STEMS).sort()).toEqual(allSuffixParadigms.map((p) => p.id).sort());
    for (const p of allSuffixParadigms) {
      for (const pgn of SUFFIX_PGNS) {
        const { light, heavy } = STEMS[p.id];
        const stem = HEAVY_SUFFIXES[p.set].includes(pgn) ? heavy : light;
        const built = (stem + BARE_SUFFIXES[p.set][pgn]).normalize('NFC');
        expect(p.forms[pgn], `${p.id} ${pgn}`).toBe(built);
      }
    }
  });

  it('rule: a masculine plural drops ־ִים for ־ֵי before heavy Type 2 suffixes', () => {
    const p = getSuffixParadigm('suffix-type2-dabarim');
    for (const pgn of ['2mp', '2fp', '3mp', '3fp'] as const) {
      expect(p?.forms[pgn]).toContain('ֵי');
      expect(p?.forms[pgn]).not.toContain('ִים');
    }
  });

  it('rule: a feminine singular ־ָה becomes ת before every Type 1 suffix', () => {
    const p = getSuffixParadigm('suffix-type1-hokmah');
    for (const [pgn, form] of Object.entries(p?.forms ?? {})) {
      expect(form, pgn).toMatch(/^חָכְמ[ַָ]ת/);
    }
  });

  it.skipIf(!hasCorpus)('attests every form the Bible uses', () => {
    for (const p of allSuffixParadigms) {
      for (const [pgn, form] of Object.entries(p.forms)) {
        if (UNATTESTED.has(`${p.id}:${pgn}`)) continue;
        expect(isAttested(form), `${p.id} ${pgn} ${form}`).toBe(true);
      }
    }
  });
});
