import type { VerbParadigm } from '../../data/grammar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Mood = 'indicative' | 'subjunctive' | 'imperative';

export interface VerbParadigmGridProps {
  /** All verb paradigms (the component filters by mood internally). */
  paradigms: VerbParadigm[];
  /** Currently selected paradigm id. */
  selectedId: string;
  /** Called when a grid cell is tapped. */
  onSelect: (id: string) => void;
  /** Currently active mood tab. */
  activeMood: Mood;
  /** Called when a mood tab is tapped. */
  onMoodChange: (mood: Mood) => void;
  /** Show 1sg form text inside cells. Default: false (shows dot). */
  showFormPreview?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TenseKey = 'pres' | 'impf' | 'fut' | 'aor' | 'perf';
type VoiceKey = 'act' | 'mid' | 'pass';

const TENSE_ORDER: { key: TenseKey; label: string }[] = [
  { key: 'pres', label: 'Pres' },
  { key: 'impf', label: 'Impf' },
  { key: 'fut', label: 'Fut' },
  { key: 'aor', label: 'Aor' },
  { key: 'perf', label: 'Perf' },
];

const VOICE_ORDER: { key: VoiceKey; label: string }[] = [
  { key: 'act', label: 'Act' },
  { key: 'mid', label: 'Mid' },
  { key: 'pass', label: 'Pass' },
];

const MOOD_LABELS: Record<Mood, string> = {
  indicative: 'Indicative',
  subjunctive: 'Subjunctive',
  imperative: 'Imperative',
};

const MOODS: Mood[] = ['indicative', 'subjunctive', 'imperative'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a paradigm id like "pres-act-ind" into { tense, voice }. */
function parseId(id: string): { tense: TenseKey; voice: VoiceKey } | null {
  const parts = id.split('-');
  if (parts.length < 3) return null;
  return { tense: parts[0] as TenseKey, voice: parts[1] as VoiceKey };
}

/** Check if a paradigm label indicates a combined Middle/Passive form. */
function isMidPass(paradigm: VerbParadigm): boolean {
  return paradigm.label.includes('Middle/Passive');
}

// ---------------------------------------------------------------------------
// Grid data builder
// ---------------------------------------------------------------------------

interface GridData {
  /** Voice columns to display, in order. */
  voices: { key: VoiceKey; label: string }[];
  /** Tense rows to display, in order. */
  rows: {
    tense: TenseKey;
    label: string;
    cells: GridCell[];
  }[];
}

interface GridCell {
  paradigm: VerbParadigm | null;
  colSpan: number;
  /** True if this cell is covered by a previous cell's colSpan. */
  hidden: boolean;
}

function buildGrid(paradigms: VerbParadigm[], mood: Mood): GridData {
  const filtered = paradigms.filter((p) => p.group === mood);

  // Build lookup: "tense-voice" → paradigm
  const lookup = new Map<string, VerbParadigm>();
  for (const p of filtered) {
    const parsed = parseId(p.id);
    if (parsed) lookup.set(`${parsed.tense}-${parsed.voice}`, p);
  }

  // Determine which voices have any paradigm in this mood
  const voiceSet = new Set<VoiceKey>();
  for (const p of filtered) {
    const parsed = parseId(p.id);
    if (parsed) voiceSet.add(parsed.voice);
  }
  // If any paradigm spans M/P (has mid but label says M/P), ensure pass column exists
  for (const p of filtered) {
    const parsed = parseId(p.id);
    if (parsed && parsed.voice === 'mid' && isMidPass(p)) {
      voiceSet.add('pass');
    }
  }
  const voices = VOICE_ORDER.filter((v) => voiceSet.has(v.key));

  // Determine which tenses have any paradigm in this mood
  const tenseSet = new Set<TenseKey>();
  for (const p of filtered) {
    const parsed = parseId(p.id);
    if (parsed) tenseSet.add(parsed.tense);
  }

  const rows = TENSE_ORDER.filter((t) => tenseSet.has(t.key)).map(({ key: tense, label }) => {
    const cells: GridCell[] = [];

    for (let vi = 0; vi < voices.length; vi++) {
      const voice = voices[vi];
      const paradigm = lookup.get(`${tense}-${voice.key}`) ?? null;

      // Check if this cell should span: mid paradigm that's M/P and no separate pass exists
      if (paradigm && voice.key === 'mid' && isMidPass(paradigm) && !lookup.has(`${tense}-pass`)) {
        // Find the pass column index
        const passIdx = voices.findIndex((v) => v.key === 'pass');
        const span = passIdx > vi ? passIdx - vi + 1 : 1;
        cells.push({ paradigm, colSpan: span, hidden: false });
        // Mark subsequent spanned cells as hidden
        for (let s = 1; s < span; s++) {
          cells.push({ paradigm: null, colSpan: 1, hidden: true });
        }
        vi += span - 1; // skip spanned columns
      } else {
        cells.push({ paradigm, colSpan: 1, hidden: false });
      }
    }

    return { tense, label, cells };
  });

  return { voices, rows };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VerbParadigmGrid({
  paradigms,
  selectedId,
  onSelect,
  activeMood,
  onMoodChange,
  showFormPreview = false,
}: VerbParadigmGridProps) {
  const grid = buildGrid(paradigms, activeMood);

  return (
    <div>
      {/* Mood tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'rgba(30,58,95,0.07)' }}>
        {MOODS.map((mood) => (
          <button
            key={mood}
            onClick={() => onMoodChange(mood)}
            className="flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={
              activeMood === mood
                ? { background: 'var(--color-primary)', color: '#fff' }
                : { background: 'transparent', color: 'var(--color-text-muted)' }
            }
          >
            {MOOD_LABELS[mood]}
          </button>
        ))}
      </div>

      {/* Tense × Voice grid */}
      <table className="text-sm border-separate" style={{ borderSpacing: '4px' }}>
        <thead>
          <tr>
            <th className="px-2 py-1" />
            {grid.voices.map((v) => (
              <th
                key={v.key}
                className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {v.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.tense}>
              <td
                className="px-2 py-1 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {row.label}
              </td>
              {row.cells.map((cell, ci) => {
                if (cell.hidden) return null;
                if (!cell.paradigm) {
                  return (
                    <td key={ci} colSpan={cell.colSpan} className="px-2 py-1 text-center">
                      <span
                        className="text-xs"
                        style={{ color: 'var(--color-text-muted)', opacity: 0.3 }}
                      >
                        —
                      </span>
                    </td>
                  );
                }
                const isSelected = cell.paradigm.id === selectedId;
                const preview = showFormPreview
                  ? (cell.paradigm.forms['1sg'] ?? cell.paradigm.forms['2sg'] ?? '')
                  : '';
                const labelParts = cell.paradigm.label.includes('Middle/Passive') ? 'M/P' : '';
                return (
                  <td key={ci} colSpan={cell.colSpan} className="text-center">
                    <button
                      onClick={() => onSelect(cell.paradigm!.id)}
                      className="w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                      style={
                        isSelected
                          ? { background: 'var(--color-primary)', color: '#fff' }
                          : { background: 'rgba(30,58,95,0.07)', color: 'var(--color-text)' }
                      }
                      title={cell.paradigm.label}
                    >
                      {showFormPreview ? (
                        <span className="font-greek text-sm">{preview}</span>
                      ) : labelParts ? (
                        <span>{labelParts}</span>
                      ) : (
                        <span>●</span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
