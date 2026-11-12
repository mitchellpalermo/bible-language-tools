import type { FocusPassage, PassageVerse } from '@tools/shared/focus-passages';
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_READER_PREFS,
  type HebrewWord,
  loadReaderPrefs,
  type ReaderPrefs,
} from '../data/morphhb';
import { formatRef } from '../lib/reader';
import { lemmaBase, loadStudiedLemmas } from '../lib/studied';
import { type ActiveWord, useGlossLine, WordPopup, WordRun } from './HebrewText';

/**
 * The passage's text, with the reader's word popup and its marks on words the
 * student has studied. The display settings (cantillation, the gloss line, the
 * underline) are the reader's own, read from the same storage: a student who
 * turned the te'amim off there does not turn them off again here.
 */
export default function FocusPassageReading({
  passage,
  verses,
}: {
  passage: FocusPassage;
  verses: PassageVerse<HebrewWord>[];
}) {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [studied, setStudied] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState<ActiveWord | null>(null);
  const glossOf = useGlossLine(prefs.glosses);

  useEffect(() => {
    setPrefs(loadReaderPrefs());
    setStudied(loadStudiedLemmas());
  }, []);

  const activate = useCallback((word: HebrewWord, rect: DOMRect) => {
    setActive((prev) => (prev?.word === word ? null : { word, rect }));
  }, []);
  const close = useCallback(() => setActive(null), []);

  const readerHref = `/reader?ref=${formatRef({
    book: passage.book,
    chapter: passage.startChapter,
    verse: passage.startVerse,
  })}`;

  return (
    // Anywhere else on the page dismisses the popup.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it; see WordPopup
    <div onClick={close} className="space-y-4">
      <a
        href={readerHref}
        className="inline-block text-sm font-semibold underline"
        style={{ color: 'var(--color-primary)' }}
      >
        Open in the reader
      </a>

      {verses.length === 0 ? (
        <p className="text-text-muted">This book has no text for those verses.</p>
      ) : (
        <div
          dir="rtl"
          lang="he"
          data-testid="passage-text"
          className="max-w-2xl"
          style={{
            fontFamily: 'var(--font-hebrew)',
            color: 'var(--color-hebrew)',
            fontSize: '1.5rem',
            lineHeight: 2.1,
            wordSpacing: '0.12em',
          }}
        >
          {verses.map(({ chapter, verse, words }, i) => (
            <span key={`${chapter}:${verse}`}>
              <sup
                dir="ltr"
                className="text-text-muted text-xs font-normal select-none align-super"
                style={{ unicodeBidi: 'isolate', marginInlineEnd: '0.15em' }}
              >
                {i === 0 || chapter !== verses[i - 1].chapter ? `${chapter}:${verse}` : verse}
              </sup>
              <WordRun
                words={words}
                cantillation={prefs.cantillation}
                isStudied={(word) => prefs.studied && studied.has(lemmaBase(word.lemma))}
                active={active?.word ?? null}
                onActivate={activate}
                glossOf={glossOf}
              />
            </span>
          ))}
        </div>
      )}

      {active && <WordPopup active={active} cantillation={prefs.cantillation} onClose={close} />}
    </div>
  );
}
