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

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

const SESSION_LENGTHS = [10, 20, 30] as const;

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
              onClick={() => setTenses(toggle(settings.tenses, t))}
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
              onClick={() => setVoices(toggle(settings.voices, v))}
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
              onClick={() => setMoods(toggle(settings.moods, m))}
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
        <div className="flex gap-2">
          {SESSION_LENGTHS.map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...settings, sessionLength: n })}
              className={[
                'px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors',
                settings.sessionLength === n
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-bg-card bg-bg-card text-text-muted hover:border-[var(--color-accent)]',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
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

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors',
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
          : 'border-bg-card bg-bg-card text-text-muted hover:border-[var(--color-accent)]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
