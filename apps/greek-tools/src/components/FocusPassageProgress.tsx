import { useEffect, useState } from 'react';
import {
  type FocusPassage,
  getParseGrade,
  getVocabMaturityBreakdown,
  loadParseHistoryStore,
  type MaturityBreakdown,
  type ParseGrade,
} from '../data/focusPassages';
import { fetchBook } from '../data/morphgnt';
import { loadSRSStore } from '../data/srs';
import { vocabulary } from '../data/vocabulary';
import { buildVocabMap, extractPassageLemmas } from '../lib/passage-deck';

function gradeColor(grade: ParseGrade): string {
  if (grade === 'A') return '#059669';
  if (grade === 'B') return '#0d9488';
  if (grade === 'C') return '#d97706';
  if (grade === 'D' || grade === 'E') return '#dc2626';
  return 'var(--color-text-muted)';
}

export default function FocusPassageProgress({ passage }: { passage: FocusPassage }) {
  const [breakdown, setBreakdown] = useState<MaturityBreakdown | null>(null);
  const [lemmaCount, setLemmaCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const grade = getParseGrade(passage.id);
  const parseHistory = loadParseHistoryStore()[passage.id];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchBook(passage.book)
      .then((bookData) => {
        if (cancelled) return;
        const srsStore = loadSRSStore();
        const vocabMap = buildVocabMap(vocabulary);
        const lemmas = extractPassageLemmas(
          bookData,
          passage.startChapter,
          passage.startVerse,
          passage.endChapter,
          passage.endVerse,
          vocabMap,
        );
        setLemmaCount(lemmas.length);
        setBreakdown(getVocabMaturityBreakdown(lemmas, srsStore));
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    passage.book,
    passage.startChapter,
    passage.startVerse,
    passage.endChapter,
    passage.endVerse,
  ]);

  if (loading) {
    return <p className="text-text-muted text-center py-16">Loading progress…</p>;
  }

  const totalWords = lemmaCount ?? 0;

  const maturityBars = breakdown
    ? [
        { label: 'Mature', count: breakdown.mature, color: '#059669' },
        { label: 'Familiar', count: breakdown.familiar, color: '#0d9488' },
        { label: 'Learning', count: breakdown.learning, color: '#d97706' },
        { label: 'New', count: breakdown.unseen, color: '#94a3b8' },
      ]
    : [];

  return (
    <div className="max-w-lg space-y-8">
      {/* Vocab maturity */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-4">
          Vocabulary Maturity
        </h2>

        {breakdown && totalWords > 0 ? (
          <>
            {/* Proportional bar */}
            <div className="flex rounded-full overflow-hidden h-3 mb-4 bg-gray-100">
              {maturityBars
                .filter((b) => b.count > 0)
                .map((b) => (
                  <div
                    key={b.label}
                    style={{
                      width: `${(b.count / totalWords) * 100}%`,
                      background: b.color,
                    }}
                    title={`${b.label}: ${b.count}`}
                  />
                ))}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-3">
              {maturityBars.map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: b.color }} />
                  <span className="text-sm text-text-muted">
                    {b.label}: <strong className="text-text">{b.count}</strong>
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-text-muted">
              {totalWords} unique vocab word{totalWords !== 1 ? 's' : ''} in this passage
            </p>
          </>
        ) : (
          <p className="text-text-muted text-sm">No vocabulary data yet.</p>
        )}
      </section>

      {/* Parse grade */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-4">
          Parse Grade
        </h2>

        <div className="flex items-center gap-4">
          <span
            className="text-6xl font-extrabold leading-none"
            style={{ color: gradeColor(grade) }}
          >
            {grade}
          </span>

          {parseHistory && parseHistory.total > 0 ? (
            <div className="text-sm text-text-muted space-y-0.5">
              <p>
                <strong className="text-text">{parseHistory.correct}</strong> correct out of{' '}
                <strong className="text-text">{parseHistory.total}</strong>
              </p>
              <p>
                {Math.round((parseHistory.correct / parseHistory.total) * 100)}% accuracy (
                cumulative)
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No parse sessions yet.</p>
          )}
        </div>

        {grade !== '—' && (
          <div className="mt-3 text-xs text-text-muted">
            <span className="font-semibold">A</span> ≥90% · <span className="font-semibold">B</span>{' '}
            75–89% · <span className="font-semibold">C</span> 60–74% ·{' '}
            <span className="font-semibold">D</span> 45–59% ·{' '}
            <span className="font-semibold">E</span> &lt;45%
          </div>
        )}
      </section>
    </div>
  );
}
