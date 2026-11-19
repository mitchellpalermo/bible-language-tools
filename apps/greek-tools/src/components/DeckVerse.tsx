// The verse on reveal (#267) for a deck built from a GNT book or passage: the
// shared `SourceVerse` with the Greek drawn in. The occurrence's word is
// highlighted, without its trailing punctuation.

import SourceVerse from '@tools/shared/components/SourceVerse';
import { describeSource, type Occurrence } from '@tools/shared/deck-source';
import type { DeckSourceText } from '@tools/shared/use-deck-source';
import { type MorphWord, splitWordPunct } from '../data/morphgnt';
import { GNT_BOOKS } from '../lib/passage-deck';

const ACCENT = 'var(--color-grape, #7C3AED)';

export function bookName(code: string): string {
  return GNT_BOOKS.find((b) => b.code === code)?.name ?? code;
}

export function GreekVerse({ words, position }: { words: readonly MorphWord[]; position: number }) {
  return (
    <p
      lang="grc"
      style={{ fontFamily: 'var(--font-greek)', fontSize: 18, lineHeight: 1.6, margin: 0 }}
    >
      {words.map((w, i) => {
        const [word, punct] = splitWordPunct(w.text);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a verse's words never reorder
          <span key={i}>
            {i > 0 && ' '}
            {i === position ? (
              <mark
                style={{
                  background: 'color-mix(in srgb, var(--color-grape, #7C3AED) 18%, transparent)',
                  color: 'inherit',
                  borderRadius: 4,
                  padding: '0 2px',
                  fontWeight: 600,
                }}
              >
                {word}
              </mark>
            ) : (
              word
            )}
            {punct}
          </span>
        );
      })}
    </p>
  );
}

export default function DeckVerse({
  text,
  occurrences,
  headword,
}: {
  text: DeckSourceText<MorphWord>;
  occurrences: readonly Occurrence[];
  headword: string;
}) {
  const code = text.index.range.book;
  return (
    <SourceVerse
      occurrences={occurrences}
      sourceLabel={describeSource(text.index.range, text.book, bookName(code))}
      headword={
        <span lang="grc" style={{ fontFamily: 'var(--font-greek)' }}>
          {headword}
        </span>
      }
      renderVerse={(o) => (
        <GreekVerse
          words={text.book[String(o.chapter)]?.[String(o.verse)] ?? []}
          position={o.position}
        />
      )}
      reference={(o) => `${bookName(code)} ${o.chapter}:${o.verse}`}
      readerHref={(o) => `/reader?ref=${code}.${o.chapter}.${o.verse}`}
      accent={ACCENT}
    />
  );
}
