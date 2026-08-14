import InkCanvas from '@tools/shared/components/InkCanvas';
import WritingGrid, { type WritingGridCell } from '@tools/shared/components/WritingGrid';
import {
  type GlyphCluster,
  type GlyphMask,
  loadCompositeMask,
  loadGlyphMask,
  scoreInk,
  type Stroke,
} from '@tools/shared/ink';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type DeckSelection, loadSelection, saveSelection } from '../lib/deck-selection';
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
import { chapterNumbers, TEXTBOOKS, type TextbookId } from '../data/textbooks';
import {
  isPassingGrade,
  qualityFor,
  suggestedGrade,
  WRITING_GRADES,
  type WritingGrade,
} from '../data/writing';
import {
  buildWordQueue,
  countNewWords,
  countPromptable,
  promptText,
  type WordPrompt,
  WORD_PROMPTS,
  wordScore,
  wordsForSelection,
} from '../data/writing-words';
import ErrorBoundary from './ErrorBoundary';

/** Fisher-Yates. The queue shuffles within a band; see `buildWordQueue`. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Masks for one cell: the cluster, and the points it carries. */
interface CellMasks {
  whole: GlyphMask;
  /**
   * The vowel points and dagesh alone, in the cluster's frame — null for a bare
   * consonant.
   *
   * This is 9c's placement scoring reused per cell, and it earns its keep here:
   * דָּ against דַּ differs by one mark that is a few percent of the cell's area
   * and the whole of the difference between the two words.
   */
  mark: GlyphMask | null;
}

const MASK_OPTIONS = {
  fontFamily: hebrewScriptPack.fontFamily,
  fontLoadSpec: hebrewScriptPack.fontLoadSpec,
  direction: hebrewScriptPack.direction,
};

function WordWritingInner() {
  const [srsStore, setSrsStore] = useState<Record<string, SRSCard>>(() => loadSRSStore());
  const [, setStats] = useState(() => loadStats());
  const [selection, setSelection] = useState<DeckSelection>(() => loadSelection());
  const [prompt, setPrompt] = useState<WordPrompt>('gloss');

  const [index, setIndex] = useState(0);
  const [session, setSession] = useState(0);
  // Ink per cell, keyed by cell index. Reset between words.
  const [cellStrokes, setCellStrokes] = useState<Stroke[][]>([]);
  const [active, setActive] = useState<number | null>(0);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState({ passed: 0, missed: 0 });
  const [done, setDone] = useState(false);
  const [penDetected, setPenDetected] = useState(false);

  const words = useMemo(
    () => wordsForSelection(selection.deck, selection.chapters, selection.categories),
    [selection],
  );

  // Built once per session, not per review, so grading a word cannot reorder
  // the words still ahead of the student.
  const queue = useMemo(
    () => buildWordQueue(words, loadSRSStore(), prompt, shuffle),
    // biome-ignore lint/correctness/useExhaustiveDependencies: session forces a rebuild
    [words, prompt, session],
  );

  const current = queue[index];
  const cells: GlyphCluster[] = useMemo(() => current?.cells ?? [], [current]);

  // Reset the surface whenever the word changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the word
  useEffect(() => {
    setCellStrokes(cells.map(() => []));
    setActive(cells.length > 0 ? 0 : null);
    setRevealed(false);
  }, [current?.key, cells.length]);

  // ── Scoring references ────────────────────────────────────────────────────
  // One mask per cell. A pointed cluster is rasterized twice and the difference
  // graded separately — see `CellMasks.mark`.
  const [masks, setMasks] = useState<(CellMasks | null)[]>([]);
  useEffect(() => {
    if (cells.length === 0) return;
    let cancelled = false;
    setMasks([]);

    Promise.all(
      cells.map(cell =>
        cell.pointed
          ? loadCompositeMask(cell.text, cell.base, MASK_OPTIONS).then(c =>
              c ? { whole: c.whole, mark: c.mark } : null,
            )
          : loadGlyphMask(cell.text, MASK_OPTIONS).then(m => (m ? { whole: m, mark: null } : null)),
      ),
    ).then(next => {
      if (!cancelled) setMasks(next);
    });
    return () => {
      cancelled = true;
    };
  }, [cells]);

  // Scored only once the student has committed, so nothing grades mid-stroke.
  const cellScores = useMemo(
    () =>
      cells.map((_, i) => {
        const mask = masks[i];
        const strokes = cellStrokes[i];
        if (!revealed || !mask || !strokes || strokes.length === 0) return null;
        return scoreInk(strokes, mask.whole, { part: mask.mark }).score;
      }),
    [cells, masks, cellStrokes, revealed],
  );

  const total = wordScore(cellScores);
  const suggested = total === null ? null : suggestedGrade(total);
  const written = cellStrokes.some(s => s && s.length > 0);
  const newCount = countNewWords(words, srsStore, prompt);

  const handleStroke = useCallback(
    (stroke: Stroke) => {
      if (active === null) return;
      setCellStrokes(prev => {
        const next = [...prev];
        next[active] = [...(next[active] ?? []), stroke];
        return next;
      });
    },
    [active],
  );

  const gridCells: WritingGridCell[] = cells.map((cell, i) => ({
    text: cell.text,
    strokes: cellStrokes[i] ?? [],
    score: cellScores[i],
  }));

  const grade = (which: WritingGrade) => {
    if (!current) return;
    const passed = isPassingGrade(which);

    setSrsStore(prev => {
      const updated = nextSRS(prev[current.key] ?? newCard(current.key), qualityFor(which));
      const next = { ...prev, [current.key]: updated };
      saveSRSStore(next);
      return next;
    });

    setStats(prev => {
      const next = recordReview(prev, passed);
      saveStats(next);
      return next;
    });

    posthog.capture('hebrew_word_written', {
      lemma: current.word.hebrew,
      cells: cells.length,
      prompt,
      grade: which,
      // Null when no mask was available — the student graded blind rather than
      // scoring zero.
      score: total,
      // The weakest cell is what the word score already is; this says which.
      worst_cell: total === null ? null : cellScores.indexOf(total),
      followed_suggestion: suggested === null ? null : suggested === which,
    });

    setTally(t => ({ passed: t.passed + (passed ? 1 : 0), missed: t.missed + (passed ? 0 : 1) }));
    if (index + 1 < queue.length) setIndex(i => i + 1);
    else setDone(true);
  };

  const restart = (patch?: Partial<DeckSelection>, nextPrompt?: WordPrompt) => {
    if (patch) {
      setSelection(prev => {
        const next = { ...prev, ...patch };
        saveSelection(next);
        return next;
      });
    }
    if (nextPrompt) setPrompt(nextPrompt);
    setSession(s => s + 1);
    setIndex(0);
    setTally({ passed: 0, missed: 0 });
    setDone(false);
  };

  const picker = (
    <DeckControls
      selection={selection}
      prompt={prompt}
      promptable={countPromptable(words, prompt)}
      onChange={restart}
    />
  );

  if (done || !current) {
    return (
      <div className="space-y-4">
        {picker}
        <div
          className="bg-bg-card rounded-xl border p-8 text-center shadow-sm"
          style={{ borderColor: '#D1FAE5' }}
        >
          <p className="text-2xl font-bold mb-2" style={{ color: 'var(--color-primary)' }}>
            {queue.length === 0 ? 'Nothing due here' : 'Session complete'}
          </p>
          <p className="text-text-muted mb-6">
            {queue.length === 0
              ? countPromptable(words, prompt) === 0
                ? 'No word in this selection can be prompted that way. Try "From the meaning", or pick more chapters.'
                : 'Every word here has been written recently. Pick another chapter, or come back tomorrow.'
              : `${tally.passed} written well, ${tally.missed} to revisit.`}
          </p>
          <button
            type="button"
            onClick={() => restart()}
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
      {picker}

      {/* Prompt. The Hebrew is never shown before the reveal — writing a word
          from a gloss is the whole exercise. */}
      <div
        className="bg-bg-card rounded-xl border p-4 shadow-sm flex items-baseline gap-3 flex-wrap"
        style={{ borderColor: '#D1FAE5' }}
      >
        <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
          {promptText(current.word, prompt)}
        </p>
        <p className="text-sm text-text-muted">
          {cells.length} {cells.length === 1 ? 'letter' : 'letters'} · write right to left
        </p>
        <span className="text-xs text-text-muted ml-auto">
          {index + 1} / {queue.length}
          {newCount > 0 && ` · ${newCount} new`}
        </span>
      </div>

      <WritingGrid
        cells={gridCells}
        direction={hebrewScriptPack.direction}
        active={active}
        onSelect={setActive}
        showReference={revealed}
        fontFamily={hebrewScriptPack.fontFamily}
        ariaLabel={`Letter boxes for a ${cells.length}-letter word`}
      />

      {/* Write-big-place-small: the boxes are targets, this is where the writing
          happens. A box sized for a five-letter word is unwritable on a phone. */}
      {active !== null && (
        <>
          <p className="text-sm text-text-muted">
            Writing box {active + 1} of {cells.length}
            {revealed && cells[active] ? ` — ${cells[active].text}` : ''}
          </p>
          <InkCanvas
            // Remounts per box, so ink never carries over from the last letter.
            key={`${current.key}:${active}`}
            strokes={cellStrokes[active] ?? []}
            onStrokeComplete={handleStroke}
            onPenDetected={() => setPenDetected(true)}
            reference={
              revealed
                ? {
                    text: cells[active].text,
                    fontFamily: hebrewScriptPack.fontFamily,
                    opacity: 0.38,
                  }
                : undefined
            }
            fontLoadSpec={hebrewScriptPack.fontLoadSpec}
            direction={hebrewScriptPack.direction}
            inkColor="var(--color-text)"
            height={280}
            ariaLabel={`Write letter ${active + 1} of ${cells.length}`}
          />
        </>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() =>
            setCellStrokes(prev => {
              if (active === null) return prev;
              const next = [...prev];
              next[active] = (next[active] ?? []).slice(0, -1);
              return next;
            })
          }
          disabled={active === null || (cellStrokes[active] ?? []).length === 0}
          className="px-4 py-2 bg-bg-card text-text-muted border border-gray-200 rounded-lg hover:border-gray-300 hover:text-text transition-colors font-medium disabled:opacity-40"
        >
          Undo stroke
        </button>
        <button
          type="button"
          onClick={() =>
            setCellStrokes(prev => {
              if (active === null) return prev;
              const next = [...prev];
              next[active] = [];
              return next;
            })
          }
          disabled={active === null || (cellStrokes[active] ?? []).length === 0}
          className="px-4 py-2 bg-bg-card text-text-muted border border-gray-200 rounded-lg hover:border-gray-300 hover:text-text transition-colors font-medium disabled:opacity-40"
        >
          Clear box
        </button>
        {!revealed && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            disabled={!written}
            className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors font-semibold shadow-sm ml-auto disabled:opacity-40"
          >
            Compare
          </button>
        )}
        {penDetected && (
          <span className="text-xs text-text-muted">Stylus detected · palm rejection on</span>
        )}
      </div>

      {revealed && (
        <div
          className="bg-bg-card rounded-xl border p-4 shadow-sm space-y-3"
          style={{ borderColor: '#D1FAE5' }}
        >
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              dir="rtl"
              lang="he"
              className="text-4xl leading-none"
              style={{ fontFamily: hebrewScriptPack.fontFamily, color: 'var(--color-primary)' }}
            >
              {current.word.hebrew}
            </span>
            {total !== null && (
              <span className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {total}
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted">
            {total === null
              ? 'The word is shown above. How close was it?'
              : 'The word scores as its weakest letter — one letter wrong is the word wrong.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {WRITING_GRADES.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => grade(g.id)}
                className="px-4 py-2 rounded-lg font-semibold border transition-colors flex-1 min-w-[5rem]"
                style={{
                  ...(g.id === 'again'
                    ? { background: 'var(--color-coral)', color: '#fff', borderColor: 'var(--color-coral)' }
                    : g.id === 'easy'
                      ? { background: 'var(--color-jade)', color: '#fff', borderColor: 'var(--color-jade)' }
                      : {
                          background: 'var(--color-bg-card)',
                          color: 'var(--color-text)',
                          borderColor: '#D1FAE5',
                        }),
                  ...(suggested === g.id
                    ? { outline: '2px solid var(--color-primary)', outlineOffset: '2px' }
                    : {}),
                }}
              >
                {g.label}
                {suggested === g.id && <span className="sr-only"> (suggested)</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Chapter and prompt controls.
 *
 * The chapter selection is the same persisted `DeckSelection` the flashcards
 * read, so narrowing to "chapters 1–8" holds across the app rather than being
 * re-picked per feature.
 */
function DeckControls({
  selection,
  prompt,
  promptable,
  onChange,
}: {
  selection: DeckSelection;
  prompt: WordPrompt;
  promptable: number;
  onChange: (patch?: Partial<DeckSelection>, prompt?: WordPrompt) => void;
}) {
  const textbook: TextbookId = 'garrett-derouchie';
  const chapters = chapterNumbers(textbook);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Chip
          label="All words"
          active={selection.deck === 'all'}
          onClick={() => onChange({ deck: 'all', chapters: [] })}
        />
        <Chip
          label={TEXTBOOKS[textbook].shortTitle}
          active={selection.deck === textbook}
          onClick={() => onChange({ deck: textbook })}
        />
        <span className="text-xs text-text-muted ml-auto">{promptable} words</span>
      </div>

      {selection.deck === textbook && (
        <div className="flex flex-wrap gap-1.5">
          {chapters.map(n => {
            const on = selection.chapters.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    chapters: on
                      ? selection.chapters.filter(c => c !== n)
                      : [...selection.chapters, n].sort((a, b) => a - b),
                  })
                }
                className="px-2 py-1 rounded text-xs font-medium border transition-colors"
                style={
                  on
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
                {n}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {WORD_PROMPTS.map(p => (
          <Chip
            key={p.id}
            label={p.label}
            title={p.hint}
            active={prompt === p.id}
            onClick={() => onChange(undefined, p.id)}
          />
        ))}
      </div>

      {prompt === 'transliteration' && promptable === 0 && (
        <p className="text-sm text-text-muted">
          None of these words carry a transliteration. The textbook vocabulary is sourced from
          the Hebrew Bible itself, which has no romanization — try "From the meaning".
        </p>
      )}
    </div>
  );
}

function Chip({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
      style={
        active
          ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
          : {
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-muted)',
              borderColor: '#D1FAE5',
            }
      }
    >
      {label}
    </button>
  );
}

export default function WordWriting() {
  return (
    <ErrorBoundary component="WordWriting">
      <WordWritingInner />
    </ErrorBoundary>
  );
}
