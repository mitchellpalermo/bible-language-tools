import { useEffect, useRef } from 'react';
import { appendStrokes } from '../render';
import { normalizeStrokes, type Stroke } from '../stroke';

/**
 * The row of guide boxes a word is written into.
 *
 * Writing into per-letter boxes is not decoration: it removes ink segmentation
 * from the problem entirely. The student says where each letter ends, so the
 * engine never has to guess where one stops and the next begins — which is what
 * makes word mode tractable without a recognition model.
 *
 * The grid does not capture ink. Boxes are targets and thumbnails; tapping one
 * opens the full-size `InkCanvas` elsewhere on the page and the result renders
 * back into the box. That is **write-big-place-small**, and on a phone it is
 * load-bearing rather than a nicety — a box sized for a five-letter word is a
 * few tens of pixels across, and nobody writes Hebrew into that. It also
 * answers right-hand occlusion, which is a real problem writing right-to-left.
 *
 * Self-styled with plain CSS. Tailwind's content detection is per-app and does
 * not scan `packages/shared`, so utility classes here would emit no CSS. Design
 * tokens still work — they are CSS variables.
 */
export interface WritingGridCell {
  /** What belongs in this box — a letter with its points. */
  text: string;
  /** Ink the student has committed for this box. */
  strokes: Stroke[];
  /** 0–100 once graded, or null while unattempted. */
  score: number | null;
}

export interface WritingGridProps {
  cells: WritingGridCell[];
  /**
   * Fill order. `rtl` puts the first cell on the right, which is where the
   * first letter of a Hebrew word goes.
   *
   * Cells arrive in logical order — first-written first — and the container's
   * `direction` does the reversing. Reversing the array as well would put the
   * word back the wrong way round, and would break the moment this renders
   * inside another RTL element.
   */
  direction?: 'rtl' | 'ltr';
  /** Which box the writing surface is currently bound to. */
  active: number | null;
  onSelect: (index: number) => void;
  /** Shows the target letter ghosted in each box. */
  showReference?: boolean;
  fontFamily?: string;
  inkColor?: string;
  /** Accessible name for the group. */
  ariaLabel?: string;
}

/**
 * The box's verdict, mirroring `VERDICT_THRESHOLDS` in `score/geom.ts`.
 *
 * Duplicated as plain numbers rather than imported so that this component stays
 * a pure view over whatever the caller measured — it takes a score, not an
 * `InkScore`, which is what lets a paradigm cell (#104) reuse it unchanged.
 */
const PASS = 80;
const CLOSE = 60;

type CellVerdict = 'pass' | 'close' | 'miss';

function verdictOf(score: number): CellVerdict {
  if (score >= PASS) return 'pass';
  if (score >= CLOSE) return 'close';
  return 'miss';
}

const VERDICT_COLOR: Record<CellVerdict, string> = {
  pass: 'var(--color-jade, #10B981)',
  close: 'var(--color-primary, #0F766E)',
  miss: 'var(--color-coral, #F43F5E)',
};

export default function WritingGrid({
  cells,
  direction = 'rtl',
  active,
  onSelect,
  showReference = false,
  fontFamily = 'inherit',
  inkColor = 'var(--color-text, #0F172A)',
  ariaLabel = 'Letter boxes',
}: WritingGridProps) {
  return (
    <div className="ink-grid" dir={direction} role="group" aria-label={ariaLabel}>
      {cells.map((cell, index) => (
        <button
          // Index, not `cell.text`: a word can repeat a letter (הַלְלוּ) and two
          // boxes for the same letter are different boxes.
          // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity here
          key={index}
          type="button"
          className={`ink-grid__cell${active === index ? ' is-active' : ''}`}
          aria-pressed={active === index}
          aria-label={`Box ${index + 1} of ${cells.length}${
            cell.score === null ? ', not yet written' : `, scored ${cell.score}`
          }`}
          onClick={() => onSelect(index)}
          style={{ borderColor: active === index ? 'var(--color-primary, #0F766E)' : undefined }}
        >
          {showReference && (
            <span className="ink-grid__ghost" lang="he" style={{ fontFamily }}>
              {cell.text}
            </span>
          )}
          <CellInk strokes={cell.strokes} color={inkColor} />
          {cell.score !== null && (
            <span
              className="ink-grid__score"
              data-verdict={verdictOf(cell.score)}
              style={{ color: VERDICT_COLOR[verdictOf(cell.score)] }}
            >
              {cell.score}
            </span>
          )}
        </button>
      ))}

      <style>{`
        .ink-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: stretch;
        }
        .ink-grid__cell {
          position: relative;
          flex: 0 0 auto;
          /* Sized so a six-letter word still fits a 390px viewport without
             wrapping to a second row, which would read as two words. */
          width: 3.25rem;
          height: 3.75rem;
          padding: 0;
          background: var(--color-bg-card, #FFFFFF);
          border: 2px dashed #CBD5E1;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .ink-grid__cell:hover { border-color: #94A3B8; }
        .ink-grid__cell.is-active {
          border-style: solid;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
        }
        .ink-grid__cell:focus-visible {
          outline: 2px solid var(--color-primary, #0F766E);
          outline-offset: 2px;
        }
        .ink-grid__ghost {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          line-height: 1;
          color: #CBD5E1;
          pointer-events: none;
        }
        .ink-grid__canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .ink-grid__score {
          position: absolute;
          right: 0.125rem;
          bottom: 0.0625rem;
          font-size: 0.625rem;
          font-weight: 700;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          /* The number is chrome about the box, not part of the word. */
          direction: ltr;
        }
        @media (min-width: 640px) {
          .ink-grid__cell { width: 4rem; height: 4.5rem; }
          .ink-grid__ghost { font-size: 2.5rem; }
        }
      `}</style>
    </div>
  );
}

/**
 * The student's ink, scaled to fit its box.
 *
 * Normalized rather than drawn at capture scale: the ink was made on a surface
 * many times this size, and this is a thumbnail of what was written, not a
 * measurement of it. Scoring reads the strokes themselves and is unaffected by
 * anything here.
 */
function CellInk({ strokes, color }: { strokes: Stroke[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const ratio = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (strokes.length === 0) return;

    // Square box, so the thumbnail keeps the letter's aspect ratio: fitting to
    // a non-square target would stretch a ו into something a ד's width.
    const side = Math.min(width, height);
    const fitted = normalizeStrokes(strokes, { size: side, padding: 0.12 });
    const path = new Path2D();
    // Thinner than the writing surface's ribbon — at this scale the default
    // weight closes up the counters and every letter reads as a blob.
    appendStrokes(path, fitted, { minWidth: 0.75, maxWidth: 1.75 });

    ctx.save();
    ctx.translate((width - side) / 2, (height - side) / 2);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
  }, [strokes, color]);

  return <canvas ref={canvasRef} className="ink-grid__canvas" aria-hidden="true" />;
}
