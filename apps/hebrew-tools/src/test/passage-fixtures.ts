// A small Genesis and the files around it, for the focus passage components.
// The real corpus is 24 MB and gitignored; these are the same shapes with the
// handful of words the tests need, fetched through a stubbed `fetch` exactly as
// the browser would fetch them.

import { vi } from 'vitest';
import {
  clearMorphhbCache,
  type HebrewBook,
  type HebrewBookMeta,
  type LemmaIndex,
} from '../data/morphhb';

export const BOOKS: HebrewBookMeta[] = [
  { code: 'GEN', name: 'Genesis', hebrew: 'בְּרֵאשִׁית', section: 'torah', chapters: 3, words: 20 },
  { code: 'EXO', name: 'Exodus', hebrew: 'שְׁמוֹת', section: 'torah', chapters: 40, words: 5 },
];

/**
 * Genesis 1:1-3 and 2:1, as OSHB writes them. 430 and 1961 are course words;
 * 776 ("earth") is a course word the vocabulary carries without a Strong number,
 * found through `LEMMAS`; 7225 and 853 are not in the course vocabulary.
 */
export const GENESIS: HebrewBook = {
  '1': {
    '1': [
      { text: 'בְּ/רֵאשִׁ֖ית', lemma: '7225', pos: 'Nc', parsing: 'HR/Ncfsa' },
      { text: 'בָּרָ֣א', lemma: '1254a', pos: 'Vq', parsing: 'HVqp3ms' },
      { text: 'אֱלֹהִ֑ים', lemma: '430', pos: 'Nc', parsing: 'HNcmpa' },
      { text: 'אֵ֥ת', lemma: '853', pos: 'To', parsing: 'HTo' },
      { text: 'הַ/שָּׁמַ֖יִם', lemma: '8064', pos: 'Nc', parsing: 'HTd/Ncmpa' },
      { text: 'וְ/אֵ֥ת', lemma: '853', pos: 'To', parsing: 'HC/To' },
      { text: 'הָ/אָֽרֶץ', lemma: '776', pos: 'Nc', parsing: 'HTd/Ncfsa', after: '׃' },
    ],
    '2': [
      { text: 'וְ/הָ/אָ֗רֶץ', lemma: '776', pos: 'Nc', parsing: 'HC/Td/Ncfsa' },
      { text: 'הָיְתָ֥ה', lemma: '1961', pos: 'Vq', parsing: 'HVqp3fs' },
      { text: 'אֱלֹהִ֔ים', lemma: '430', pos: 'Nc', parsing: 'HNcmpa', after: '׃' },
    ],
    '3': [{ text: 'וַ/יֹּ֥אמֶר', lemma: '559', pos: 'Vq', parsing: 'HC/Vqw3ms', after: '׃' }],
  },
  '2': { '1': [{ text: 'וַ/יְכֻלּ֛וּ', lemma: '3615', pos: 'Vq', parsing: 'HC/Vqw3mp', after: '׃' }] },
  // A name the course vocabulary does not have.
  '3': { '1': [{ text: 'חַוָּֽה', lemma: '9999', pos: 'Np', parsing: 'HNp' }] },
};

export const LEMMAS: LemmaIndex = {
  '430': { count: 2598, hebrew: 'אֱלֹהִים', gloss: 'gods, God' },
  '559': { count: 5300, hebrew: 'אָמַר', gloss: 'say' },
  '776': { count: 2504, hebrew: 'אֶרֶץ', gloss: 'earth, land' },
  '853': { count: 10000, hebrew: 'אֵת', gloss: 'sign of the definite direct object' },
  '1254a': { count: 53, hebrew: 'בָּרָא', gloss: 'create' },
  '1961': { count: 3576, hebrew: 'הָיָה', gloss: 'to be' },
  '7225': { count: 51, hebrew: 'רֵאשִׁית', gloss: 'beginning' },
  '8064': { count: 421, hebrew: 'שָׁמַיִם', gloss: 'heavens' },
  '9999': { count: 1, hebrew: 'חַוָּה', gloss: 'Eve' },
};

export const GENESIS_1_1_3 = {
  book: 'GEN',
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 3,
};

interface StubOptions {
  /** Every request fails, as when the data files were never built. */
  failAll?: boolean;
  /** Only the lemma index fails. */
  failLemmas?: boolean;
}

/** Answer the corpus files from the fixtures above. Call in `beforeEach`. */
export function stubCorpus({ failAll = false, failLemmas = false }: StubOptions = {}): void {
  clearMorphhbCache();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const notFound = Promise.resolve({ ok: false, status: 404 } as Response);
      if (failAll) return notFound;
      if (failLemmas && url.endsWith('lemmas.json')) return notFound;
      const body = url.endsWith('books.json')
        ? BOOKS
        : url.endsWith('lemmas.json')
          ? LEMMAS
          : url.endsWith('glosses.json')
            ? {}
            : url.endsWith('GEN.json')
              ? GENESIS
              : url.endsWith('EXO.json')
                ? { '1': { '1': [] } }
                : null;
      if (!body) return notFound;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }),
  );
}
