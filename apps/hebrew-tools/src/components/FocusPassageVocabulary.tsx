import { maturityLevel } from '@tools/shared/focus-passages';
import { useEffect, useState } from 'react';
import type { LemmaIndex } from '../data/morphhb';
import { loadSRSStore, type SRSCard } from '../data/srs';
import { type PassageVocabulary, passageDeckKeys, passageWordKey } from '../lib/focus-passages';
import { glossFor } from '../lib/gloss';
import { saveStudyDeck } from '../lib/passage-deck';

const LEVEL_LABEL = ['New', 'Learning', 'Familiar', 'Mature'] as const;

/**
 * Save the passage's words as a deck and open the flashcards on it. `due` makes
 * the button name only what is waiting, but the deck is the whole passage
 * either way: the flashcards already deal due cards first.
 */
export function StudyDeckButton({
  title,
  vocabulary,
  label = 'Study these words',
}: {
  title: string;
  vocabulary: PassageVocabulary;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const keys = passageDeckKeys(vocabulary);

  function study() {
    try {
      saveStudyDeck(title, keys);
      window.location.href = '/flashcards';
    } catch {
      setError('The deck could not be saved. This browser may be out of storage.');
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={study}
        disabled={keys.length === 0}
        className="min-h-11 px-5 py-2 rounded-xl font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ background: 'var(--color-primary)' }}
      >
        {label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** The course words the passage uses, and the words it uses that the course has not reached. */
export default function FocusPassageVocabulary({
  title,
  vocabulary,
  lemmas,
}: {
  title: string;
  vocabulary: PassageVocabulary;
  lemmas: LemmaIndex | null;
}) {
  // Read after mount: the first render matches the server's, which has no store.
  const [store, setStore] = useState<Record<string, SRSCard>>({});
  useEffect(() => setStore(loadSRSStore()), []);

  const { words, outside } = vocabulary;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-text">
            {words.length} course {words.length === 1 ? 'word' : 'words'}
          </h2>
          <StudyDeckButton title={title} vocabulary={vocabulary} />
        </div>
        <p className="text-sm text-text-muted max-w-xl">
          Words from your course vocabulary that this passage uses, commonest here first. Studying
          them reviews the same cards as everywhere else.
        </p>
        {words.length === 0 ? (
          <p className="text-text-muted">
            None of this passage’s words are in the course vocabulary.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 bg-bg-card rounded-2xl border border-white shadow-sm">
            {words.map(({ word, occurrences }) => {
              const card = store[passageWordKey(word)];
              return (
                <li key={passageWordKey(word)} className="flex items-baseline gap-4 px-4 py-3">
                  <span
                    dir="rtl"
                    lang="he"
                    className="text-2xl shrink-0 min-w-20 text-right"
                    style={{ fontFamily: 'var(--font-hebrew)', color: 'var(--color-hebrew)' }}
                  >
                    {word.hebrew}
                  </span>
                  <span className="flex-1 text-text">{word.gloss}</span>
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {occurrences}× · {LEVEL_LABEL[card ? maturityLevel(card.interval) : 0]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {outside.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-text">
            {outside.length} {outside.length === 1 ? 'word' : 'words'} the course has not reached
          </h2>
          <p className="text-sm text-text-muted max-w-xl">
            Mostly names, rarer words and the direct-object marker. They are glossed here so the
            passage reads, but there is no flashcard to review.
          </p>
          <ul className="divide-y divide-gray-200 bg-bg-card rounded-2xl border border-white shadow-sm">
            {outside.map(({ lemma, occurrences }) => (
              <li key={lemma} className="flex items-baseline gap-4 px-4 py-3">
                <span
                  dir="rtl"
                  lang="he"
                  className="text-2xl shrink-0 min-w-20 text-right"
                  style={{ fontFamily: 'var(--font-hebrew)', color: 'var(--color-hebrew)' }}
                >
                  {lemmas?.[lemma]?.hebrew ?? ''}
                </span>
                <span className="flex-1 text-text">{glossFor(lemma, { lemmas }) ?? ''}</span>
                <span className="text-xs text-text-muted whitespace-nowrap">{occurrences}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
