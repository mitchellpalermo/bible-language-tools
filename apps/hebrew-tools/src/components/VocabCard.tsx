// One vocabulary flashcard: the Hebrew on the front, the gloss and the
// textbook's forms on the back. Drawn by /flashcards and by Today's Session
// (#184), so a word looks the same wherever it is reviewed. The session that
// decides which card this is, and what an answer does, is the caller's.
//
// /flashcards can also ask a card the other way (#74): the gloss on the
// front, the Hebrew as the answer. The back is the same
// either way; only which line is withheld until the reveal changes. And it can
// take the answer typed (`typed`), which reveals the back on Check instead of
// on a tap. Today's Session passes neither and gets the card it always had.

import { categoryLabel, TEXTBOOKS } from '../data/textbooks';
import { type HebrewGender, type HebrewVocabWord, verbParse } from '../data/vocabulary';
import { type Direction, frontText } from '../lib/flashcard-answer';
import { TypedAnswerField, TypedAnswerMark, type TypedAnswerProps } from './TypedAnswer';

/** Gender is quizzed alongside the gloss, so it's spelled out rather than abbreviated. */
export const GENDER_LABELS: Record<HebrewGender, string> = {
  m: 'masculine',
  f: 'feminine',
  fm: 'masculine or feminine',
};

/**
 * Hebrew quoted inside an English line. `unicode-bidi: isolate` is what keeps a
 * right-to-left run from dragging the surrounding label's punctuation with it.
 */
function HebrewInline({ children }: { children: string }) {
  return (
    <span dir="rtl" style={{ fontFamily: 'var(--font-hebrew)', unicodeBidi: 'isolate' }}>
      {children}
    </span>
  );
}

/** The headword at full size: the front in Hebrew → English, the answer otherwise. */
function Headword({ children }: { children: string }) {
  return (
    <p
      dir="rtl"
      className="leading-tight text-5xl font-bold"
      style={{ fontFamily: 'var(--font-hebrew)', color: 'var(--color-hebrew)' }}
    >
      {children}
    </p>
  );
}

export default function VocabCard({
  card,
  flipped,
  onFlip,
  showPartOfSpeech,
  direction = 'he-en',
  answerMode = 'flip',
  revealed = flipped,
  typed,
}: {
  card: HebrewVocabWord;
  flipped: boolean;
  onFlip: () => void;
  /** Whether the part of speech is on the front too. It is always on the back. */
  showPartOfSpeech: boolean;
  /** Which side is asked. Defaults to the Hebrew on the front. */
  direction?: Direction;
  answerMode?: 'flip' | 'type';
  /** Flipped, or a typed answer has been checked. Defaults to `flipped`. */
  revealed?: boolean;
  /** The typed-answer controls. Needed in `type` mode only. */
  typed?: TypedAnswerProps;
}) {
  const parse = verbParse(card);
  const canFlip = answerMode === 'flip' && !flipped;
  const front = frontText(card, direction) ?? '';

  return (
    <div
      onClick={canFlip ? onFlip : undefined}
      className={`bg-bg-card rounded-2xl shadow-md border-2 border-primary/10 px-4 py-6 sm:px-10 sm:py-8 text-center select-none min-h-[200px] sm:min-h-[220px] flex flex-col items-center justify-center transition-all ${
        canFlip ? 'cursor-pointer active:shadow-lg hover:shadow-lg hover:border-primary/30' : ''
      }`}
    >
      {/* Front side */}
      {direction === 'he-en' ? (
        <Headword>{front}</Headword>
      ) : (
        <p className="leading-tight text-3xl font-semibold text-text" data-testid="card-prompt">
          {front}
        </p>
      )}

      {/* The part of speech is a hint before the answer and a fact after it.
          With the toggle off it waits for the reveal rather than disappearing:
          "noun" narrows a word to a fraction of the lexicon, which is help
          you did not ask for while recalling, and worth having once you have.
          (In English → Hebrew the front is the gloss and there is no such
          line to withhold; it comes with the answer, as on greek.tools.) */}
      {direction === 'he-en' && (showPartOfSpeech || revealed) && (
        <p className="text-text-muted text-xs mt-2 font-medium uppercase tracking-wide">
          {card.partOfSpeech}
        </p>
      )}

      {canFlip && (
        <p className="text-text-muted/60 text-xs mt-6">
          <span className="sm:hidden">tap to reveal</span>
          <span className="hidden sm:inline">click or press space to reveal</span>
        </p>
      )}

      {/* Type mode: the field, then the mark it earned. The mark never answers
          the card; the back follows it and the grade row stays live. */}
      {answerMode === 'type' && typed && typed.mark === null && <TypedAnswerField {...typed} />}
      {answerMode === 'type' && typed && typed.mark !== null && (
        <TypedAnswerMark mark={typed.mark} />
      )}

      {/* Back side */}
      {revealed && (
        <div className="mt-4 pt-4 border-t-2 border-primary/5 w-full text-center">
          {direction !== 'he-en' && (
            <>
              <Headword>{card.hebrew}</Headword>
              <p className="text-text-muted text-xs mt-2 mb-3 font-medium uppercase tracking-wide">
                {card.partOfSpeech}
              </p>
            </>
          )}

          {/* In English → Hebrew the prompt is the gloss with any aside that
              quotes the Hebrew trimmed off. The whole gloss comes back with the
              answer only when it says more than the prompt did. */}
          {(direction === 'he-en' || card.gloss !== front) && (
            <p className="leading-tight text-2xl font-semibold text-text">{card.gloss}</p>
          )}

          {/* Transliteration is content, not a label: SBL romanization is
              case-bearing (ʾādām, not ʾĀDĀM), so it must never pick up the
              `uppercase` transform the surrounding micro-labels use.
              Italic is the standard convention for transliterated text.
              Absent on textbook-imported words — see `vocabulary-garrett.ts`. */}
          {card.transliteration && (
            <p className="text-text-muted text-sm mt-2 italic" dir="ltr">
              {card.transliteration}
            </p>
          )}

          {/* A verb's parse belongs with the answer, not on the front: naming
              the conjugation of the form you are looking at is half of what
              the card asks. It matters most on a citation form, where the
              gloss is a bare English verb ("write") under a Hebrew form that
              is a qatal 3ms ("he wrote"). */}
          {(card.gender || parse || card.root) && (
            <p
              className="text-text-muted text-xs mt-1 uppercase tracking-wide font-medium"
              dir="ltr"
            >
              {card.gender && GENDER_LABELS[card.gender]}
              {parse && <span data-testid="verb-parse">{parse}</span>}
              {(card.gender || parse) && card.root && ' · '}
              {card.root && (
                <>
                  root{' '}
                  <span
                    dir="rtl"
                    style={{ fontFamily: 'var(--font-hebrew)', unicodeBidi: 'isolate' }}
                  >
                    {card.root}
                  </span>
                </>
              )}
            </p>
          )}

          {/* Forms the textbook prints alongside the headword. These are what
              the chapter quizzes actually ask for on nouns. */}
          {(card.construct || card.plural) && (
            <p
              className="text-text-muted text-xs mt-1.5 uppercase tracking-wide font-medium"
              dir="ltr"
            >
              {card.construct && (
                <>
                  construct <HebrewInline>{card.construct}</HebrewInline>
                </>
              )}
              {card.construct && card.plural && ' · '}
              {card.plural && (
                <>
                  plural <HebrewInline>{card.plural}</HebrewInline>
                </>
              )}
            </p>
          )}

          {card.stems && card.stems.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-sm text-text-muted" dir="ltr">
              {card.stems.map((s) => (
                <li key={s.stem}>
                  <span className="font-semibold text-text">{s.stem}</span>
                  {s.form && (
                    <>
                      {' '}
                      <HebrewInline>{s.form}</HebrewInline>
                    </>
                  )}{' '}
                  &mdash; {s.gloss}
                </li>
              ))}
            </ul>
          )}

          {card.note && (
            <p className="text-text-muted text-xs mt-3 leading-snug" dir="ltr">
              {card.note}
            </p>
          )}

          {card.chapters && card.chapters.length > 0 && (
            <p
              className="text-text-muted/70 text-[11px] mt-3 uppercase tracking-wide font-medium"
              dir="ltr"
            >
              {card.chapters
                .map(
                  (ref) =>
                    `${TEXTBOOKS[ref.textbook].unitLabel} ${ref.chapter} ${categoryLabel(ref.category)}`,
                )
                .join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
