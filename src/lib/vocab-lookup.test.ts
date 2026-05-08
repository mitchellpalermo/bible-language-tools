import { describe, expect, it } from 'vitest';
import { buildVocabLookup } from './vocab-lookup';

describe('buildVocabLookup', () => {
  it('returns a Map', () => {
    const map = buildVocabLookup();
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBeGreaterThan(0);
  });

  it('looks up a single-form lemma', () => {
    const map = buildVocabLookup();
    const entry = map.get('λέγω');
    expect(entry).toBeDefined();
    expect(entry?.gloss).toBeTruthy();
    expect(typeof entry?.frequency).toBe('number');
    expect(entry!.frequency).toBeGreaterThan(0);
  });

  it('splits comma-separated forms and indexes each variant', () => {
    const map = buildVocabLookup();
    // 'οὐ, οὐκ, οὐχ' — each form should be in the map with the same gloss
    const ou = map.get('οὐ');
    const ouk = map.get('οὐκ');
    const ouch = map.get('οὐχ');
    expect(ou).toBeDefined();
    expect(ouk).toBeDefined();
    expect(ouch).toBeDefined();
    expect(ou?.gloss).toBe(ouk?.gloss);
    expect(ou?.frequency).toBe(ouk?.frequency);
  });

  it('returns undefined for an unknown lemma', () => {
    const map = buildVocabLookup();
    expect(map.get('zzz-not-a-greek-word')).toBeUndefined();
  });
});
