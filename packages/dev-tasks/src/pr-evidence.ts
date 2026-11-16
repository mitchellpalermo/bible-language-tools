/**
 * The rule behind the "PR screenshots" check: a pull request that changes what
 * the app looks like must show it. The rule lives in code because a line in
 * CLAUDE.md is only as reliable as the agent remembering it.
 *
 * Pure on purpose — `pr-check-cli.ts` fetches the PR and calls `checkPr`.
 */

/** The label that waives the requirement, for a diff that matches by path but changes nothing visible. */
export const WAIVER_LABEL = 'no-screenshots-needed';

/** Files whose change can alter what a page looks like. */
const UI_PATTERNS: RegExp[] = [
  /^apps\/[^/]+\/src\/(components|pages|layouts|styles)\//,
  /^packages\/shared\/src\/components\//,
  /^packages\/shared\/src\/ink\/render/,
  /\.(astro|css)$/,
  /^apps\/[^/]+\/public\/(favicon|apple-touch-icon)/,
];

/** Test files sit beside components and never change the page. */
const NOT_UI = /\.(test|spec)\.[cm]?[jt]sx?$|\/test\/|\/e2e\//;

export function uiFiles(files: string[]): string[] {
  return files.filter((f) => !NOT_UI.test(f) && UI_PATTERNS.some((p) => p.test(f)));
}

/** `Screenshots: N/A - docs only`. A bare "N/A" with no reason does not count. */
const NA_LINE = /^\s*screenshots?\s*:\s*n\/?a\b[\s:–—-]*(\S.{2,})$/im;

export interface PrInput {
  number: number;
  /** `owner/name`. */
  repo: string;
  body: string | null;
  labels: string[];
  files: string[];
}

export interface Verdict {
  ok: boolean;
  /** One line for the check's log and the failure annotation. */
  message: string;
}

/** The PNGs `pnpm shots publish` put on this PR's assets branch and linked from the body. */
export function screenshotUrls(body: string, repo: string, number: number): string[] {
  const prefix = `https://raw.githubusercontent.com/${repo}/assets/pr-${number}/`;
  const urls: string[] = [];
  for (const m of body.matchAll(/https:\/\/raw\.githubusercontent\.com\/[^\s)"'<>]+\.png/gi)) {
    if (m[0].startsWith(prefix)) urls.push(m[0]);
  }
  return [...new Set(urls)];
}

const FIX =
  'Run `pnpm shots capture <list.json> --before main`, then `pnpm shots publish <dir> --pr <N>`, ' +
  'and paste the table into the PR body. If nothing visible changes, add the ' +
  `\`${WAIVER_LABEL}\` label or a "Screenshots: N/A - <reason>" line.`;

export function checkPr({ number, repo, body, labels, files }: PrInput): Verdict {
  const ui = uiFiles(files);
  if (ui.length === 0)
    return { ok: true, message: 'No UI files changed; screenshots not required.' };

  if (labels.includes(WAIVER_LABEL))
    return { ok: true, message: `Waived by the \`${WAIVER_LABEL}\` label.` };

  const text = body ?? '';
  const na = NA_LINE.exec(text);
  if (na) return { ok: true, message: `Waived in the PR body: ${na[1].trim()}` };

  const shown = ui.slice(0, 5).join(', ') + (ui.length > 5 ? `, and ${ui.length - 5} more` : '');
  const urls = screenshotUrls(text, repo, number);
  if (urls.length === 0)
    return {
      ok: false,
      message: `This PR changes UI files (${shown}) but its body links no screenshots from assets/pr-${number}. ${FIX}`,
    };

  const missing = (['mobile', 'desktop'] as const).filter(
    (v) => !urls.some((u) => u.toLowerCase().includes(`-${v}-`)),
  );
  if (missing.length > 0)
    return {
      ok: false,
      message: `Screenshots are linked but none are ${missing.join(' or ')} (file names from \`pnpm shots\` carry -mobile- / -desktop-). ${FIX}`,
    };

  return {
    ok: true,
    message: `${urls.length} screenshot(s) linked, mobile and desktop both covered.`,
  };
}
