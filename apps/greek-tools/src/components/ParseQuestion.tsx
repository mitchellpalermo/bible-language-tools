import { ParseProgress, ParseSelect } from '@tools/shared/components/ParseDrill';
import type {
  ParseAnswer,
  ParseItem,
  ParseMood,
  ParseNumber,
  ParsePerson,
  ParseTense,
  ParseVoice,
} from '../lib/verb-parse';
import {
  MOOD_LABELS,
  NUMBER_LABELS,
  PARSE_MOODS,
  PARSE_NUMBERS,
  PARSE_PERSONS,
  PARSE_TENSES,
  PERSON_LABELS,
  TENSE_LABELS,
  VOICE_LABELS,
  voicesForTense,
} from '../lib/verb-parse';

interface Props {
  item: ParseItem;
  index: number;
  total: number;
  answer: ParseAnswer;
  onChange: (answer: ParseAnswer) => void;
  onSubmit: () => void;
}

export default function ParseQuestion({ item, index, total, answer, onChange, onSubmit }: Props) {
  const canSubmit =
    answer.tense !== '' &&
    answer.voice !== '' &&
    answer.mood !== '' &&
    answer.person !== '' &&
    answer.number !== '';

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <ParseProgress index={index} total={total} />

      {/* ── Verb form ───────────────────────────────────────────────────── */}
      <div className="text-center py-8">
        <p className="text-xs uppercase tracking-widest text-text-muted mb-3">Parse this form</p>
        <p
          className="text-6xl font-bold leading-none"
          style={{ fontFamily: 'var(--font-greek)', color: 'var(--color-primary)' }}
        >
          {item.form}
        </p>
      </div>

      {/* ── Dropdowns ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <ParseSelect<ParseTense>
          label="Tense"
          value={answer.tense}
          options={PARSE_TENSES}
          labels={TENSE_LABELS}
          onChange={(v) => {
            const availableVoices = voicesForTense(v);
            const voiceStillValid = answer.voice !== '' && availableVoices.includes(answer.voice);
            onChange({ ...answer, tense: v, voice: voiceStillValid ? answer.voice : '' });
          }}
        />
        <ParseSelect<ParseVoice>
          label="Voice"
          value={answer.voice}
          options={voicesForTense(answer.tense)}
          labels={VOICE_LABELS}
          onChange={(v) => onChange({ ...answer, voice: v })}
        />
        <ParseSelect<ParseMood>
          label="Mood"
          value={answer.mood}
          options={PARSE_MOODS}
          labels={MOOD_LABELS}
          onChange={(v) => onChange({ ...answer, mood: v })}
        />
        <ParseSelect<ParsePerson>
          label="Person"
          value={answer.person}
          options={PARSE_PERSONS}
          labels={PERSON_LABELS}
          onChange={(v) => onChange({ ...answer, person: v })}
        />
        <ParseSelect<ParseNumber>
          label="Number"
          value={answer.number}
          options={PARSE_NUMBERS}
          labels={NUMBER_LABELS}
          onChange={(v) => onChange({ ...answer, number: v })}
          className="col-span-2"
        />
      </div>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={[
          'w-full py-3 rounded-xl text-base font-bold transition-colors',
          canSubmit
            ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
            : 'bg-bg-card text-text-muted cursor-not-allowed',
        ].join(' ')}
      >
        Submit
      </button>
    </div>
  );
}
