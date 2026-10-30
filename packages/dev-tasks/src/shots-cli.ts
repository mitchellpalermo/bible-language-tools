#!/usr/bin/env node
/**
 * PR screenshots from a shot list. See packages/dev-tasks/README.md.
 *
 *   pnpm shots capture <list.json> [--before <ref>] [--out <dir>]
 *   pnpm shots publish <dir> --pr <N>
 */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { captureShots } from './capture.ts';
import type { Label } from './checks.ts';
import { startDevServer } from './dev-server.ts';
import { pushAssets, repoRoot, withWorktreeAt } from './git.ts';
import { screenshotsMarkdown } from './publish.ts';
import { parseShotList, type ShotList } from './shot-list.ts';

const USAGE = `Usage:
  pnpm shots capture <list.json> [--before <ref>] [--out <dir>]
  pnpm shots publish <dir> --pr <N>`;

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

  const written: string[] = [];
  if (values.before) {
    console.log(`Capturing "before" from ${values.before}…`);
    written.push(
      ...(await withWorktreeAt(root, values.before, list.app, (dir) =>
        captureFrom(dir, list, out, 'before'),
      )),
    );
  }
  console.log('Capturing "after" from this checkout…');
  written.push(...(await captureFrom(root, list, out, 'after')));

  console.log(`\nWrote ${written.length} screenshots to ${out}:`);
  for (const f of written) console.log(`  ${join(out, f)}`);
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

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'capture') await capture(rest);
  else if (command === 'publish') publish(rest);
  else throw new Error(USAGE);
} catch (err) {
  console.error(`\n${(err as Error).message}`);
  process.exit(1);
}
