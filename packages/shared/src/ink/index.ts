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
export {
  appendStroke,
  appendStrokes,
  type PathSink,
  type RibbonOptions,
  segmentQuad,
  widthAt,
} from './render';
export {
  DEFAULT_TOLERANCE,
  type InkScore,
  type ScoreOptions,
  scoreInk,
  VERDICT_THRESHOLDS,
  type Verdict,
  verdictFor,
} from './score/geom';
export {
  alphaBounds,
  type CompositeMask,
  clearGlyphMaskCache,
  distanceTransform,
  type GlyphMask,
  type LoadMaskOptions,
  loadCompositeMask,
  loadGlyphMask,
  type MaskOptions,
  maskFromAlpha,
  type RasterizeOptions,
  rasterizeComposite,
  rasterizeGlyph,
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
  type NormalizeOptions,
  normalizeStrokes,
  resample,
  type Stroke,
  strokeLength,
  totalLength,
} from './stroke';
