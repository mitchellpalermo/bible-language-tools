import type { ParseResult } from '../lib/verb-parse';

export interface SessionResults {
  results: ParseResult[];
  total: number;
}

interface Props {
  sessionResults: SessionResults;
  onRetry: () => void;
  onChangeSettings: () => void;
  onReviewMissed?: () => void;
  isReview?: boolean;
}

type PropertyKey = 'tense' | 'voice' | 'mood' | 'person' | 'number';

const PROPERTIES: { key: PropertyKey; label: string }[] = [
  { key: 'tense', label: 'Tense' },
  { key: 'voice', label: 'Voice' },
  { key: 'mood', label: 'Mood' },
  { key: 'person', label: 'Person' },
  { key: 'number', label: 'Number' },
];

export default function ParseResults({
  sessionResults,
  onRetry,
  onChangeSettings,
  onReviewMissed,
  isReview = false,
}: Props) {
  const { results, total } = sessionResults;
  const correct = results.filter((r) => r.allCorrect).length;
  const missed = total - correct;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="max-w-lg mx-auto space-y-8">
      {/* ── Score hero ──────────────────────────────────────────────────── */}
      <div className="text-center py-8 bg-bg-card rounded-2xl">
        <p className="text-xs uppercase tracking-widest text-text-muted mb-2">
          {isReview ? `Review: Missed Verbs (${total})` : 'Session Score'}
        </p>
        <p className="text-6xl font-extrabold mb-1" style={{ color: scoreColor(pct) }}>
          {correct}/{total}
        </p>
        <p className="text-lg text-text-muted">{pct}% correct</p>
      </div>

      {/* ── Property breakdown ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">
          Accuracy by Property
        </h2>
        <div className="space-y-2">
          {PROPERTIES.map(({ key, label }) => {
            const propertyCorrect = results.filter((r) => r[key]).length;
            const propertyPct = total > 0 ? Math.round((propertyCorrect / total) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-sm w-16 text-text-muted">{label}</span>
                <div className="flex-1 h-2 bg-bg-card rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${propertyPct}%`,
                      background: scoreColor(propertyPct),
                    }}
                  />
                </div>
                <span className="text-sm font-semibold w-16 text-right">
                  {propertyCorrect}/{total}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 py-3 rounded-xl text-base font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
        <button
          onClick={onChangeSettings}
          className="flex-1 py-3 rounded-xl text-base font-bold bg-bg-card text-text hover:opacity-80 transition-opacity"
        >
          Change Settings
        </button>
      </div>
      {onReviewMissed && missed > 0 && (
        <button
          onClick={onReviewMissed}
          className="w-full py-3 rounded-xl text-base font-bold border-2 border-red-500 text-red-600 hover:bg-red-50 transition-colors"
        >
          Review Missed ({missed})
        </button>
      )}
    </div>
  );
}

function scoreColor(pct: number): string {
  if (pct >= 80) return '#16a34a'; // green-600
  if (pct >= 60) return '#d97706'; // amber-600
  return '#dc2626'; // red-600
}
