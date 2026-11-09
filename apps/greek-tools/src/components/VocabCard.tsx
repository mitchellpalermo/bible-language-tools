// One vocabulary flashcard: the Greek (or the gloss) on the front, the other
// side revealed on flip or a checked typed answer. Drawn by /flashcards and by
// Today's Session (#197), so a word looks the same wherever it is reviewed.
// The session that decides which card this is, and what an answer does, is the
// caller's.

import type { RefObject } from 'react';
import type { VocabWord } from '../data/vocabulary';

export type Direction = 'gr-en' | 'en-gr';

/** The typed-answer controls. Absent when the card is answered by flipping. */
export interface TypedAnswer {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** `null` until checked. */
  result: boolean | null;
  inputRef: RefObject<HTMLInputElement | null>;
}

export default function VocabCard({
  card,
  direction,
  answerMode,
  flipped,
  revealed,
  onFlip,
  showPartOfSpeech,
  back,
  typed,
}: {
  card: VocabWord;
  direction: Direction;
  answerMode: 'flip' | 'type';
  flipped: boolean;
  /** Flipped, or a typed answer has been checked. */
  revealed: boolean;
  onFlip: () => void;
  /** Whether the part of speech is on the front too. It is always on the back. */
  showPartOfSpeech: boolean;
  /** What the student is asked to produce: the back of the card. */
  back: string;
  typed?: TypedAnswer;
}) {
  const front = direction === 'gr-en' ? card.greek : card.gloss;

  return (
    <div
      onClick={answerMode === 'flip' && !flipped ? onFlip : undefined}
      className={`bg-bg-card rounded-2xl shadow-md border-2 border-indigo-100 px-4 py-6 sm:px-10 sm:py-8 text-center select-none min-h-[200px] sm:min-h-[220px] flex flex-col items-center justify-center transition-all ${
        answerMode === 'flip' && !flipped
          ? 'cursor-pointer active:shadow-lg hover:shadow-lg hover:border-grape/30'
          : ''
      }`}
    >
      {/* Front side */}
      <p
        className="leading-tight"
        style={{
          fontSize: direction === 'gr-en' ? '3rem' : '1.8rem',
          fontFamily: direction === 'gr-en' ? 'var(--font-greek)' : 'var(--font-sans)',
          fontWeight: direction === 'gr-en' ? '700' : '600',
          color: direction === 'gr-en' ? 'var(--color-greek)' : 'var(--color-text)',
        }}
      >
        {front}
      </p>
      {/* The part of speech is a hint before the answer and a fact after it.
          With the toggle off it waits for the reveal rather than
          disappearing: "verb" narrows a word to a fraction of the lexicon,
          which is help you did not ask for while recalling, and worth having
          once you have. (In English → Greek the front is the gloss and there
          is no such line to withhold; the back carries it as before.) */}
      {direction === 'gr-en' && (showPartOfSpeech || revealed) && (
        <p className="text-text-muted text-sm mt-2 font-medium uppercase tracking-wide text-xs">
          {card.partOfSpeech}
        </p>
      )}

      {/* Flip mode: reveal hint */}
      {answerMode === 'flip' && !flipped && (
        <p className="text-text-muted/60 text-xs mt-6">
          <span className="sm:hidden">tap to reveal</span>
          <span className="hidden sm:inline">click or press space to reveal</span>
        </p>
      )}

      {/* Flip mode: back side */}
      {answerMode === 'flip' && flipped && (
        <div className="mt-4 pt-4 border-t-2 border-indigo-50 w-full text-center">
          <p
            className="leading-tight"
            style={{
              fontSize: direction === 'en-gr' ? '3rem' : '1.8rem',
              fontFamily: direction === 'en-gr' ? 'var(--font-greek)' : 'var(--font-sans)',
              fontWeight: direction === 'en-gr' ? '700' : '600',
              color: direction === 'en-gr' ? 'var(--color-greek)' : 'var(--color-text)',
            }}
          >
            {back}
          </p>
          <p className="text-text-muted text-xs mt-2 uppercase tracking-wide font-medium">
            {direction === 'gr-en'
              ? `occurs ${card.frequency.toLocaleString()}× in GNT`
              : card.partOfSpeech}
          </p>
        </div>
      )}

      {/* Type mode: input */}
      {answerMode === 'type' && typed && typed.result === null && (
        <div className="mt-6 flex flex-col sm:flex-row gap-2 w-full max-w-sm">
          <input
            ref={typed.inputRef}
            type="text"
            value={typed.value}
            onChange={(e) => typed.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') typed.onSubmit();
            }}
            placeholder={direction === 'gr-en' ? 'Type the English gloss…' : 'Type the Greek word…'}
            className="flex-1 px-3 py-2.5 border-2 border-indigo-100 rounded-xl focus:border-grape focus:outline-none text-base sm:text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={typed.onSubmit}
            className="px-4 py-2.5 bg-grape text-white rounded-xl hover:opacity-90 text-sm font-semibold transition-opacity shadow-sm"
          >
            Check
          </button>
        </div>
      )}

      {/* Type mode: result feedback */}
      {answerMode === 'type' && typed && typed.result !== null && (
        <div
          className={`mt-4 px-4 py-3 rounded-xl w-full max-w-sm text-center border-2 ${
            typed.result ? 'bg-jade/5 border-jade/30' : 'bg-coral/5 border-coral/30'
          }`}
        >
          {typed.result ? (
            <p className="font-bold" style={{ color: 'var(--color-jade)' }}>
              Correct!
            </p>
          ) : (
            <>
              <p className="font-bold" style={{ color: 'var(--color-coral)' }}>
                Not quite
              </p>
              <p className="text-text-muted text-sm mt-1">
                Answer: <span className="font-semibold text-text">{back}</span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
