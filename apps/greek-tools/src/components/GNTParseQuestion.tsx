import { splitWordPunct } from '../data/morphgnt';
import type {
  GNTCase,
  GNTGender,
  GNTMood,
  GNTNumber,
  GNTParseAnswer,
  GNTParseItem,
  GNTPerson,
  GNTTense,
  GNTVoice,
} from '../lib/gnt-parse';
import {
  FINITE_MOODS,
  GNT_CASE_LABELS,
  GNT_CASES,
  GNT_GENDER_LABELS,
  GNT_GENDERS,
  GNT_MOOD_LABELS,
  GNT_MOODS,
  GNT_NUMBER_LABELS,
  GNT_NUMBERS,
  GNT_PERSON_LABELS,
  GNT_PERSONS,
  GNT_TENSE_LABELS,
  GNT_TENSES,
  GNT_VOICE_LABELS,
  GNT_VOICES,
} from '../lib/gnt-parse';

interface Props {
  item: GNTParseItem;
  index: number;
  total: number;
  answer: GNTParseAnswer;
  onChange: (a: GNTParseAnswer) => void;
  onSubmit: () => void;
}

export default function GNTParseQuestion({
  item,
  index,
  total,
  answer,
  onChange,
  onSubmit,
}: Props) {
  const selectedMood = answer.mood as GNTMood | '';
  const isFiniteMood = selectedMood && FINITE_MOODS.includes(selectedMood);
  const isParticiple = selectedMood === 'participle';
  const isInfinitive = selectedMood === 'infinitive';

  // Clear conditional fields when mood changes
  function handleMoodChange(mood: GNTMood) {
    onChange({ ...answer, mood, person: '', number: '', parseCase: '', gender: '' });
  }

  const canSubmit = (() => {
    if (!answer.tense || !answer.voice || !answer.mood) return false;
    if (isFiniteMood) return !!(answer.person && answer.number);
    if (isParticiple) return !!(answer.parseCase && answer.number && answer.gender);
    if (isInfinitive) return true;
    return false;
  })();

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* ── Progress ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-bg-card rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(index / total) * 100}%`, background: 'var(--color-accent)' }}
          />
        </div>
        <span className="text-sm text-text-muted whitespace-nowrap">
          {index + 1} / {total}
        </span>
      </div>

      {/* ── Verse context ────────────────────────────────────────────────── */}
      <div className="bg-bg-card rounded-xl p-4">
        <p className="text-xs uppercase tracking-widest text-text-muted mb-3">{item.verseRef}</p>
        <p className="text-lg leading-relaxed" style={{ fontFamily: 'var(--font-greek)' }}>
          {item.verseWords.map((word, i) => {
            const [form, punct] = splitWordPunct(word.text);
            const isTarget = i === item.wordIndex;
            return (
              <span key={i}>
                <span
                  style={
                    isTarget
                      ? {
                          color: 'var(--color-accent)',
                          fontWeight: 700,
                          textDecoration: 'underline',
                          textDecorationColor: 'var(--color-accent)',
                        }
                      : undefined
                  }
                >
                  {form}
                </span>
                <span className="text-text-muted">{punct}</span>
                {i < item.verseWords.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </p>
      </div>

      {/* ── Parse this form ──────────────────────────────────────────────── */}
      <div>
        <p className="text-xs uppercase tracking-widest text-text-muted mb-3">
          Parse the highlighted form
        </p>
        <p
          className="text-4xl font-bold mb-4"
          style={{ fontFamily: 'var(--font-greek)', color: 'var(--color-accent)' }}
        >
          {item.form}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <GNTSelect<GNTTense>
            label="Tense"
            value={answer.tense}
            options={GNT_TENSES}
            labels={GNT_TENSE_LABELS}
            onChange={(v) => onChange({ ...answer, tense: v })}
          />
          <GNTSelect<GNTVoice>
            label="Voice"
            value={answer.voice}
            options={GNT_VOICES}
            labels={GNT_VOICE_LABELS}
            onChange={(v) => onChange({ ...answer, voice: v })}
          />
          <GNTSelect<GNTMood>
            label="Mood"
            value={answer.mood}
            options={GNT_MOODS}
            labels={GNT_MOOD_LABELS}
            onChange={handleMoodChange}
            className="col-span-2"
          />

          {/* Finite-only: person + number */}
          {isFiniteMood && (
            <>
              <GNTSelect<GNTPerson>
                label="Person"
                value={answer.person}
                options={GNT_PERSONS}
                labels={GNT_PERSON_LABELS}
                onChange={(v) => onChange({ ...answer, person: v })}
              />
              <GNTSelect<GNTNumber>
                label="Number"
                value={answer.number}
                options={GNT_NUMBERS}
                labels={GNT_NUMBER_LABELS}
                onChange={(v) => onChange({ ...answer, number: v })}
              />
            </>
          )}

          {/* Participle-only: case + number + gender */}
          {isParticiple && (
            <>
              <GNTSelect<GNTCase>
                label="Case"
                value={answer.parseCase}
                options={GNT_CASES}
                labels={GNT_CASE_LABELS}
                onChange={(v) => onChange({ ...answer, parseCase: v })}
              />
              <GNTSelect<GNTNumber>
                label="Number"
                value={answer.number}
                options={GNT_NUMBERS}
                labels={GNT_NUMBER_LABELS}
                onChange={(v) => onChange({ ...answer, number: v })}
              />
              <GNTSelect<GNTGender>
                label="Gender"
                value={answer.gender}
                options={GNT_GENDERS}
                labels={GNT_GENDER_LABELS}
                onChange={(v) => onChange({ ...answer, gender: v })}
                className="col-span-2"
              />
            </>
          )}
        </div>
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
// Reusable select
// ---------------------------------------------------------------------------

interface SelectProps<T extends string> {
  label: string;
  value: T | '';
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  className?: string;
}

function GNTSelect<T extends string>({
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
