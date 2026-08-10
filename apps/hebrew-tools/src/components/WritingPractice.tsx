import InkCanvas from '@tools/shared/components/InkCanvas';
import type { Stroke, WritableGlyph } from '@tools/shared/ink';
import posthog from 'posthog-js';
import { useCallback, useMemo, useState } from 'react';
import { hebrewScriptPack } from '../data/script-pack';
import {
  loadSRSStore,
  loadStats,
  newCard,
  nextSRS,
  recordReview,
  type SRSCard,
  saveSRSStore,
  saveStats,
} from '../data/srs';
import {
  buildDecks,
  buildQueue,
  countNew,
  isPassingGrade,
  qualityFor,
  WRITING_GRADES,
  WRITING_MODES,
  type WritingGrade,
  type WritingMode,
  writingCardKey,
} from '../data/writing';
import ErrorBoundary from './ErrorBoundary';

const DECKS = buildDecks();

function WritingPracticeInner() {
  const [srsStore, setSrsStore] = useState<Record<string, SRSCard>>(() => loadSRSStore());
  const [, setStats] = useState(() => loadStats());

  const [deckId, setDeckId] = useState(DECKS[0].id);
  const [mode, setMode] = useState<WritingMode>('trace');

  const [index, setIndex] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [sessionScore, setSessionScore] = useState({ passed: 0, missed: 0 });
  const [done, setDone] = useState(false);

  // Surfaced in the UI because it is the one thing worth confirming on a real
  // device: if this never flips, palm rejection is not engaged and the surface
  // is treating the Pencil as a finger.
  const [penDetected, setPenDetected] = useState(false);

  // Bumped by startDeck. Without it, "Practice again" on the deck already
  // showing would reuse the memoised queue — the deck object is identical, so
  // no other dependency changes.
  const [session, setSession] = useState(0);

  const deck = DECKS.find(d => d.id === deckId) ?? DECKS[0];

  // Built once per session, not per review. It reads the store directly rather
  // than depending on `srsStore` so that grading a card cannot reorder the
  // letters still ahead of the student.
  const queue = useMemo(() => buildQueue(deck.glyphs, loadSRSStore()), [deck, session]);

  const glyph: WritableGlyph | undefined = queue[index];

  const handleStrokeComplete = useCallback((stroke: Stroke) => {
    setStrokes(prev => [...prev, stroke]);
  }, []);

  const handlePenDetected = useCallback(() => setPenDetected(true), []);

  const startDeck = (id: string) => {
    setDeckId(id);
    setSession(s => s + 1);
    setIndex(0);
    setStrokes([]);
    setRevealed(false);
    setSessionScore({ passed: 0, missed: 0 });
    setDone(false);
  };

  const grade = (which: WritingGrade) => {
    if (!glyph) return;
    const passed = isPassingGrade(which);
    const key = writingCardKey(glyph.char);

    setSrsStore(prev => {
      const updated = nextSRS(prev[key] ?? newCard(key), qualityFor(which));
      const next = { ...prev, [key]: updated };
      saveSRSStore(next);
      return next;
    });

    setStats(prev => {
      const next = recordReview(prev, passed);
      saveStats(next);
      return next;
    });

    posthog.capture('hebrew_writing_reviewed', {
      glyph: glyph.name,
      mode,
      grade: which,
      strokes: strokes.length,
    });

    setSessionScore(s => ({
      passed: s.passed + (passed ? 1 : 0),
      missed: s.missed + (passed ? 0 : 1),
    }));

    setStrokes([]);
    setRevealed(false);
    if (index + 1 < queue.length) setIndex(i => i + 1);
    else setDone(true);
  };

  // ── Reference glyph ───────────────────────────────────────────────────────
  // Trace mode ghosts it from the start; the other modes only show it once the
  // student has committed to an answer, which is what makes them harder.
  const showGhost = mode === 'trace' || revealed;
  const reference = showGhost
    ? {
        text: glyph?.char ?? '',
        fontFamily: hebrewScriptPack.fontFamily,
        opacity: revealed ? 0.38 : 0.13,
      }
    : undefined;

  const hasInk = strokes.length > 0;
  const newCount = countNew(deck.glyphs, srsStore);

  if (done || !glyph) {
    return (
      <div className="space-y-4">
        <DeckPicker deckId={deckId} onPick={startDeck} />
        <div className="bg-bg-card rounded-xl border p-8 text-center shadow-sm" style={{ borderColor: '#D1FAE5' }}>
          <p className="text-2xl font-bold mb-2" style={{ color: 'var(--color-primary)' }}>
            {queue.length === 0 ? 'Nothing due in this deck' : 'Session complete'}
          </p>
          <p className="text-text-muted mb-6">
            {queue.length === 0
              ? 'Every letter here has been written recently. Pick another deck, or come back tomorrow.'
              : `${sessionScore.passed} written well, ${sessionScore.missed} to revisit.`}
          </p>
          <button
            type="button"
            onClick={() => startDeck(deckId)}
            className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors font-semibold shadow-sm"
          >
            Practice again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DeckPicker deckId={deckId} onPick={startDeck} />

      {/* Mode: trace → copy → recall */}
      <div className="flex flex-wrap gap-2 items-center">
        {WRITING_MODES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              setStrokes([]);
              setRevealed(false);
            }}
            aria-pressed={mode === m.id}
            title={m.hint}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
            style={
              mode === m.id
                ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                : { background: 'var(--color-bg-card)', color: 'var(--color-text-muted)', borderColor: '#D1FAE5' }
            }
          >
            {m.label}
          </button>
        ))}
        <span className="text-xs text-text-muted ml-auto">
          {index + 1} / {queue.length}
          {newCount > 0 && ` · ${newCount} new`}
        </span>
      </div>

      {/* Prompt */}
      <div
        className="bg-bg-card rounded-xl border p-4 shadow-sm flex items-center gap-4"
        style={{ borderColor: '#D1FAE5' }}
      >
        {mode === 'copy' && (
          <span
            dir="rtl"
            lang="he"
            className="text-6xl leading-none"
            style={{ fontFamily: hebrewScriptPack.fontFamily, color: 'var(--color-primary)' }}
          >
            {glyph.char}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
            {glyph.name}
            {glyph.phonetic && <span className="text-text-muted font-normal"> · {glyph.phonetic}</span>}
          </p>
          <p className="text-sm text-text-muted">
            {mode === 'trace'
              ? 'Draw over the ghosted letter.'
              : mode === 'copy'
                ? 'Write the letter shown.'
                : 'Write this letter from memory.'}
          </p>
        </div>
      </div>

      <InkCanvas
        strokes={strokes}
        onStrokeComplete={handleStrokeComplete}
        onPenDetected={handlePenDetected}
        reference={reference}
        fontLoadSpec={hebrewScriptPack.fontLoadSpec}
        direction={hebrewScriptPack.direction}
        inkColor="var(--color-text)"
        height={320}
        ariaLabel={`Write the Hebrew letter ${glyph.name}`}
      />

      {/* Surface controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setStrokes(s => s.slice(0, -1))}
          disabled={!hasInk}
          className="px-4 py-2 bg-bg-card text-text-muted border border-gray-200 rounded-lg hover:border-gray-300 hover:text-text transition-colors font-medium disabled:opacity-40"
        >
          Undo stroke
        </button>
        <button
          type="button"
          onClick={() => setStrokes([])}
          disabled={!hasInk}
          className="px-4 py-2 bg-bg-card text-text-muted border border-gray-200 rounded-lg hover:border-gray-300 hover:text-text transition-colors font-medium disabled:opacity-40"
        >
          Clear
        </button>
        {!revealed && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors font-semibold shadow-sm ml-auto"
          >
            Compare
          </button>
        )}
        {penDetected && (
          <span className="text-xs text-text-muted" title="Touch input is now ignored while writing">
            Stylus detected · palm rejection on
          </span>
        )}
      </div>

      {/* Self-assessment. Layer 0 — a real score arrives with issue #100. */}
      {revealed && (
        <div className="bg-bg-card rounded-xl border p-4 shadow-sm space-y-3" style={{ borderColor: '#D1FAE5' }}>
          <p className="text-sm text-text-muted">
            The letter is overlaid on your ink. How close was it?
          </p>
          {glyph.note && (
            <p className="text-sm" style={{ color: 'var(--color-primary)' }}>
              {glyph.note}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {WRITING_GRADES.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => grade(g.id)}
                className="px-4 py-2 rounded-lg font-semibold border transition-colors flex-1 min-w-[5rem]"
                style={
                  g.id === 'again'
                    ? { background: 'var(--color-coral)', color: '#fff', borderColor: 'var(--color-coral)' }
                    : g.id === 'easy'
                      ? { background: 'var(--color-jade)', color: '#fff', borderColor: 'var(--color-jade)' }
                      : { background: 'var(--color-bg-card)', color: 'var(--color-text)', borderColor: '#D1FAE5' }
                }
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeckPicker({ deckId, onPick }: { deckId: string; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DECKS.map(d => (
        <button
          key={d.id}
          type="button"
          onClick={() => onPick(d.id)}
          aria-pressed={deckId === d.id}
          className="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
          style={
            deckId === d.id
              ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
              : { background: 'var(--color-bg-card)', color: 'var(--color-text-muted)', borderColor: '#D1FAE5' }
          }
        >
          {d.label}
          <span className="opacity-70"> · {d.glyphs.length}</span>
        </button>
      ))}
    </div>
  );
}

export default function WritingPractice() {
  return (
    <ErrorBoundary component="WritingPractice">
      <WritingPracticeInner />
    </ErrorBoundary>
  );
}
