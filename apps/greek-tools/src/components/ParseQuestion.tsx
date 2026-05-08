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
      {/* ── Progress ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-bg-card rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(index / total) * 100}%`,
              background: 'var(--color-accent)',
            }}
          />
        </div>
        <span className="text-sm text-text-muted whitespace-nowrap">
          {index + 1} / {total}
        </span>
      </div>

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

// ---------------------------------------------------------------------------
// Reusable dropdown
// ---------------------------------------------------------------------------

interface SelectProps<T extends string> {
  label: string;
  value: T | '';
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (val: T) => void;
  className?: string;
}

function ParseSelect<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  className = '',
}: SelectProps<T>) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-bg-card bg-bg-card px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] appearance-none"
      >
        <option value="">— select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels[opt]}
          </option>
        ))}
      </select>
    </div>
  );
}
