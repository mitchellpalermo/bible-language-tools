import { useCallback, useEffect, useState } from 'react';
import type { FocusPassage } from '../data/focusPassages';
import { fetchBook, type MorphBook, type MorphWord } from '../data/morphgnt';
import { getStudiedLemmas } from '../data/srs';
import { type ActiveWord, WordPopup, WordToken } from './GreekText';

interface VerseDisplayProps {
  verseNum: number;
  words: MorphWord[];
  showGlosses: boolean;
  studiedLemmas: Set<string>;
  activeWord: MorphWord | null;
  onActivate: (word: MorphWord, rect: DOMRect) => void;
}

function VerseDisplay({
  verseNum,
  words,
  showGlosses,
  studiedLemmas,
  activeWord,
  onActivate,
}: VerseDisplayProps) {
  return (
    <span id={`fp-verse-${verseNum}`} className="inline">
      <sup className="text-text-muted text-xs font-normal select-none mr-0.5 relative top-0">
        {verseNum}
      </sup>
      {words.map((word, i) => (
        <WordToken
          key={i}
          word={word}
          showGloss={showGlosses}
          studied={studiedLemmas.has(word.lemma)}
          onActivate={onActivate}
        />
      ))}
    </span>
  );
}

export default function FocusPassageReader({ passage }: { passage: FocusPassage }) {
  const [bookData, setBookData] = useState<MorphBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGlosses, setShowGlosses] = useState(false);
  const [activeWord, setActiveWord] = useState<ActiveWord | null>(null);
  const [studiedLemmas] = useState<Set<string>>(() => {
    try {
      return getStudiedLemmas();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    setLoading(true);
    fetchBook(passage.book)
      .then(setBookData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [passage.book]);

  const handleActivate = useCallback((word: MorphWord, rect: DOMRect) => {
    setActiveWord((prev) => (prev?.word === word ? null : { word, rect }));
  }, []);

  const handleClose = useCallback(() => setActiveWord(null), []);

  if (loading) {
    return <p className="text-text-muted text-center py-16">Loading…</p>;
  }

  if (!bookData) {
    return <p className="text-text-muted text-center py-16">Could not load passage.</p>;
  }

  // Collect verses in the passage range
  const verseRows: Array<{ chapter: number; verse: number; words: MorphWord[] }> = [];

  const chapters = Object.keys(bookData)
    .map(Number)
    .sort((a, b) => a - b);

  for (const ch of chapters) {
    if (ch < passage.startChapter || ch > passage.endChapter) continue;
    const chData = bookData[String(ch)];
    const verses = Object.keys(chData)
      .map(Number)
      .sort((a, b) => a - b);
    for (const vs of verses) {
      if (ch === passage.startChapter && vs < passage.startVerse) continue;
      if (ch === passage.endChapter && vs > passage.endVerse) continue;
      const words = chData[String(vs)];
      if (words) verseRows.push({ chapter: ch, verse: vs, words });
    }
  }

  const isMultiChapter = passage.startChapter !== passage.endChapter;

  return (
    <div onClick={handleClose}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6" onClick={(e) => e.stopPropagation()}>
        <div />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowGlosses((g) => !g);
          }}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            showGlosses
              ? 'border-primary bg-primary text-white'
              : 'border-gray-200 text-text-muted hover:border-gray-300 hover:text-text'
          }`}
        >
          {showGlosses ? 'Hide glosses' : 'Show glosses'}
        </button>
      </div>

      {/* Text */}
      <div
        className="leading-relaxed max-w-2xl"
        style={{ wordSpacing: showGlosses ? '0.3em' : undefined }}
      >
        {verseRows.map(({ chapter, verse, words }) => (
          <span key={`${chapter}-${verse}`}>
            {isMultiChapter && verse === 1 && (
              <span className="block text-xs font-semibold text-text-muted uppercase tracking-wide mt-4 mb-1 select-none">
                Chapter {chapter}
              </span>
            )}
            <VerseDisplay
              verseNum={verse}
              words={words}
              showGlosses={showGlosses}
              studiedLemmas={studiedLemmas}
              activeWord={activeWord?.word ?? null}
              onActivate={handleActivate}
            />
          </span>
        ))}
      </div>

      {studiedLemmas.size > 0 && (
        <p className="text-text-muted text-xs mt-6 select-none">
          <span className="underline decoration-accent/60 decoration-dotted underline-offset-2">
            dotted underline
          </span>{' '}
          = word studied in Flashcards
        </p>
      )}

      {activeWord && <WordPopup active={activeWord} onClose={handleClose} />}
    </div>
  );
}
