// What a focus passage's page needs from the corpus, loaded once per passage:
// the book's name, the passage's verses, and its vocabulary.
//
// The book's text is a few hundred kilobytes and the lemma index another 230,
// so both are fetched when a passage is opened and never on page load; each is
// cached by `morphhb.ts`. The lemma index is allowed to fail. It only widens the
// vocabulary join (entries with no Strong number) and names the words outside
// the course, so without it the passage still reads and the deck is just
// smaller; the book is not allowed to.

import { type FocusPassage, type PassageVerse, versesInRange } from '@tools/shared/focus-passages';
import { useEffect, useState } from 'react';
import {
  fetchBook,
  fetchBooks,
  fetchLemmas,
  type HebrewWord,
  type LemmaIndex,
} from '../data/morphhb';
import { type PassageVocabulary, passageVocabulary } from './focus-passages';

export type PassageData =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      bookName: string;
      verses: PassageVerse<HebrewWord>[];
      vocabulary: PassageVocabulary;
      lemmas: LemmaIndex | null;
    };

const LOADING: PassageData = { status: 'loading' };

export function usePassageData(passage: FocusPassage | null): PassageData {
  const [data, setData] = useState<PassageData>(LOADING);
  const id = passage?.id;
  const range =
    passage &&
    JSON.stringify([
      passage.book,
      passage.startChapter,
      passage.startVerse,
      passage.endChapter,
      passage.endVerse,
    ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `range` and `id` stand for `passage`, which is a new object whenever storage is re-read
  useEffect(() => {
    if (!passage) return;
    let cancelled = false;
    setData(LOADING);
    Promise.all([fetchBook(passage.book), fetchBooks(), fetchLemmas().catch((): null => null)])
      .then(([book, books, lemmas]) => {
        if (cancelled) return;
        const verses = versesInRange(book, passage);
        setData({
          status: 'ready',
          bookName: books.find((b) => b.code === passage.book)?.name ?? passage.book,
          verses,
          vocabulary: passageVocabulary(verses, lemmas),
          lemmas,
        });
      })
      .catch(() => {
        if (!cancelled) setData({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, range]);

  return data;
}
