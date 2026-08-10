import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { InkCapture, type PointerSample } from '../capture';
import { appendStrokes } from '../render';
import type { Stroke } from '../stroke';

/**
 * The writing surface.
 *
 * Owns only DOM wiring — event listeners, coalesced-sample extraction, canvas
 * sizing, and drawing. Every decision worth testing (what counts as a palm,
 * how a stroke is smoothed, where a segment's corners are) lives in the
 * framework-free modules alongside this file.
 *
 * Committed strokes are a prop, so undo and clear are the parent's business:
 * this component never owns the ink it has finished capturing.
 */
export interface InkCanvasProps {
  strokes: Stroke[];
  onStrokeComplete: (stroke: Stroke) => void;
  /** Ghosted target drawn beneath the ink. Omit for a blank surface. */
  reference?: { text: string; fontFamily: string; opacity: number };
  /** Awaited before the reference is drawn — otherwise it renders in a fallback face. */
  fontLoadSpec?: string;
  direction?: 'rtl' | 'ltr';
  inkColor?: string;
  guideColor?: string;
  height?: number;
  ariaLabel?: string;
  /** Fires the first time real stylus input is seen. */
  onPenDetected?: () => void;
}

export default function InkCanvas({
  strokes,
  onStrokeComplete,
  reference,
  fontLoadSpec,
  direction = 'rtl',
  inkColor = 'var(--color-text)',
  guideColor = '#CBD5E1',
  height = 320,
  ariaLabel = 'Writing surface',
  onPenDetected,
}: InkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Lazily constructed: `useRef(new InkCapture())` would allocate a capture
  // engine (and its filters) on every render and discard all but the first.
  const captureRef = useRef<InkCapture | null>(null);
  if (captureRef.current === null) captureRef.current = new InkCapture();
  const capture = captureRef.current;
  const frameRef = useRef<number | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  // Props the draw loop reads. Drawing happens outside React's render cycle —
  // a stroke produces hundreds of samples and re-rendering per sample would
  // drop frames — so the loop reads refs rather than closed-over props.
  const strokesRef = useRef(strokes);
  const referenceRef = useRef(reference);
  strokesRef.current = strokes;
  referenceRef.current = reference;

  const [fontReady, setFontReady] = useState(!fontLoadSpec);
  const fontReadyRef = useRef(fontReady);
  fontReadyRef.current = fontReady;

  // ── Font ────────────────────────────────────────────────────────────────
  // The reference glyph IS the answer key. Drawing it before the webfont
  // resolves would show the student a fallback letterform to copy.
  useEffect(() => {
    // `document.fonts` is absent in non-browser DOMs (and very old browsers).
    // Treat that as "nothing to wait for" rather than leaving the reference
    // permanently unrendered.
    if (!fontLoadSpec || !document.fonts) {
      setFontReady(true);
      return;
    }
    let cancelled = false;
    document.fonts
      .load(fontLoadSpec)
      .then(() => {
        if (!cancelled) setFontReady(true);
      })
      .catch(() => {
        // A font that fails to load should degrade to the fallback face, not
        // leave the surface permanently blank.
        if (!cancelled) setFontReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fontLoadSpec]);

  // ── Drawing ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    frameRef.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width, height: h } = sizeRef.current;
    ctx.clearRect(0, 0, width, h);

    const ref = referenceRef.current;
    if (ref && fontReadyRef.current) {
      ctx.save();
      ctx.globalAlpha = ref.opacity;
      ctx.fillStyle = guideColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(h * 0.62)}px ${ref.fontFamily}`;
      ctx.direction = direction;
      ctx.fillText(ref.text, width / 2, h / 2);
      ctx.restore();
    }

    const live = capture.liveStroke;
    const all = live ? [...strokesRef.current, live] : strokesRef.current;
    if (all.length > 0) {
      const path = new Path2D();
      appendStrokes(path, all);
      ctx.fillStyle = inkColor;
      ctx.fill(path);
    }
  }, [capture, direction, guideColor, inkColor]);

  const scheduleDraw = useCallback(() => {
    // Coalesce to one paint per frame. The Pencil delivers samples far faster
    // than the display refreshes, and drawing per sample is wasted work.
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // ── Sizing ──────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: rect.width, height };

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${height}px`;

      // Draw in CSS pixels; the transform handles the device-pixel backing
      // store. Stored ink stays resolution-independent as a result.
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    resize();

    // ResizeObserver is not in happy-dom, so guard rather than assume.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [height, draw]);

  // Redraw when committed strokes or font readiness change.
  useEffect(() => {
    scheduleDraw();
  }, [strokes, fontReady, reference, scheduleDraw]);

  // ── Pointer wiring ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toSample = (e: PointerEvent): PointerSample => {
      const rect = canvas.getBoundingClientRect();
      return {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure,
        timestamp: e.timeStamp,
      };
    };

    /**
     * Apple Pencil samples far faster than `pointermove` fires; without the
     * coalesced samples, fast strokes render as visible polygons. Feature-
     * detected because the fallback (the event itself) still draws — just
     * more coarsely.
     */
    const samplesFrom = (e: PointerEvent): PointerSample[] => {
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      return coalesced.length > 0 ? coalesced.map(toSample) : [toSample(e)];
    };

    const onDown = (e: PointerEvent) => {
      const wasPenKnown = capture.hasSeenPen;
      const outcome = capture.begin(toSample(e));
      if (outcome === 'rejected') return;

      if (!wasPenKnown && capture.hasSeenPen) onPenDetected?.();

      // Keep receiving moves even if the stroke wanders off the canvas.
      // Optional because pointer capture is not universally implemented, and
      // losing it should cost robustness at the edges, not the whole stroke.
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      scheduleDraw();
    };

    const onMove = (e: PointerEvent) => {
      if (!capture.isDrawing) return;
      capture.extend(samplesFrom(e));
      e.preventDefault();
      scheduleDraw();
    };

    const onUp = (e: PointerEvent) => {
      if (!capture.isDrawing) return;
      const stroke = capture.end(toSample(e));
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture?.(e.pointerId);
      e.preventDefault();
      if (stroke) onStrokeComplete(stroke);
      scheduleDraw();
    };

    const onCancel = () => {
      capture.cancel();
      scheduleDraw();
    };

    // Non-passive so preventDefault actually suppresses Safari's scroll,
    // callout, and selection gestures mid-stroke.
    const opts = { passive: false } as const;
    canvas.addEventListener('pointerdown', onDown, opts);
    canvas.addEventListener('pointermove', onMove, opts);
    canvas.addEventListener('pointerup', onUp, opts);
    canvas.addEventListener('pointercancel', onCancel, opts);
    canvas.addEventListener('pointerleave', onCancel, opts);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onCancel);
    };
  }, [capture, onStrokeComplete, onPenDetected, scheduleDraw]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <canvas
        ref={canvasRef}
        aria-label={ariaLabel}
        role="img"
        style={{
          display: 'block',
          width: '100%',
          height: `${height}px`,
          borderRadius: '0.75rem',
          background: 'var(--color-bg-card, #fff)',
          // Safari hygiene. Without these a stroke can scroll the page, raise
          // the callout menu, or start a text selection.
          touchAction: 'none',
          overscrollBehavior: 'contain',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          cursor: 'crosshair',
        }}
      />
    </div>
  );
}
