import { SessionLengthPicker, ToggleChip } from '@tools/shared/components/ParseDrill';
import { toggleValue } from '@tools/shared/parse-drill';
import type {
  ParseMood,
  ParseSettings as ParseSettingsType,
  ParseTense,
  ParseVoice,
} from '../lib/verb-parse';
import {
  MOOD_LABELS,
  PARSE_MOODS,
  PARSE_TENSES,
  PARSE_VOICES,
  TENSE_LABELS,
  VOICE_LABELS,
} from '../lib/verb-parse';

interface Props {
  settings: ParseSettingsType;
  onChange: (s: ParseSettingsType) => void;
  onStart: () => void;
}

// Group tenses by indicative-only vs. cross-mood availability
const _TENSE_GROUPS: { label: string; tenses: ParseTense[] }[] = [
  { label: 'All Moods', tenses: ['present', 'aorist'] },
  { label: 'Indicative Only', tenses: ['imperfect', 'future', 'perfect'] },
];

export default function ParseSettings({ settings, onChange, onStart }: Props) {
  const canStart =
    settings.tenses.length > 0 && settings.voices.length > 0 && settings.moods.length > 0;

  function setTenses(tenses: ParseTense[]) {
    onChange({ ...settings, tenses });
  }
  function setVoices(voices: ParseVoice[]) {
    onChange({ ...settings, voices });
  }
  function setMoods(moods: ParseMood[]) {
    onChange({ ...settings, moods });
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      {/* ── Tenses ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
          Tenses
        </h2>
        <div className="flex flex-wrap gap-2">
          {PARSE_TENSES.map((t) => (
            <ToggleChip
              key={t}
              label={TENSE_LABELS[t]}
              active={settings.tenses.includes(t)}
              onClick={() => setTenses(toggleValue(settings.tenses, t))}
            />
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setTenses([...PARSE_TENSES])}
            className="text-xs text-text-muted underline underline-offset-2 hover:text-text"
          >
            All
          </button>
          <button
            onClick={() => setTenses([])}
            className="text-xs text-text-muted underline underline-offset-2 hover:text-text"
          >
            None
          </button>
        </div>
      </section>

      {/* ── Voices ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
          Voices
        </h2>
        <div className="flex flex-wrap gap-2">
          {PARSE_VOICES.map((v) => (
            <ToggleChip
              key={v}
              label={VOICE_LABELS[v]}
              active={settings.voices.includes(v)}
              onClick={() => setVoices(toggleValue(settings.voices, v))}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Middle/Passive paradigms accept either "Middle" or "Passive" as correct.
        </p>
      </section>

      {/* ── Moods ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
          Moods
        </h2>
        <div className="flex flex-wrap gap-2">
          {PARSE_MOODS.map((m) => (
            <ToggleChip
              key={m}
              label={MOOD_LABELS[m]}
              active={settings.moods.includes(m)}
              onClick={() => setMoods(toggleValue(settings.moods, m))}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Not all tense/voice/mood combinations exist — unavailable combos are skipped
          automatically.
        </p>
      </section>

      {/* ── Session length ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
          Forms per session
        </h2>
        <SessionLengthPicker
          value={settings.sessionLength}
          onChange={(sessionLength) => onChange({ ...settings, sessionLength })}
        />
      </section>

      {/* ── Start button ────────────────────────────────────────────────── */}
      <button
        onClick={onStart}
        disabled={!canStart}
        className={[
          'w-full py-3 rounded-xl text-base font-bold transition-colors',
          canStart
            ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
            : 'bg-bg-card text-text-muted cursor-not-allowed',
        ].join(' ')}
      >
        Start Parsing
      </button>

      {!canStart && (
        <p className="text-center text-xs text-red-500">
          Select at least one tense, voice, and mood to continue.
        </p>
      )}
    </div>
  );
}
