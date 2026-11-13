#!/usr/bin/env node
/**
 * The "PR screenshots" CI check. See pr-evidence.ts for the rule.
 *
 *   GH_TOKEN=... node pr-check-cli.ts <pr-number> [owner/name]
 *
 * Reads the PR's body, labels and changed files through `gh`, so it sees the
 * live body — the screenshots are added after the PR exists.
 */

import { execFileSync } from 'node:child_process';
import { checkPr } from './pr-evidence.ts';

const number = Number(process.argv[2]);
const repo = process.argv[3] ?? process.env.GITHUB_REPOSITORY;
if (!Number.isInteger(number) || !repo) {
  console.error('usage: pr-check-cli.ts <pr-number> [owner/name]');
  process.exit(2);
}

const gh = (...args: string[]) =>
  execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const { body, labels } = JSON.parse(
  gh('pr', 'view', String(number), '--repo', repo, '--json', 'body,labels'),
) as {
  body: string;
  labels: { name: string }[];
};
const files = gh('api', '--paginate', `repos/${repo}/pulls/${number}/files`, '--jq', '.[].filename')
  .split('\n')
  .filter(Boolean);

const verdict = checkPr({ number, repo, body, labels: labels.map((l) => l.name), files });
if (verdict.ok) console.log(verdict.message);
else {
  console.error(`::error title=PR screenshots::${verdict.message}`);
  process.exit(1);
}
