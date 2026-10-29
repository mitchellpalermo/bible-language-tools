/**
 * Run checks one after another, log each, and report. Every check runs even
 * when an earlier one failed — the report is more useful whole — except one
 * whose prerequisite failed, which is skipped and says why.
 */

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Check } from './check-list.ts';

export type Status = 'pass' | 'fail' | 'skipped';

export interface Result {
  check: Check;
  status: Status;
  seconds: number;
  log?: string;
  /** Last lines of output, for a failure. */
  tail?: string;
  reason?: string;
}

const TAIL_LINES = 40;

export function tail(text: string, lines = TAIL_LINES): string {
  // Drop colour codes: the report is read as plain text.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes is the point
  const plain = text.replace(/\u001b\[[0-9;]*m/g, '').trimEnd();
  return plain.split('\n').slice(-lines).join('\n');
}

/** The reason a check cannot run, or undefined when it can. */
export function blockedBy(check: Check, done: Map<string, Status>): string | undefined {
  const failed = (check.needs ?? []).filter((n) => done.get(n) !== 'pass');
  return failed.length > 0 ? `needs ${failed.join(', ')}, which did not pass` : undefined;
}

function runOne(
  check: Check,
  root: string,
  log: string,
): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    const [cmd, ...args] = check.command;
    const file = createWriteStream(log);
    let output = '';
    const child = spawn(cmd, args, {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: '0', ...check.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const keep = (b: Buffer) => {
      file.write(b);
      output = (output + b.toString()).slice(-20_000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', (err) => keep(Buffer.from(`${err.message}\n`)));
    child.on('close', (code) => file.end(() => done({ code: code ?? 1, output })));
  });
}

export async function runChecks(
  checks: Check[],
  root: string,
  logDir: string,
  onProgress: (line: string) => void = () => {},
): Promise<Result[]> {
  await mkdir(logDir, { recursive: true });
  const done = new Map<string, Status>();
  const results: Result[] = [];
  for (const check of checks) {
    const reason = blockedBy(check, done);
    if (reason) {
      done.set(check.id, 'skipped');
      results.push({ check, status: 'skipped', seconds: 0, reason });
      onProgress(`skip  ${check.id} (${reason})`);
      continue;
    }
    onProgress(`run   ${check.id} — ${check.command.join(' ')}`);
    const log = join(logDir, `${check.id.replace(/:/g, '-')}.log`);
    const start = Date.now();
    const { code, output } = await runOne(check, root, log);
    const status: Status = code === 0 ? 'pass' : 'fail';
    const seconds = Math.round((Date.now() - start) / 100) / 10;
    done.set(check.id, status);
    results.push({
      check,
      status,
      seconds,
      log,
      ...(status === 'fail' ? { tail: tail(output) } : {}),
    });
    onProgress(`${status === 'pass' ? 'pass ' : 'FAIL '} ${check.id} (${seconds}s)`);
  }
  return results;
}

const MARK: Record<Status, string> = { pass: 'pass', fail: '**FAIL**', skipped: 'skipped' };

/** The report a model hands back verbatim: a table, then each failure's tail. */
export function formatReport(results: Result[]): string {
  const failed = results.filter((r) => r.status === 'fail');
  const skipped = results.filter((r) => r.status === 'skipped');
  const verdict =
    failed.length === 0 && skipped.length === 0
      ? `All ${results.length} checks passed.`
      : `${failed.length} failed, ${skipped.length} skipped, ${results.length - failed.length - skipped.length} passed.`;

  const rows = results.map(
    (r) =>
      `| ${r.check.id} | ${MARK[r.status]} | ${r.status === 'skipped' ? '—' : `${r.seconds}s`} | ${r.check.title} |`,
  );
  const sections = [
    `## Checks: ${verdict}`,
    '',
    '| Check | Result | Time | What it checks |',
    '|---|---|---|---|',
    ...rows,
  ];
  for (const r of skipped) sections.push('', `**${r.check.id}** skipped: ${r.reason}.`);
  for (const r of failed) {
    sections.push(
      '',
      `### ${r.check.id} failed`,
      '',
      `\`${r.check.command.join(' ')}\` — full log: \`${r.log}\``,
      '',
      '```',
      r.tail ?? '',
      '```',
    );
  }
  return sections.join('\n');
}
