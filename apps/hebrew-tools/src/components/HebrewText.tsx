/**
 * Rendering a Hebrew word, and the popup behind it (issue #120).
 *
 * Split out of the reader the way greek.tools splits `GreekText.tsx`, so Daily
 * Verse (#76) shares one implementation rather than growing a second. Nothing
 * here knows about books, chapters or passages — it takes a word and renders it.
 *
 * What is Hebrew here rather than plumbing:
 *
 * - **The popup's centre of gravity is the morpheme table.** greek.tools has no
 *   analog for it, and it is the thing a first-year student most needs: that
 *   וַיְהִי is וַ + יְהִי, and that the ל on לְדָוִד is a preposition rather than part
 *   of the name.
 * - **The popup is LTR chrome around RTL runs**, and every Hebrew span carries
 *   its own `dir="rtl"`. An un-scoped Hebrew word inside an English sentence
 *   takes its direction from its neighbours and lands in the wrong order.
 * - **A word is anchored by its right edge**, because that is where an RTL word
 *   begins. `popupPosition` owns that; see `src/lib/reader.ts`.
 * - **Absent is absent.** Seven lemmas have no lexicon entry and neither does
 *   any inseparable prefix, so a missing gloss or root renders as nothing at
 *   all — never as "unknown", which reads like a claim about the word.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  displayText,
  fetchLemmas,
  type HebrewWord,
  isAramaic,
  type LemmaIndex,
  readingText,
} from '../data/morphhb';
import { glossFor } from '../lib/gloss';
import { stripCantillation } from '../lib/hebrew-input';
import { analyzeWord } from '../lib/morph-parse';
import { popupPosition } from '../lib/reader';

// ─── Display text ─────────────────────────────────────────────────────────────

/**
 * The word as the reader is currently set to show it.
 *
 * Cantillation is stripped for display only — `stripCantillation` in
 * `src/lib/hebrew-input.ts` is the one set of Unicode ranges this app has for
 * the job, and a second copy here would be a second thing to get subtly wrong.
 * Nikud stays: stripping vowels is a different feature for a much later student.
 */
export function wordText(word: HebrewWord, cantillation: boolean): string {
  const text = readingText(word);
  return cantillation ? text : stripCantillation(text);
}

// ─── WordToken ────────────────────────────────────────────────────────────────

export interface ActiveWord {
  word: HebrewWord;
  rect: DOMRect;
}

/**
 * One word, tappable.
 *
 * A span rather than a button, deliberately: a chapter is hundreds of words,
 * and making each one a tab stop turns continuous prose into a wall of controls
 * for anyone reading it with a keyboard or a screen reader. The popup is a
 * pointer affordance over text that stays text.
 *
 * Two marks can land on the same word and they are drawn differently on
 * purpose. A qere is **dashed** and a studied word is **dotted**; drawn the same
 * way, the legend would be explaining one mark that means two things.
 */
export function WordToken({
  word,
  cantillation,
  studied,
  active,
  onActivate,
}: {
  word: HebrewWord;
  cantillation: boolean;
  studied: boolean;
  active: boolean;
  onActivate: (word: HebrewWord, rect: DOMRect) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const qere = word.qere !== undefined || word.qereOnly === true;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (ref.current) onActivate(word, ref.current.getBoundingClientRect());
    },
    [word, onActivate],
  );

  const marks = [
    qere ? 'underline decoration-dashed decoration-accent/50 underline-offset-4' : '',
    studied ? 'underline decoration-dotted decoration-primary/70 underline-offset-4' : '',
    active ? 'bg-accent/15' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <span
        ref={ref}
        onClick={handleClick}
        className={`cursor-pointer rounded hover:bg-accent/10 transition-colors ${marks}`}
        style={{ touchAction: 'manipulation' }}
        title={qere ? 'Qere — read, where it differs from what is written' : undefined}
      >
        {wordText(word, cantillation)}
      </span>
      {word.after && <span className="text-text-muted">{word.after}</span>}
    </>
  );
}

// ─── WordPopup ────────────────────────────────────────────────────────────────

/** A Hebrew run inside the popup's English chrome. */
function Hebrew({ children, className = '' }: { children: string; className?: string }) {
  return (
    <span
      dir="rtl"
      lang="he"
      className={className}
      style={{ fontFamily: 'var(--font-hebrew)', color: 'var(--color-hebrew)' }}
    >
      {children}
    </span>
  );
}

/** A labelled line, rendered only when there is something to put on it. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-xs text-text-muted">
      <span className="font-semibold">{label}</span> {children}
    </p>
  );
}

/**
 * The morphemes, each with its own parse.
 *
 * A code these tables cannot read renders as itself rather than as a parse with
 * a hole in it — `analyzeMorph` returns `null` for exactly that reason, and a
 * plausible-looking wrong parse is undetectable downstream.
 */
function Morphemes({ word, cantillation }: { word: HebrewWord; cantillation: boolean }) {
  const parts = analyzeWord(word);

  return (
    <ul className="space-y-1 my-3">
      {parts.map((part, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: morphemes are positional
        <li key={i} className="flex items-baseline justify-between gap-3">
          <Hebrew className="text-lg leading-tight">
            {cantillation ? part.text : stripCantillation(part.text)}
          </Hebrew>
          <span className="text-xs text-text-muted text-right">
            {part.analysis?.brief ?? part.code}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function WordPopup({
  active,
  cantillation,
  onClose,
}: {
  active: ActiveWord;
  cantillation: boolean;
  onClose: () => void;
}) {
  const { word, rect } = active;

  // The lemma index is ~140 KB and `fetchLemmas` is deliberately lazy, so it is
  // fetched on the first popup rather than on page load. It caches, so every
  // popup after the first fills in without a request; the parse and the
  // morphemes are on screen either way.
  const [lemmas, setLemmas] = useState<LemmaIndex | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchLemmas()
      .then((index) => {
        if (!cancelled) setLemmas(index);
      })
      .catch(() => {
        /* the parse still reads without the lexicon */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Dismissed on scroll: the popup is placed against a measured rect, and the
  // word slides out from under it as soon as the page moves.
  useEffect(() => {
    window.addEventListener('scroll', onClose, { passive: true, once: true });
    return () => window.removeEventListener('scroll', onClose);
  }, [onClose]);

  const entry = lemmas?.[word.lemma];
  const gloss = glossFor(word.lemma, lemmas);
  // Only verbs carry a stem, so the first morpheme that has one is the verb's.
  const stem = analyzeWord(word).find((part) => part.analysis?.stem)?.analysis?.stem;
  const box = popupPosition(rect, {
    width: window.innerWidth,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  });

  const popup = (
    <div
      dir="ltr"
      role="dialog"
      aria-label={`About ${displayText(word)}`}
      style={{ position: 'absolute', top: box.top, left: box.left, width: box.width, zIndex: 50 }}
      className="bg-bg-card border-2 border-primary/10 rounded-xl shadow-xl p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        {/* The form as the page is showing it, so the popup and the line agree. */}
        <Hebrew className="text-2xl leading-tight">{wordText(word, cantillation)}</Hebrew>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-text-muted hover:text-text transition-colors text-xs mt-1"
        >
          ✕
        </button>
      </div>

      {/* The lemma's citation form — what a lexicon would list it under. */}
      {entry?.hebrew && (
        <p className="mt-0.5">
          <Hebrew className="text-base">{entry.hebrew}</Hebrew>
          {entry.xlit && <span className="text-xs text-text-muted ms-2 italic">{entry.xlit}</span>}
        </p>
      )}

      {gloss && <p className="text-sm text-text mt-2">{gloss}</p>}

      <Morphemes word={word} cantillation={cantillation} />

      <div className="space-y-1 border-t-2 border-primary/5 pt-2">
        {stem && <Field label="Stem">{stem}</Field>}
        {entry?.root && (
          <Field label="Root">
            <Hebrew>{entry.root}</Hebrew>
          </Field>
        )}
        {entry && (
          <p className="text-xs text-text-muted">
            {entry.count.toLocaleString()}× in the Hebrew Bible
          </p>
        )}
        {isAramaic(word) && <p className="text-xs text-text-muted">Aramaic</p>}

        {/* Ketiv and qere, only where they differ — which is the only case the
            corpus records one at all. */}
        {word.qere !== undefined && !word.qereOnly && (
          <Field label="Ketiv">
            {/* The ketiv is the consonantal text as written — unpointed, and so
                unaccented whatever the toggle says. */}
            <Hebrew>{displayText(word)}</Hebrew>
            <span className="mx-1">·</span>
            <span className="font-semibold">Qere</span>{' '}
            <Hebrew>{wordText(word, cantillation)}</Hebrew>
          </Field>
        )}
        {word.qereOnly && <Field label="Qere">read, though not written</Field>}
      </div>

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
