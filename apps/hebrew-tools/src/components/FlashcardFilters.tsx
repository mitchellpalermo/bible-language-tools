// The filter panel on /flashcards (#74): part of speech and root.
//
// It narrows whichever deck is selected, so its counts are counts within that
// deck: a chip says how many cards it would leave, and a part of speech the
// deck does not hold is not offered. The rules themselves are pure and live in
// `src/lib/flashcard-filters.ts`.
//
// The chips are the same pill every other filter on the page is drawn with.
// That is what separates this "Part of Speech" from the "Part of speech"
// switch in the controls bar, which changes what a card shows and not which
// cards there are (see "The part-of-speech control" in the repo CLAUDE.md).

import { useMemo, useState } from 'react';
import type { HebrewVocabWord } from '../data/vocabulary';
import {
  type CardFilters,
  hasFilters,
  NO_FILTERS,
  partOfSpeechCounts,
  rootChoices,
  rootCounts,
  rootSearchKey,
  toggled,
} from '../lib/flashcard-filters';
import { useHebrewInput } from '../lib/use-hebrew-input';

const HEADING = 'text-xs font-bold text-text-muted uppercase tracking-wider mb-2';

function Chip({
  active,
  onClick,
  count,
  hebrew = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  hebrew?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 rounded-full text-sm border-2 font-medium transition-colors ${
        active
          ? 'bg-primary text-white border-primary'
          : 'border-primary/10 text-text-muted hover:border-primary/40 hover:text-text'
      }`}
    >
      {hebrew ? (
        <span
          dir="rtl"
          lang="he"
          className="text-base"
          style={{ fontFamily: 'var(--font-hebrew)', unicodeBidi: 'isolate' }}
        >
          {children}
        </span>
      ) : (
        children
      )}{' '}
      <span className={`text-xs ${active ? 'text-white/70' : 'text-text-muted'}`}>({count})</span>
    </button>
  );
}

export default function FlashcardFilters({
  deckWords,
  filters,
  onChange,
  matchCount,
}: {
  /** The selected deck, before these filters. */
  deckWords: readonly HebrewVocabWord[];
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
  /** How many words the deck holds once filtered. */
  matchCount: number;
}) {
  const [query, setQuery] = useState('');
  const search = useHebrewInput({ value: query, onChange: setQuery });

  const partsOfSpeech = useMemo(() => partOfSpeechCounts(deckWords), [deckWords]);
  const roots = useMemo(() => rootCounts(deckWords), [deckWords]);
  const choices = rootChoices(roots, query, filters.roots);
  const searching = rootSearchKey(query).length > 0;

  // A selected part of speech the deck no longer holds stays listed, so it can
  // still be switched off after a change of deck.
  const posChips = [
    ...partsOfSpeech,
    ...filters.partsOfSpeech
      .filter((pos) => !partsOfSpeech.some((p) => p.value === pos))
      .map((value) => ({ value, count: 0 })),
  ];

  return (
    <section
      aria-label="Filters"
      className="bg-bg-card rounded-2xl border-2 border-primary/10 p-4 space-y-4 shadow-sm"
    >
      <div>
        <p className={HEADING}>Part of Speech</p>
        <div className="flex flex-wrap gap-2">
          {posChips.map(({ value, count }) => (
            <Chip
              key={value}
              active={filters.partsOfSpeech.includes(value)}
              count={count}
              onClick={() =>
                onChange({ ...filters, partsOfSpeech: toggled(filters.partsOfSpeech, value) })
              }
            >
              {value}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className={HEADING}>Root</p>
        {roots.length === 0 && filters.roots.length === 0 ? (
          <p className="text-sm text-text-muted">No word in this deck has a root on record.</p>
        ) : (
          <>
            <input
              ref={search.ref}
              type="text"
              dir="rtl"
              lang="he"
              value={search.display}
              onChange={search.onChange}
              onKeyDown={search.onKeyDown}
              placeholder="Find a root"
              aria-label="Find a root"
              className="w-full max-w-xs mb-2 px-3 py-1.5 border-2 border-primary/15 rounded-xl bg-bg-card text-lg placeholder:text-sm placeholder:font-sans focus:border-primary focus:outline-none"
              style={{ color: 'var(--color-hebrew)', fontFamily: 'var(--font-hebrew)' }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              {choices.map(({ value, count }) => (
                <Chip
                  key={value}
                  hebrew
                  active={filters.roots.includes(value)}
                  count={count}
                  onClick={() => onChange({ ...filters, roots: toggled(filters.roots, value) })}
                >
                  {value}
                </Chip>
              ))}
            </div>
            {searching && choices.length === filters.roots.length && (
              <p className="text-sm text-text-muted mt-2">No root in this deck matches.</p>
            )}
            <p className="text-xs text-text-muted mt-2">
              {searching
                ? 'Roots that match what you typed.'
                : 'The largest word families in this deck. Type a root to find any other.'}{' '}
              A word with no root on record matches no root.
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-sm text-text-muted">
          <strong className="text-text">{matchCount}</strong>{' '}
          {matchCount === 1 ? 'word matches' : 'words match'}
        </p>
        {hasFilters(filters) && (
          <button
            type="button"
            onClick={() => onChange(NO_FILTERS)}
            className="text-sm text-coral hover:opacity-80 font-semibold transition-opacity"
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}
