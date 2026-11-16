import { describe, expect, it } from 'vitest';
import {
  STEM_NAME_LABELS,
  STEM_NAMES,
  STEM_PATTERNS,
  STEM_ROOTS,
  stemColumnId,
} from './stem-patterns';
import { answerForm } from './verb-paradigms';

describe('stem patterns (Table 20.1)', () => {
  it('names the seven stems in textbook order', () => {
    expect(STEM_NAMES.map((s) => STEM_NAME_LABELS[s])).toEqual([
      'Qal',
      'Niphal',
      'Piel',
      'Pual',
      'Hithpael',
      'Hiphil',
      'Hophal',
    ]);
  });

  it('has a form for every stem on both roots', () => {
    for (const { id } of STEM_ROOTS) {
      expect(Object.keys(STEM_PATTERNS[id]).sort()).toEqual([...STEM_NAMES].sort());
    }
  });

  it('stores NFC forms with no stress mark, so the key is what is graded', () => {
    for (const { id } of STEM_ROOTS) {
      for (const form of Object.values(STEM_PATTERNS[id])) {
        expect(form).toBe(form.normalize('NFC'));
        expect(form).toBe(answerForm(form));
      }
    }
  });

  it('gives no two stems the same form on one root', () => {
    for (const { id } of STEM_ROOTS) {
      const forms = Object.values(STEM_PATTERNS[id]);
      expect(new Set(forms).size).toBe(forms.length);
    }
  });

  it('writes each stem on a root with the root letters in the same slots', () => {
    // The two columns differ only in the radicals: פ/ק, ע/ט, ל/ל.
    const swap = (form: string) => form.replaceAll('פ', 'ק').replaceAll('ע', 'ט');
    for (const stem of STEM_NAMES) {
      const consonants = (f: string) => f.replace(/[֑-ׇ]/g, '');
      expect(consonants(swap(STEM_PATTERNS.pel[stem]))).toBe(consonants(STEM_PATTERNS.qtl[stem]));
    }
  });

  it('builds a stable column id', () => {
    expect(stemColumnId('pel')).toBe('stem-pattern-pel');
  });
});
