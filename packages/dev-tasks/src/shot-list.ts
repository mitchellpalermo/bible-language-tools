/**
 * The shot list: what to capture, and what proves each capture shows it.
 *
 * The script never chooses a page. Every shot names its path and a piece of
 * text that must be visible once the page is in the state being shown, so a
 * capture of the wrong page, a 404, or a click that missed its target fails
 * instead of producing a plausible-looking PNG.
 */

export type App = 'greek' | 'hebrew';

export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

/** One interaction that brings the page to the state being shown. */
export type Step =
  | { click: string }
  | { hover: string }
  | { fill: string; text: string }
  | { press: string }
  | { waitFor: string }
  | { scrollTo: string };

export interface Shot {
  /** File-name slug: lowercase letters, digits and hyphens. Unique in the list. */
  name: string;
  /** Path on the app, starting with `/`. */
  path: string;
  /** Text that must be visible before the capture. Required — it is the proof. */
  expect: string;
  steps: Step[];
  /** localStorage entries set before the page loads. Objects are JSON-encoded. */
  storage: Record<string, string>;
  viewports: ViewportName[];
  fullPage: boolean;
  /** Capture only this element instead of the viewport. */
  element?: string;
}

export interface ShotList {
  app: App;
  shots: Shot[];
}

const STEP_KINDS = ['click', 'hover', 'fill', 'press', 'waitFor', 'scrollTo'] as const;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function parseStep(raw: unknown, where: string, errors: string[]): Step | undefined {
  if (!isObject(raw)) {
    errors.push(`${where}: a step must be an object`);
    return;
  }
  const kinds = STEP_KINDS.filter((k) => k in raw);
  if (kinds.length !== 1) {
    errors.push(`${where}: a step needs exactly one of ${STEP_KINDS.join(', ')}`);
    return;
  }
  const kind = kinds[0];
  if (!isText(raw[kind])) {
    errors.push(`${where}: "${kind}" must be a non-empty string`);
    return;
  }
  if (kind === 'fill') {
    if (typeof raw.text !== 'string') {
      errors.push(`${where}: "fill" needs a "text" string`);
      return;
    }
    return { fill: raw.fill as string, text: raw.text };
  }
  return { [kind]: raw[kind] } as Step;
}

function parseStorage(raw: unknown, where: string, errors: string[]): Record<string, string> {
  if (raw === undefined) return {};
  if (!isObject(raw)) {
    errors.push(`${where}: "storage" must be an object of key → value`);
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
  );
}

function parseViewports(raw: unknown, where: string, errors: string[]): ViewportName[] {
  if (raw === undefined) return ['mobile', 'desktop'];
  const valid = Array.isArray(raw) && raw.length > 0 && raw.every((v) => v in VIEWPORTS);
  if (!valid) {
    errors.push(`${where}: "viewports" must be a non-empty list of mobile, desktop`);
    return [];
  }
  return [...new Set(raw as ViewportName[])];
}

function parseShot(raw: unknown, where: string, errors: string[]): Shot | undefined {
  if (!isObject(raw)) {
    errors.push(`${where}: a shot must be an object`);
    return;
  }
  const before = errors.length;
  if (!isText(raw.name) || !SLUG.test(raw.name))
    errors.push(`${where}: "name" must be a slug like "flashcards-flipped"`);
  if (!isText(raw.path) || !raw.path.startsWith('/'))
    errors.push(`${where}: "path" must start with "/"`);
  if (!isText(raw.expect))
    errors.push(`${where}: "expect" is required — text that proves the page is in the right state`);
  if (raw.element !== undefined && !isText(raw.element))
    errors.push(`${where}: "element" must be a selector`);
  if (raw.fullPage !== undefined && typeof raw.fullPage !== 'boolean')
    errors.push(`${where}: "fullPage" must be true or false`);
  if (raw.steps !== undefined && !Array.isArray(raw.steps))
    errors.push(`${where}: "steps" must be a list`);

  const steps = (Array.isArray(raw.steps) ? raw.steps : []).map((s, i) =>
    parseStep(s, `${where} step ${i + 1}`, errors),
  );
  const storage = parseStorage(raw.storage, where, errors);
  const viewports = parseViewports(raw.viewports, where, errors);
  if (errors.length > before) return;

  return {
    name: raw.name as string,
    path: raw.path as string,
    expect: raw.expect as string,
    steps: steps as Step[],
    storage,
    viewports,
    fullPage: raw.fullPage === true,
    ...(raw.element === undefined ? {} : { element: raw.element as string }),
  };
}

/** Validate a parsed shot-list file. Throws one error listing every problem. */
export function parseShotList(raw: unknown): ShotList {
  const errors: string[] = [];
  if (!isObject(raw)) throw new Error('Shot list must be a JSON object with "app" and "shots"');

  if (raw.app !== 'greek' && raw.app !== 'hebrew') errors.push('"app" must be "greek" or "hebrew"');
  if (!Array.isArray(raw.shots) || raw.shots.length === 0)
    errors.push('"shots" must list at least one shot — the script never picks a page by itself');

  const shots = (Array.isArray(raw.shots) ? raw.shots : []).map((s, i) =>
    parseShot(s, `shot ${i + 1}`, errors),
  );
  const names = shots.flatMap((s) => (s ? [s.name] : []));
  for (const dup of new Set(names.filter((n, i) => names.indexOf(n) !== i)))
    errors.push(`shot name "${dup}" is used more than once`);

  if (errors.length > 0) throw new Error(`Invalid shot list:\n  - ${errors.join('\n  - ')}`);
  return { app: raw.app as App, shots: shots as Shot[] };
}
