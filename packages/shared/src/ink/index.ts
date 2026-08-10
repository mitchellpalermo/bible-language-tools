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
  allGlyphs,
  glyphsInGroup,
  renderableText,
  type ScriptMetrics,
  type ScriptPack,
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
