import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearParseFormsCache,
  decodeParseForms,
  fetchParseForms,
  type ParseFormsFile,
} from './parse-forms';

const FILE: ParseFormsFile = {
  lemmas: { 559: ['אָמַר', 'אמר'] },
  forms: [
    ['וַיֹּאמֶר', [['559', 'C/Vqw3ms', 1945]]],
    [
      'אָמַר',
      [
        ['559', 'Vqp3ms', 50],
        ['559', 'Voc', 1],
      ],
    ],
    ['bad', [['559', 'Ncmsa', 1]]],
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  clearParseFormsCache();
});

describe('decodeParseForms', () => {
  it('reads every form and lemma, dropping a reading it cannot read', () => {
    const pool = decodeParseForms(FILE);
    expect(pool.lemmas[559]).toEqual({ headword: 'אָמַר', root: 'אמר' });
    expect(pool.items.map((i) => [i.form, i.readings.length])).toEqual([
      ['וַיֹּאמֶר', 1],
      ['אָמַר', 1],
    ]);
  });
});

describe('fetchParseForms', () => {
  it('fetches once and caches', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(FILE)));
    vi.stubGlobal('fetch', fetch);
    const a = await fetchParseForms();
    const b = await fetchParseForms();
    expect(a).toBe(b);
    expect(fetch).toHaveBeenCalledWith('/data/morphhb/parse-forms.json');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects on a failed response and tries again next time', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(FILE)));
    vi.stubGlobal('fetch', fetch);
    await expect(fetchParseForms()).rejects.toThrow('HTTP 404');
    await expect(fetchParseForms()).resolves.toHaveProperty('items');
  });
});
