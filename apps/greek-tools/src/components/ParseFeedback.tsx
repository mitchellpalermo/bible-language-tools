import { ParseFeedbackRow, ParseVerdict } from '@tools/shared/components/ParseDrill';
import type { ParseAnswer, ParseItem, ParseResult } from '../lib/verb-parse';
import {
  MOOD_LABELS,
  NUMBER_LABELS,
  PERSON_LABELS,
  TENSE_LABELS,
  VOICE_LABELS,
} from '../lib/verb-parse';
import { vocabLookup } from '../lib/vocab-lookup';

interface Props {
  item: ParseItem;
  answer: ParseAnswer;
  result: ParseResult;
  onNext: () => void;
  isLast: boolean;
}

export default function ParseFeedback({ item, answer, result, onNext, isLast }: Props) {
  const vocab = vocabLookup.get(item.lemma);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* ── Form display ────────────────────────────────────────────────── */}
      <div className="text-center py-6">
        <p
          className="text-5xl font-bold"
          style={{ fontFamily: 'var(--font-greek)', color: 'var(--color-primary)' }}
        >
          {item.form}
        </p>
        <p className="mt-3 text-sm text-text-muted">{item.paradigmLabel}</p>
        {item.ambiguous && item.ambiguous.length > 0 && (
          <p className="mt-1 text-xs text-text-muted">Also valid: {item.ambiguous.join('; ')}</p>
        )}
      </div>

      {/* ── Property results ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <ParseFeedbackRow
          property="Tense"
          correct={result.tense}
          given={answer.tense ? TENSE_LABELS[answer.tense] : '—'}
          expected={TENSE_LABELS[item.tense]}
        />
        <ParseFeedbackRow
          property="Voice"
          correct={result.voice}
          given={answer.voice ? VOICE_LABELS[answer.voice] : '—'}
          expected={VOICE_LABELS[item.voice]}
        />
        <ParseFeedbackRow
          property="Mood"
          correct={result.mood}
          given={answer.mood ? MOOD_LABELS[answer.mood] : '—'}
          expected={MOOD_LABELS[item.mood]}
        />
        <ParseFeedbackRow
          property="Person"
          correct={result.person}
          given={answer.person ? PERSON_LABELS[answer.person] : '—'}
          expected={PERSON_LABELS[item.person]}
        />
        <ParseFeedbackRow
          property="Number"
          correct={result.number}
          given={answer.number ? NUMBER_LABELS[answer.number] : '—'}
          expected={NUMBER_LABELS[item.number]}
        />
      </div>

      <ParseVerdict correct={result.allCorrect} />

      {/* ── Word definition ─────────────────────────────────────────────── */}
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

      {/* ── Next button ─────────────────────────────────────────────────── */}
      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl text-base font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
      >
        {isLast ? 'See Results' : 'Next Form'}
      </button>
    </div>
  );
}
