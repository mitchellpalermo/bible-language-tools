import InkCanvas from '@tools/shared/components/InkCanvas';
import {
  baseText,
  type GlyphMask,
  type InkScore,
  loadCompositeMask,
  loadGlyphMask,
  renderableText,
  type Stroke,
  scoreInk,
  type Verdict,
  type WritableGlyph,
} from '@tools/shared/ink';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  shouldUpdateCard,
  suggestedGrade,
  WRITING_DECK_CATEGORIES,
  WRITING_GRADES,
  WRITING_MODES,
  type WritingDeck,
  type WritingGrade,
  type WritingMode,
  writingCardKey,
} from '../data/writing';
import ErrorBoundary from './ErrorBoundary';

const DECKS = buildDecks();

/** The reference masks an attempt is scored against. */
interface ScoringMasks {
  whole: GlyphMask;
  /**
   * The mark that distinguishes this glyph, in `whole`'s frame — a vowel
   * point, or the dot that makes a ש a שׁ. Null where the glyph is written
   * whole, in which case scoring falls back to shape alone.
   */
  mark: GlyphMask | null;
}

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

  // Glyphs already graded this session. The confusable decks present the same
  // letter several times over, and SM-2 reads consecutive passes as spaced
  // repetitions when they are minutes apart — see `shouldUpdateCard`.
  const reviewedRef = useRef<Set<string>>(new Set());

  const deck = DECKS.find((d) => d.id === deckId) ?? DECKS[0];

  // Built once per session, not per review. It reads the store directly rather
  // than depending on `srsStore` so that grading a card cannot reorder the
  // letters still ahead of the student.
  const queue = useMemo(() => buildQueue(deck, loadSRSStore()), [deck, session]);

  const glyph: WritableGlyph | undefined = queue[index];

  // renderableText, never glyph.char — some letters are written in a pointed
  // form that differs from their bare identity (final kaf takes its sheva), and
  // the mask has to be built from what the student was actually asked to write.
  const referenceText = glyph ? renderableText(hebrewScriptPack, glyph) : '';
  // What is on the page before this glyph's own mark: the host פ under a vowel
  // point, the bare ש under a shin dot. Null for a glyph written whole.
  const underlyingText = glyph ? baseText(hebrewScriptPack, glyph) : null;

  // ── Scoring reference ─────────────────────────────────────────────────────
  // The font is the answer key: the glyph is rasterized to a mask once and
  // scored against. Null means no canvas or no font, in which case the feedback
  // panel falls back to plain self-assessment.
  //
  // A glyph with an underlying form is rasterized twice, and the difference is
  // graded separately. Without that, a qamets under the wrong side of the פ
  // costs about three points out of a hundred — it is 4% of the composed
  // glyph's area and 100% of the mistake.
  const [masks, setMasks] = useState<ScoringMasks | null>(null);
  useEffect(() => {
    if (!referenceText) return;
    let cancelled = false;
    setMasks(null);

    const options = {
      fontFamily: hebrewScriptPack.fontFamily,
      fontLoadSpec: hebrewScriptPack.fontLoadSpec,
      direction: hebrewScriptPack.direction,
    };
    const pending: Promise<ScoringMasks | null> = underlyingText
      ? loadCompositeMask(referenceText, underlyingText, options).then((c) =>
          c ? { whole: c.whole, mark: c.mark } : null,
        )
      : loadGlyphMask(referenceText, options).then((m) => (m ? { whole: m, mark: null } : null));

    pending.then((next) => {
      if (!cancelled) setMasks(next);
    });
    return () => {
      cancelled = true;
    };
  }, [referenceText, underlyingText]);

  // Scored only once the student has committed to an answer, so nothing is
  // graded mid-stroke.
  const result: InkScore | null = useMemo(
    () =>
      revealed && masks && strokes.length > 0
        ? scoreInk(strokes, masks.whole, { part: masks.mark })
        : null,
    [revealed, masks, strokes],
  );

  const handleStrokeComplete = useCallback((stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke]);
  }, []);

  const handlePenDetected = useCallback(() => setPenDetected(true), []);

  const startDeck = (id: string) => {
    setDeckId(id);
    setSession((s) => s + 1);
    setIndex(0);
    setStrokes([]);
    setRevealed(false);
    setSessionScore({ passed: 0, missed: 0 });
    setDone(false);
    reviewedRef.current = new Set();
  };

  const grade = (which: WritingGrade) => {
    if (!glyph) return;
    const passed = isPassingGrade(which);
    const key = writingCardKey(glyph);

    // A repeat within the same session can demote the card but not promote it.
    const repeat = reviewedRef.current.has(key);
    reviewedRef.current.add(key);

    if (shouldUpdateCard(repeat, which)) {
      setSrsStore((prev) => {
        const updated = nextSRS(prev[key] ?? newCard(key), qualityFor(which));
        const next = { ...prev, [key]: updated };
        saveSRSStore(next);
        return next;
      });
    }

    // Stats are not conditional: the student did the review either way, and it
    // should count toward the streak whether or not it moved the schedule.
    setStats((prev) => {
      const next = recordReview(prev, passed);
      saveStats(next);
      return next;
    });

    posthog.capture('hebrew_writing_reviewed', {
      glyph: glyph.name,
      deck: deck.id,
      mode,
      grade: which,
      repeat,
      strokes: strokes.length,
      // Null when no mask was available, which is the signal that the student
      // graded blind rather than that they scored zero.
      score: result?.score ?? null,
      // Null when the glyph carries no distinguishing mark to place.
      placement: result?.placement ?? null,
      // How far the registration search had to move the ink to score it (#114).
      // Consistently large values here mean the surface and the reference
      // disagree about where a letter sits, which is a data problem rather than
      // a handwriting one — and invisible in the score alone.
      registration: result ? Math.round(Math.hypot(result.offset.x, result.offset.y) * 100) : null,
      followed_suggestion: result ? suggestedGrade(result.score) === which : null,
    });

    setSessionScore((s) => ({
      passed: s.passed + (passed ? 1 : 0),
      missed: s.missed + (passed ? 0 : 1),
    }));

    setStrokes([]);
    setRevealed(false);
    if (index + 1 < queue.length) setIndex((i) => i + 1);
    else setDone(true);
  };

  // ── Reference glyph ───────────────────────────────────────────────────────
  // Trace mode ghosts it from the start; the other modes only show it once the
  // student has committed to an answer, which is what makes them harder.
  const showGhost = mode === 'trace' || revealed;
  const reference = showGhost
    ? {
        text: referenceText,
        fontFamily: hebrewScriptPack.fontFamily,
        opacity: revealed ? 0.38 : 0.13,
      }
    : undefined;

  const hasInk = strokes.length > 0;
  const newCount = countNew(deck.glyphs, srsStore);
  const suggested = result ? suggestedGrade(result.score) : null;
  const isVowel = glyph?.group === 'vowel';
  // Surfaced before the student writes, not after: a confusable deck's whole
  // job is to make the contrast present at the moment of recall.
  const partners = deck.category === 'confusables' ? (glyph?.confusableWith ?? []) : [];

  if (done || !glyph) {
    return (
      <div className="space-y-4">
        <DeckPicker deckId={deckId} onPick={startDeck} />
        <div
          className="bg-bg-card rounded-xl border p-8 text-center shadow-sm"
          style={{ borderColor: '#D1FAE5' }}
        >
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
        {WRITING_MODES.map((m) => (
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
                ? {
                    background: 'var(--color-primary)',
                    color: '#fff',
                    borderColor: 'var(--color-primary)',
                  }
                : {
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-muted)',
                    borderColor: '#D1FAE5',
                  }
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
            {referenceText}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
            {glyph.name}
            {glyph.phonetic && (
              <span className="text-text-muted font-normal"> · {glyph.phonetic}</span>
            )}
          </p>
          <p className="text-sm text-text-muted">{promptFor(mode, isVowel)}</p>
          {partners.length > 0 && (
            <p className="text-sm text-text-muted mt-0.5">
              Not{' '}
              <span
                dir="rtl"
                lang="he"
                className="text-lg align-middle"
                style={{ fontFamily: hebrewScriptPack.fontFamily }}
              >
                {partners.join(' ')}
              </span>
            </p>
          )}
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
        ariaLabel={
          isVowel
            ? `Write the Hebrew vowel point ${glyph.name} on its host consonant`
            : `Write the Hebrew letter ${glyph.name}`
        }
      />

      {/* Surface controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setStrokes((s) => s.slice(0, -1))}
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
          <span
            className="text-xs text-text-muted"
            title="Touch input is now ignored while writing"
          >
            Stylus detected · palm rejection on
          </span>
        )}
      </div>

      {/* Feedback. The score is a suggestion; the student always has the final say. */}
      {revealed && (
        <div
          className="bg-bg-card rounded-xl border p-4 shadow-sm space-y-3"
          style={{ borderColor: '#D1FAE5' }}
        >
          {result ? (
            <ScoreReadout result={result} />
          ) : (
            <p className="text-sm text-text-muted">
              The letter is overlaid on your ink. How close was it?
            </p>
          )}
          {glyph.note && (
            <p className="text-sm" style={{ color: 'var(--color-primary)' }}>
              {glyph.note}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {WRITING_GRADES.map((g) => {
              const isSuggested = suggested === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => grade(g.id)}
                  className="px-4 py-2 rounded-lg font-semibold border transition-colors flex-1 min-w-[5rem]"
                  style={{
                    ...(g.id === 'again'
                      ? {
                          background: 'var(--color-coral)',
                          color: '#fff',
                          borderColor: 'var(--color-coral)',
                        }
                      : g.id === 'easy'
                        ? {
                            background: 'var(--color-jade)',
                            color: '#fff',
                            borderColor: 'var(--color-jade)',
                          }
                        : {
                            background: 'var(--color-bg-card)',
                            color: 'var(--color-text)',
                            borderColor: '#D1FAE5',
                          }),
                    // A ring rather than a different fill: the four buttons keep
                    // their fixed colours, so the suggestion reads as a hint and
                    // not as the only enabled choice.
                    ...(isSuggested
                      ? { outline: '2px solid var(--color-primary)', outlineOffset: '2px' }
                      : {}),
                  }}
                >
                  {g.label}
                  {isSuggested && <span className="sr-only"> (suggested)</span>}
                </button>
              );
            })}
          </div>
          {suggested && (
            <p className="text-xs text-text-muted">
              Suggested from the score. Pick whichever matches what you know — the score reads shape
              only, not which letter you drew.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The instruction under the glyph's name.
 *
 * A vowel card asks for the host consonant too, and says so — the point alone
 * is a stray tick, and the mask it is scored against is of the pair.
 */
function promptFor(mode: WritingMode, isVowel: boolean): string {
  if (mode === 'trace') return 'Draw over the ghosted form.';
  if (mode === 'copy') {
    return isVowel
      ? 'Write the form shown — the פ as well as the point.'
      : 'Write the letter shown.';
  }
  return isVowel
    ? 'Write פ from memory and place the point on it.'
    : 'Write this letter from memory.';
}

const VERDICT_COPY: Record<Verdict, { label: string; color: string }> = {
  pass: { label: 'Good match', color: 'var(--color-jade)' },
  close: { label: 'Close', color: 'var(--color-primary)' },
  miss: { label: 'Not there yet', color: 'var(--color-coral)' },
};

/**
 * The score and the three measurements behind it.
 *
 * All are shown, not just the total, because they fail differently and the
 * student can only act on the specific one: low coverage means part of the
 * letter is missing, stray ink means an extra mark, low accuracy means the
 * shape itself is off, and low placement means the mark is well drawn and in
 * the wrong place.
 *
 * Placement appears only when there was a mark to place. Rendering it as 0%
 * for an ordinary letter would read as a failure at something that was never
 * asked for.
 */
function ScoreReadout({ result }: { result: InkScore }) {
  const { label, color } = VERDICT_COPY[result.verdict];
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold leading-none" style={{ color }}>
          {result.score}
        </span>
        <span className="text-sm font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
        <div className="flex gap-1.5">
          <dt>Accuracy</dt>
          <dd className="font-semibold text-text">{pct(result.accuracy)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Coverage</dt>
          <dd className="font-semibold text-text">{pct(result.coverage)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Stray ink</dt>
          <dd className="font-semibold text-text">{pct(result.spill)}</dd>
        </div>
        {result.placement !== null && (
          <div className="flex gap-1.5">
            <dt>Placement</dt>
            <dd className="font-semibold text-text">{pct(result.placement)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function DeckPicker({ deckId, onPick }: { deckId: string; onPick: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {WRITING_DECK_CATEGORIES.map((category) => {
        const decks = DECKS.filter((d) => d.category === category.id);
        if (decks.length === 0) return null;
        return (
          <div key={category.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1.5">
              {category.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {decks.map((d) => (
                <DeckChip key={d.id} deck={d} active={deckId === d.id} onPick={onPick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeckChip({
  deck,
  active,
  onPick,
}: {
  deck: WritingDeck;
  active: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(deck.id)}
      aria-pressed={active}
      className="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
      style={
        active
          ? {
              background: 'var(--color-primary)',
              color: '#fff',
              borderColor: 'var(--color-primary)',
            }
          : {
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-muted)',
              borderColor: '#D1FAE5',
            }
      }
    >
      {deck.label}
      <span className="opacity-70"> · {deck.glyphs.length}</span>
    </button>
  );
}

export default function WritingPractice() {
  return (
    <ErrorBoundary component="WritingPractice">
      <WritingPracticeInner />
    </ErrorBoundary>
  );
}
