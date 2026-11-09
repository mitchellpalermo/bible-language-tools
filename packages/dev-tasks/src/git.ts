/**
 * The git side of PR screenshots: a throwaway checkout of the base branch for
 * "before" shots, and the orphan `assets/pr-<N>` branch the images live on.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { App } from './shot-list.ts';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function repoRoot(cwd = process.cwd()): string {
  return git(cwd, 'rev-parse', '--show-toplevel');
}

/**
 * Run `fn` inside a detached worktree of `ref`, then remove it. Gitignored
 * inputs the dev server needs — the app's built corpus and `.dev.vars` — are
 * borrowed from the current checkout rather than rebuilt.
 */
export async function withWorktreeAt<T>(
  root: string,
  ref: string,
  app: App,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = join(mkdtempSync(join(tmpdir(), 'shots-base-')), 'checkout');
  git(root, 'worktree', 'add', '--detach', dir, ref);
  try {
    execFileSync('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], {
      cwd: dir,
      stdio: 'ignore',
    });
    const appDir = `apps/${app}-tools`;
    const data = join(root, appDir, 'public/data');
    if (existsSync(data) && !existsSync(join(dir, appDir, 'public/data')))
      symlinkSync(data, join(dir, appDir, 'public/data'));
    const vars = join(root, appDir, '.dev.vars');
    if (existsSync(vars)) cpSync(vars, join(dir, appDir, '.dev.vars'));
    return await fn(dir);
  } finally {
    git(root, 'worktree', 'remove', '--force', dir);
  }
}

/** `owner/name` from the origin remote's URL. */
export function githubRepo(remoteUrl: string): string {
  const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/);
  if (!match) throw new Error(`origin is not a GitHub remote: ${remoteUrl}`);
  return match[1];
}

/**
 * `-c` flags that make a commit in another directory author as `root` does.
 *
 * A fresh `git init` reads only global and system config, so where the name
 * and email are set per repository — as on Mitch's machine — its first commit
 * fails with "Author identity unknown". `git config` in `root` resolves the
 * same layers a commit there would (local, then global). An unset value is
 * left out, so git still reports a missing identity in its own words.
 */
export function identityArgs(root: string): string[] {
  return (['user.name', 'user.email'] as const).flatMap((key) => {
    try {
      return ['-c', `${key}=${git(root, 'config', '--get', key)}`];
    } catch {
      return [];
    }
  });
}

/**
 * Push `files` (in `dir`) to a fresh orphan branch `assets/pr-<pr>`, built in a
 * throwaway directory — never in the working tree, where the orphan dance
 * would delete ignored files. The commit borrows `root`'s identity
 * (`identityArgs`). Returns `owner/name`.
 */
export function pushAssets(root: string, dir: string, files: string[], pr: number): string {
  const remote = git(root, 'remote', 'get-url', 'origin');
  const tmp = mkdtempSync(join(tmpdir(), 'shots-push-'));
  try {
    git(tmp, 'init', '-q', '.');
    git(tmp, 'remote', 'add', 'origin', remote);
    for (const f of files) cpSync(join(dir, f), join(tmp, f));
    git(tmp, 'add', ...files);
    git(tmp, ...identityArgs(root), 'commit', '-q', '-m', `assets: screenshots for PR #${pr}`);
    git(tmp, 'branch', '-M', `assets/pr-${pr}`);
    git(tmp, 'push', '-q', '--force', 'origin', `assets/pr-${pr}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return githubRepo(remote);
}
