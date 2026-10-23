import { describe, expect, it } from 'vitest';
import { hasCorpus, isAttested } from '../test/corpus';
import {
  getSuffixParadigm,
  SUFFIX_PGNS,
  SUFFIX_RULES,
  suffixParadigmId,
  suffixParadigms,
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
]);

describe('suffixParadigms', () => {
  it('has unique ids built from set and noun, and a lookup', () => {
    expect(new Set(suffixParadigms.map((p) => p.id)).size).toBe(suffixParadigms.length);
    expect(suffixParadigmId('type1', 'dabar')).toBe('suffix-type1-dabar');
    expect(getSuffixParadigm('suffix-type1-dabar')?.lemma).toBe('דָּבָר');
    expect(getSuffixParadigm('nope')).toBeUndefined();
  });

  it('gives every paradigm exactly the ten suffix persons', () => {
    for (const p of suffixParadigms) {
      expect(Object.keys(p.forms).sort(), p.id).toEqual([...SUFFIX_PGNS].sort());
    }
  });

  it('stores every form in NFC, letters and points only', () => {
    for (const p of suffixParadigms) {
      for (const [pgn, form] of Object.entries(p.forms)) {
        expect(form, `${p.id} ${pgn}`).toBe(form.normalize('NFC'));
        expect(form, `${p.id} ${pgn}`).toMatch(FORM_CHARS);
        expect(answerForm(form)).toBe(form);
      }
    }
  });

  it('rule: every Type 2 suffix contains a yod after the noun’s last radical', () => {
    for (const p of suffixParadigms.filter((q) => q.set === 'type2')) {
      for (const [pgn, form] of Object.entries(p.forms)) {
        const ending = form.slice(form.lastIndexOf('ר') + 1);
        expect(ending, `${p.id} ${pgn}`).toContain('י');
      }
    }
    expect(SUFFIX_RULES.map((r) => r.id)).toContain('type2-yod');
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
      expect(form, pgn).toMatch(/^חָכְמ[ַָ]ת/);
    }
  });

  it.skipIf(!hasCorpus)('attests every form the Bible uses', () => {
    for (const p of suffixParadigms) {
      for (const [pgn, form] of Object.entries(p.forms)) {
        if (UNATTESTED.has(`${p.id}:${pgn}`)) continue;
        expect(isAttested(form), `${p.id} ${pgn} ${form}`).toBe(true);
      }
    }
  });
});
