// Public surface of the ink engine.
//
// Apps import from `@tools/shared/ink`; the React surface is a separate export
// (`@tools/shared/components/InkCanvas`) so non-React consumers — the future
// mask-scoring pipeline, template authoring scripts — do not pull React in.

export {
  type BeginOutcome,
  CONSTANT_PRESSURE,
  InkCapture,
  type InkCaptureOptions,
  MIN_PEN_PRESSURE,
  normalizePressure,
  type PointerKind,
  type PointerSample,
} from './capture';
export { appendStroke, appendStrokes, type PathSink, type RibbonOptions, segmentQuad, widthAt } from './render';
export {
  DEFAULT_TOLERANCE,
  type InkScore,
  scoreInk,
  type ScoreOptions,
  type Verdict,
  VERDICT_THRESHOLDS,
  verdictFor,
} from './score/geom';
export {
  alphaBounds,
  clearGlyphMaskCache,
  type CompositeMask,
  distanceTransform,
  type GlyphMask,
  loadCompositeMask,
  loadGlyphMask,
  type LoadMaskOptions,
  maskFromAlpha,
  type MaskOptions,
  rasterizeComposite,
  rasterizeGlyph,
  type RasterizeOptions,
} from './score/mask';
export {
  allGlyphs,
  baseText,
  type GlyphCluster,
  glyphsInGroup,
  renderableText,
  type ScriptMetrics,
  type ScriptPack,
  splitClusters,
  type WritableGlyph,
} from './script-pack';
export { catmullRom, OneEuroFilter, PointSmoother } from './smooth';
export {
  type BoundingBox,
  boundingBox,
  distance,
  type InkPoint,
  normalizeStrokes,
  type NormalizeOptions,
  resample,
  type Stroke,
  strokeLength,
  totalLength,
} from './stroke';
