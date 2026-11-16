/**
 * Screenshots driven from the PR body, so CI does the capturing instead of a
 * model. A session writes a shot list into the body as a ```shots fenced
 * block; `pnpm shots pr <N>` (run by the pr-screenshots workflow) captures it,
 * publishes the PNGs and writes the table back into the body between two
 * markers.
 *
 * Pure on purpose — `shots-cli.ts` does the `gh`, git and browser work and
 * calls these to decide what to do.
 */

import { createHash } from 'node:crypto';
import { parseShotList, type ShotList } from './shot-list.ts';

export const SECTION_START = '<!-- shots:start -->';
export const SECTION_END = '<!-- shots:end -->';

/** A fenced block whose info string is `shots`. Its body is one shot list. */
const SHOTS_FENCE = /^(`{3,}|~{3,})[ \t]*shots[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/gm;

/** The raw text of every ```shots block in `body`, in order. */
export function shotBlocks(body: string): string[] {
  return [...stripSection(body).matchAll(SHOTS_FENCE)].map((m) => m[2]);
}

/**
 * Parse every ```shots block. Throws one error naming the block that is wrong,
 * and refuses two lists that would write the same file — every list's PNGs go
 * on one assets branch, so names must be unique across lists.
 */
export function parseShotBlocks(blocks: string[]): ShotList[] {
  const lists = blocks.map((text, i) => {
    const where = blocks.length > 1 ? `shots block ${i + 1}` : 'shots block';
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      throw new Error(`${where} is not valid JSON: ${(err as Error).message}`);
    }
    try {
      return parseShotList(raw);
    } catch (err) {
      throw new Error(`${where}: ${(err as Error).message}`);
    }
  });
  const seen = new Set<string>();
  for (const name of lists.flatMap((l) => l.shots.map((s) => s.name))) {
    if (seen.has(name)) throw new Error(`shot name "${name}" appears in more than one shots block`);
    seen.add(name);
  }
  return lists;
}

/**
 * What a capture depends on: the commit and the lists. The marker in the body
 * carries it, so an edit that changes neither (a typo fix in the description)
 * does not capture again, while a push or a changed list does.
 */
export function runKey(headSha: string, blocks: string[]): string {
  return createHash('sha256')
    .update(headSha)
    .update('\0')
    .update(blocks.join('\0'))
    .digest('hex')
    .slice(0, 16);
}

const marker = (key: string) => `<!-- shots-run: ${key} -->`;

/** True when the body's screenshots section was written for exactly this key. */
export function alreadyRun(body: string, key: string): boolean {
  return section(body)?.includes(marker(key)) ?? false;
}

function section(body: string): string | undefined {
  const start = body.indexOf(SECTION_START);
  const end = body.indexOf(SECTION_END, start);
  return start === -1 || end === -1 ? undefined : body.slice(start, end + SECTION_END.length);
}

function stripSection(body: string): string {
  const s = section(body);
  return s === undefined ? body : body.replace(s, '');
}

/** Put `content` between the markers, replacing what was there, or append it. */
export function withSection(body: string, content: string, key: string): string {
  const block = `${SECTION_START}\n${marker(key)}\n${content.trim()}\n${SECTION_END}`;
  const existing = section(body);
  if (existing !== undefined) return body.replace(existing, () => block);
  return `${body.trimEnd()}\n\n${block}\n`;
}

/**
 * The section when capture fails. It goes in the body, not only the job log,
 * so the session that wrote the list reads the error with `gh pr view` —
 * one cheap call — and the evidence check fails for want of images.
 */
export function failureContent(message: string): string {
  return [
    '## Screenshots',
    '',
    '**Capture failed.** Fix the shot list (or the page) and push or edit the body to retry.',
    '',
    '```',
    message.trim(),
    '```',
  ].join('\n');
}
