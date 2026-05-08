/**
 * Shared Greek text rendering components.
 * Used by GNTReader and DailyVerse so word-popup behavior stays in sync.
 */
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatParse, type MorphWord, splitWordPunct } from '../data/morphgnt';
import { buildVocabLookup, type VocabEntry, vocabLookup } from '../lib/vocab-lookup';

export { buildVocabLookup, type VocabEntry, vocabLookup };

// ─── WordPopup ────────────────────────────────────────────────────────────────

export interface ActiveWord {
  word: MorphWord;
  rect: DOMRect;
}

export function WordPopup({ active, onClose }: { active: ActiveWord; onClose: () => void }) {
  const { word, rect } = active;
  const vocab = vocabLookup.get(word.lemma);
  const parse = formatParse(word.pos, word.parsing);

  // Position: below the word, kept within viewport
  const top = rect.bottom + window.scrollY + 6;
  const left = Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - 288 - 8));

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Dismiss on scroll (popup would visually drift from word)
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('scroll', handler, { passive: true, once: true });
    return () => window.removeEventListener('scroll', handler);
  }, [onClose]);

  const popup = (
    <div
      role="dialog"
      aria-label={`Word info: ${word.lemma}`}
      style={{ position: 'absolute', top, left, zIndex: 50, width: 272 }}
      className="bg-bg-card border border-gray-200 rounded-xl shadow-xl p-4 text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-greek text-2xl leading-tight" style={{ color: 'var(--color-greek)' }}>
          {word.lemma}
        </span>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text transition-colors mt-1 text-xs"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {vocab ? (
        <p className="text-text mb-1">{vocab.gloss}</p>
      ) : (
        <p className="text-text-muted italic mb-1">gloss not available</p>
      )}

      <p className="text-text-muted text-xs">{parse}</p>

      {vocab && (
        <p className="text-text-muted text-xs mt-1">{vocab.frequency.toLocaleString()}× in GNT</p>
      )}

      <a
        href="/flashcards"
        className="mt-3 block text-center text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
      >
        Study in Flashcards →
      </a>
    </div>
  );

  return createPortal(popup, document.body);
}

// ─── WordToken ────────────────────────────────────────────────────────────────

export function WordToken({
  word,
  showGloss,
  studied,
  onActivate,
}: {
  word: MorphWord;
  showGloss: boolean;
  studied: boolean;
  onActivate: (word: MorphWord, rect: DOMRect) => void;
}) {
  const [wordText, punct] = splitWordPunct(word.text);
  const spanRef = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (spanRef.current) onActivate(word, spanRef.current.getBoundingClientRect());
    },
    [word, onActivate],
  );

  return (
    // inline-flex column so gloss stacks below the word without breaking flow
    <span
      className="inline-flex flex-col items-center"
      style={{ verticalAlign: 'top', marginRight: '0.25em' }}
    >
      <span className="flex items-baseline">
        <span
          ref={spanRef}
          onClick={handleClick}
          className={`font-greek cursor-pointer rounded px-0.5 hover:bg-accent/10 transition-colors ${
            studied ? 'underline decoration-accent/60 decoration-dotted underline-offset-2' : ''
          }`}
          style={{
            fontSize: '1.35rem',
            lineHeight: '1.6',
            color: 'var(--color-greek)',
            touchAction: 'manipulation',
          }}
        >
          {wordText}
        </span>
        {punct && (
          <span className="text-text" style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
            {punct}
          </span>
        )}
      </span>

      {showGloss && (
        <span
          className="text-text-muted"
          style={{ fontSize: '0.62rem', lineHeight: 1.2, maxWidth: '5rem', textAlign: 'center' }}
        >
          {vocabLookup.get(word.lemma)?.gloss?.split(',')[0] ?? word.lemma}
        </span>
      )}
    </span>
  );
}
