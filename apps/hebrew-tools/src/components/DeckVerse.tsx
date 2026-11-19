// The verse on reveal (#267) for a deck built from a book or passage of the
// Hebrew Bible: the shared `SourceVerse` with the Hebrew drawn in.
//
// A word is drawn as the reader reads it (`readingText`: the qere where there
// is one) with its cantillation removed, as the cards' own Hebrew is. The
// highlighted word is the whole word, prefixes and suffixes included, since
// the lexeme is one of its morphemes. Maqqef and sof pasuq stay attached.

import SourceVerse from '@tools/shared/components/SourceVerse';
import { describeSource, type Occurrence } from '@tools/shared/deck-source';
import type { DeckSourceText } from '@tools/shared/use-deck-source';
import { type HebrewWord, readingText } from '../data/morphhb';
import { stripCantillation } from '../lib/hebrew-input';

const ACCENT = 'var(--color-primary, #15803D)';
const HEBREW_FONT = "var(--font-hebrew, 'Noto Sans Hebrew', sans-serif)";

export function HebrewVerse({
  words,
  position,
}: {
  words: readonly HebrewWord[];
  position: number;
}) {
  return (
    <p
      dir="rtl"
      lang="he"
      style={{ fontFamily: HEBREW_FONT, fontSize: 22, lineHeight: 1.9, margin: 0 }}
    >
      {words.map((w, i) => {
        const text = stripCantillation(readingText(w));
        const joined = w.after === '־';
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a verse's words never reorder
          <span key={i}>
            {i === position ? (
              <mark
                style={{
                  background: 'color-mix(in srgb, var(--color-primary, #15803D) 18%, transparent)',
                  color: 'inherit',
                  borderRadius: 4,
                  padding: '0 2px',
                }}
              >
                {text}
              </mark>
            ) : (
              text
            )}
            {w.after}
            {!joined && i < words.length - 1 && ' '}
          </span>
        );
      })}
    </p>
  );
}

export default function DeckVerse({
  text,
  bookName,
  occurrences,
  headword,
}: {
  text: DeckSourceText<HebrewWord>;
  /** The English name of the source's book: "Genesis". */
  bookName: string;
  occurrences: readonly Occurrence[];
  headword: string;
}) {
  const code = text.index.range.book;
  return (
    <SourceVerse
      occurrences={occurrences}
      sourceLabel={describeSource(text.index.range, text.book, bookName)}
      headword={
        <span dir="rtl" lang="he" style={{ fontFamily: HEBREW_FONT }}>
          {headword}
        </span>
      }
      renderVerse={(o) => (
        <HebrewVerse
          words={text.book[String(o.chapter)]?.[String(o.verse)] ?? []}
          position={o.position}
        />
      )}
      reference={(o) => `${bookName} ${o.chapter}:${o.verse}`}
      readerHref={(o) => `/reader?ref=${code}.${o.chapter}.${o.verse}`}
      accent={ACCENT}
    />
  );
}
