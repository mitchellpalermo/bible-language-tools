import { describe, expect, it } from 'vitest';
import { hasCorpus, isAttested } from '../test/corpus';
import { positionOf, SHIFT_ITEMS, SHIFT_RULES, type ShiftRuleId } from './accent-shift';

describe('the item pool', () => {
  it('has unique ids, since they are SRS keys', () => {
    const ids = SHIFT_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(
    SHIFT_ITEMS.map((i) => [i.id, i] as const),
  )('%s: its syllables join to its form', (_, item) => {
    expect(item.syllables.map((s) => s.text).join('')).toBe(item.form);
  });

  it.each(
    SHIFT_ITEMS.map((i) => [i.id, i] as const),
  )('%s: the accented syllable is ruled by "accented-full" and no other is', (_, item) => {
    item.syllables.forEach((s, i) => {
      expect(s.rule === 'accented-full').toBe(i === item.accent);
    });
  });

  it('starts with the Grammar page’s model nouns', () => {
    const bases = new Set(SHIFT_ITEMS.map((i) => i.base));
    for (const noun of ['דָּבָר', 'זָקֵן', 'צְדָקָה']) expect(bases).toContain(noun);
  });

  it('covers all three kinds of ending', () => {
    expect(new Set(SHIFT_ITEMS.map((i) => i.endingKind))).toEqual(
      new Set(['plural', 'light-suffix', 'heavy-suffix']),
    );
  });

  it('uses every vowel rule on some syllable', () => {
    const used = new Set(SHIFT_ITEMS.flatMap((i) => i.syllables.map((s) => s.rule)));
    const vowelRules: ShiftRuleId[] = [
      'accented-full',
      'closed-unaccented-short',
      'open-pretonic-long',
      'open-distant-reduces',
      'unchangeable-long',
      'pretonic-reduces-instead',
    ];
    for (const rule of vowelRules) expect(used).toContain(rule);
  });

  it('draws an ending on a dotted circle only when it begins with a point', () => {
    for (const { ending } of SHIFT_ITEMS) {
      const startsWithPoint = /^[\u05B0-\u05C7]/.test(ending.replace('◌', ''));
      expect(ending.startsWith('◌')).toBe(startsWithPoint);
    }
  });

  it('links every rule to a section of /grammar', () => {
    for (const rule of Object.values(SHIFT_RULES)) {
      expect(rule.href).toMatch(/^\/grammar#(nouns|vowels)$/);
    }
  });
});

describe('positionOf', () => {
  it('names the accented, pretonic and distant syllables', () => {
    expect([0, 1, 2].map((i) => positionOf(i, 2))).toEqual(['distant', 'pretonic', 'accented']);
    expect(positionOf(0, 3)).toBe('distant');
  });
});

// Every form, and every base, is looked up in the Westminster Leningrad Codex.
// A form the text never uses is what a typo looks like — swap in one it does,
// as לְבַבְכֶם replaced דְּבַרְכֶם, rather than listing it as unattested.
describe.skipIf(!hasCorpus)('the corpus', () => {
  it.each(SHIFT_ITEMS.map((i) => [i.id, i.form] as const))('%s: %s is attested', (_, form) => {
    expect(isAttested(form)).toBe(true);
  });

  it.each([...new Set(SHIFT_ITEMS.map((i) => i.base))])('base %s is attested', (base) => {
    expect(isAttested(base)).toBe(true);
  });
});
