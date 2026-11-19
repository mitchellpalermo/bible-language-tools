#!/usr/bin/env node
/**
 * PR screenshots from a shot list. See packages/dev-tasks/README.md.
 *
 *   pnpm shots capture <list.json> [--before <ref>] [--out <dir>]
 *   pnpm shots publish <dir> --pr <N>
 *   pnpm shots pr <N> [--force]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { captureShots } from './capture.ts';
import type { Label } from './checks.ts';
import { startDevServer } from './dev-server.ts';
import { fetchBranch, pushAssets, repoRoot, withWorktreeAt } from './git.ts';
import {
  alreadyRun,
  failureContent,
  parseShotBlocks,
  runKey,
  shotBlocks,
  withSection,
} from './pr-shots.ts';
import { screenshotsMarkdown } from './publish.ts';
import { APP_PACKAGE, APPS_WITH_DATA, parseShotList, type ShotList } from './shot-list.ts';

const USAGE = `Usage:
  pnpm shots capture <list.json> [--before <ref>] [--out <dir>]
  pnpm shots publish <dir> --pr <N>
  pnpm shots pr <N> [--force]`;

async function captureFrom(root: string, list: ShotList, out: string, as: Label) {
  const server = await startDevServer(list.app, root);
  try {
    return await captureShots(server.baseURL, list, out, as);
  } finally {
    server.stop();
  }
}

async function capture(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { before: { type: 'string' }, out: { type: 'string' } },
  });
  if (positionals.length !== 1) throw new Error(USAGE);
  const listPath = resolve(positionals[0]);
  const list = parseShotList(JSON.parse(readFileSync(listPath, 'utf8')));
  const root = repoRoot();
  const out = resolve(values.out ?? join(root, '.shots', basename(listPath, '.json')));
  const written = await captureList(root, list, out, values.before);
  console.log(`\nWrote ${written.length} screenshots to ${out}:`);
  for (const f of written) console.log(`  ${join(out, f)}`);
}

/** Capture one list's "before" (from `beforeRef`, if given) and "after" into `out`. */
async function captureList(root: string, list: ShotList, out: string, beforeRef?: string) {
  const written: string[] = [];
  if (beforeRef) {
    console.log(`Capturing ${list.app} "before" from ${beforeRef}…`);
    written.push(
      ...(await withWorktreeAt(root, beforeRef, list.app, (dir) =>
        captureFrom(dir, list, out, 'before'),
      )),
    );
  }
  console.log(`Capturing ${list.app} "after" from this checkout…`);
  written.push(...(await captureFrom(root, list, out, 'after')));
  return written;
}

function publish(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { pr: { type: 'string' } },
  });
  const pr = Number(values.pr);
  if (positionals.length !== 1 || !Number.isInteger(pr) || pr <= 0) throw new Error(USAGE);
  const dir = resolve(positionals[0]);
  const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
  if (files.length === 0) throw new Error(`No .png files in ${dir}`);
  const repo = pushAssets(repoRoot(), dir, files, pr);
  console.log(`Pushed ${files.length} images to assets/pr-${pr}. PR body markdown:\n`);
  console.log(screenshotsMarkdown(files, repo, pr));
}

const gh = (args: string[], input?: string) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'inherit'],
  });

interface PrInfo {
  body: string;
  headRefOid: string;
  baseRefName: string;
}

const prInfo = (pr: number): PrInfo =>
  JSON.parse(gh(['pr', 'view', String(pr), '--json', 'body,headRefOid,baseRefName']));

/**
 * Re-read the body just before writing it, so an edit made while the capture
 * ran is kept: only the screenshots section is ours.
 */
function writeSection(pr: number, content: string, key: string) {
  const body = withSection(prInfo(pr).body ?? '', content, key);
  gh(['pr', 'edit', String(pr), '--body-file', '-'], body);
}

/** The corpus is gitignored; pages that read it need it built, as CI starts without. */
function ensureData(root: string, list: ShotList) {
  if (!APPS_WITH_DATA.includes(list.app)) return;
  const pkg = APP_PACKAGE[list.app];
  if (existsSync(join(root, `apps/${pkg}/public/data`))) return;
  console.log(`Building ${pkg} data…`);
  execFileSync('pnpm', ['--filter', pkg, 'build:data'], {
    cwd: root,
    stdio: 'inherit',
  });
}

/**
 * Everything from the shot lists in a PR's body: capture, publish, and write
 * the table back into the body. What the pr-screenshots workflow runs, and
 * runnable locally with a logged-in `gh`.
 */
async function pr(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { force: { type: 'boolean' } },
  });
  const number = Number(positionals[0]);
  if (positionals.length !== 1 || !Number.isInteger(number) || number <= 0) throw new Error(USAGE);

  const info = prInfo(number);
  const blocks = shotBlocks(info.body ?? '');
  if (blocks.length === 0) {
    console.log(`PR #${number} has no \`\`\`shots block; nothing to capture.`);
    return;
  }
  const key = runKey(info.headRefOid, blocks);
  if (!values.force && alreadyRun(info.body ?? '', key)) {
    console.log(`PR #${number} already has screenshots for this commit and shot list.`);
    return;
  }

  const root = repoRoot();
  const out = mkdtempSync(join(tmpdir(), `shots-pr-${number}-`));
  try {
    const lists = parseShotBlocks(blocks);
    const base = lists.some((l) => l.before) ? fetchBranch(root, info.baseRefName) : undefined;
    for (const list of lists) {
      ensureData(root, list);
      await captureList(root, list, out, list.before ? base : undefined);
    }
    const files = readdirSync(out).filter((f) => f.endsWith('.png'));
    const repo = pushAssets(root, out, files, number);
    writeSection(number, screenshotsMarkdown(files, repo, number), key);
    console.log(`Published ${files.length} screenshots to PR #${number}.`);
  } catch (err) {
    // A different key, so re-running the job (or editing the body) retries.
    writeSection(number, failureContent((err as Error).message), `failed-${key}`);
    throw err;
  }
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'capture') await capture(rest);
  else if (command === 'publish') publish(rest);
  else if (command === 'pr') await pr(rest);
  else throw new Error(USAGE);
} catch (err) {
  console.error(`\n${(err as Error).message}`);
  process.exit(1);
}
