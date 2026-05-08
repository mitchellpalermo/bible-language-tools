import type { GNTParseAnswer, GNTParseItem, GNTParseResult } from '../lib/gnt-parse';
import {
  GNT_CASE_LABELS,
  GNT_GENDER_LABELS,
  GNT_MOOD_LABELS,
  GNT_NUMBER_LABELS,
  GNT_PERSON_LABELS,
  GNT_TENSE_LABELS,
  GNT_VOICE_LABELS,
} from '../lib/gnt-parse';
import { vocabLookup } from '../lib/vocab-lookup';

export default function GNTFeedback({
  item,
  answer,
  result,
  onNext,
  isLast,
}: {
  item: GNTParseItem;
  answer: GNTParseAnswer;
  result: GNTParseResult;
  onNext: () => void;
  isLast: boolean;
}) {
  const vocab = vocabLookup.get(item.lemma);
  const isFiniteVerb = item.type === 'finite';
  const isParticiple = item.type === 'participle';

  const correctLabel = (() => {
    if (item.type === 'finite') {
      return `${GNT_PERSON_LABELS[item.person]} ${GNT_TENSE_LABELS[item.tense]} ${GNT_VOICE_LABELS[item.voice]} ${GNT_MOOD_LABELS[item.mood]} ${GNT_NUMBER_LABELS[item.number]}`;
    }
    if (item.type === 'infinitive') {
      return `${GNT_TENSE_LABELS[item.tense]} ${GNT_VOICE_LABELS[item.voice]} Infinitive`;
    }
    return `${GNT_TENSE_LABELS[item.tense]} ${GNT_VOICE_LABELS[item.voice]} Participle — ${GNT_CASE_LABELS[item.parseCase]} ${GNT_NUMBER_LABELS[item.number]} ${GNT_GENDER_LABELS[item.gender]}`;
  })();

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Form + ref */}
      <div className="text-center py-5">
        <p className="text-xs uppercase tracking-widest text-text-muted mb-1">{item.verseRef}</p>
        <p
          className="text-4xl font-bold"
          style={{ fontFamily: 'var(--font-greek)', color: 'var(--color-accent)' }}
        >
          {item.form}
        </p>
        <p className="mt-2 text-sm text-text-muted">{correctLabel}</p>
      </div>

      {/* Per-property rows */}
      <div className="space-y-2">
        <FeedbackRow
          property="Tense"
          correct={result.tense}
          given={answer.tense ? GNT_TENSE_LABELS[answer.tense] : '—'}
          expected={GNT_TENSE_LABELS[item.tense]}
        />
        <FeedbackRow
          property="Voice"
          correct={result.voice}
          given={answer.voice ? GNT_VOICE_LABELS[answer.voice] : '—'}
          expected={GNT_VOICE_LABELS[item.voice]}
        />
        <FeedbackRow
          property="Mood"
          correct={result.mood}
          given={answer.mood ? GNT_MOOD_LABELS[answer.mood] : '—'}
          expected={GNT_MOOD_LABELS[item.mood]}
        />

        {isFiniteVerb && item.type === 'finite' && (
          <>
            <FeedbackRow
              property="Person"
              correct={result.person ?? true}
              given={answer.person ? GNT_PERSON_LABELS[answer.person] : '—'}
              expected={GNT_PERSON_LABELS[item.person]}
            />
            <FeedbackRow
              property="Number"
              correct={result.number ?? true}
              given={answer.number ? GNT_NUMBER_LABELS[answer.number] : '—'}
              expected={GNT_NUMBER_LABELS[item.number]}
            />
          </>
        )}

        {isParticiple && item.type === 'participle' && (
          <>
            <FeedbackRow
              property="Case"
              correct={result.parseCase ?? true}
              given={answer.parseCase ? GNT_CASE_LABELS[answer.parseCase] : '—'}
              expected={GNT_CASE_LABELS[item.parseCase]}
            />
            <FeedbackRow
              property="Number"
              correct={result.number ?? true}
              given={answer.number ? GNT_NUMBER_LABELS[answer.number] : '—'}
              expected={GNT_NUMBER_LABELS[item.number]}
            />
            <FeedbackRow
              property="Gender"
              correct={result.gender ?? true}
              given={answer.gender ? GNT_GENDER_LABELS[answer.gender] : '—'}
              expected={GNT_GENDER_LABELS[item.gender]}
            />
          </>
        )}
      </div>

      {/* Verdict */}
      <div
        className={[
          'rounded-xl px-5 py-3 text-center font-semibold text-sm',
          result.allCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
        ].join(' ')}
      >
        {result.allCorrect ? 'Correct!' : 'Not quite — review the corrections above.'}
      </div>

      {/* Word definition */}
      {vocab && (
        <div className="flex items-baseline gap-2 px-4 py-2.5 rounded-lg bg-bg-card border border-gray-100 text-sm">
          <span
            className="font-semibold shrink-0"
            style={{ fontFamily: 'var(--font-greek)', color: 'var(--color-primary)' }}
          >
            {item.lemma}
          </span>
          <span className="text-text">{vocab.gloss}</span>
          <span className="text-text-muted ml-auto shrink-0">
            {vocab.frequency.toLocaleString()}×
          </span>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl text-base font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
      >
        {isLast ? 'See Results' : 'Next Form'}
      </button>
    </div>
  );
}

function FeedbackRow({
  property,
  correct,
  given,
  expected,
}: {
  property: string;
  correct: boolean;
  given: string;
  expected: string;
}) {
  return (
    <div
      className={[
        'flex items-center justify-between rounded-lg px-4 py-2.5 text-sm',
        correct ? 'bg-green-50' : 'bg-red-50',
      ].join(' ')}
    >
      <span className={['font-semibold', correct ? 'text-green-700' : 'text-red-700'].join(' ')}>
        {property}
      </span>
      <div className="flex items-center gap-2">
        {correct ? (
          <span className="text-green-700 font-medium">{given}</span>
        ) : (
          <>
            <span className="text-red-500 line-through">{given}</span>
            <span className="text-red-700 font-semibold">{expected}</span>
          </>
        )}
        <span className={correct ? 'text-green-600' : 'text-red-600'}>{correct ? '✓' : '✗'}</span>
      </div>
    </div>
  );
}
